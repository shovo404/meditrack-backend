<?php

namespace App\Http\Controllers;

use App\Http\Resources\DoseLogResource;
use App\Models\DoseLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DoseLogController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = $request->user()->doseLogs()->orderBy('recorded_at', 'desc')->orderBy('id');

        if ($request->filled('medicineId')) {
            $query->where('medicine_id', $request->input('medicineId'));
        }

        if ($request->filled('since')) {
            $query->where('recorded_at', '>=', Carbon::parse($request->input('since')));
        }

        return DoseLogResource::collection(
            $query->paginate(min($request->input('per_page', 50), 100))
        );
    }

    /**
     * Bulk push used by the Android offline queue. Each entry is applied with the exact
     * same idempotency rules as a single store, so a partial retry can never duplicate or
     * rewrite medication history.
     */
    public function bulk(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'logs' => 'required|array|max:500',
            'logs.*.id' => 'required|uuid',
            'logs.*.medicineId' => 'nullable|uuid',
            'logs.*.scheduleId' => 'nullable|uuid',
            'logs.*.medicineName' => 'nullable|string|max:255',
            'logs.*.scheduledAt' => 'required|date',
            'logs.*.action' => ['required', Rule::in(DoseLog::ACTIONS)],
            'logs.*.recordedAt' => 'required|date',
        ]);

        $user = $request->user();
        $medicineIds = collect($validated['logs'])
            ->pluck('medicineId')
            ->filter()
            ->unique()
            ->values();

        $ownedMedicineIds = $medicineIds->isEmpty()
            ? collect()
            : $user->medicines()->whereIn('id', $medicineIds)->pluck('id');

        $stored = DB::transaction(function () use ($validated, $user, $ownedMedicineIds) {
            $records = [];

            foreach ($validated['logs'] as $log) {
                $medicineId = $log['medicineId'] ?? null;

                if ($medicineId !== null && ! $ownedMedicineIds->contains($medicineId)) {
                    continue;
                }

                $existing = DoseLog::find($log['id']);

                if ($existing instanceof DoseLog) {
                    if ((int) $existing->user_id !== (int) $user->id) {
                        continue;
                    }

                    $records[] = $existing;

                    continue;
                }

                $records[] = DoseLog::create([
                    'id' => $log['id'],
                    'user_id' => $user->id,
                    'medicine_id' => $medicineId,
                    'schedule_id' => $log['scheduleId'] ?? null,
                    'medicine_name' => $log['medicineName'] ?? null,
                    'scheduled_at' => Carbon::parse($log['scheduledAt']),
                    'action' => $log['action'],
                    'recorded_at' => Carbon::parse($log['recordedAt']),
                ]);
            }

            return $records;
        });

        return response()->json([
            'data' => DoseLogResource::collection($stored)->resolve($request),
        ], 201);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id' => 'required|uuid',
            'medicineId' => 'nullable|uuid',
            'scheduleId' => 'nullable|uuid',
            'medicineName' => 'nullable|string|max:255',
            'scheduledAt' => 'required|date',
            'action' => ['required', Rule::in(DoseLog::ACTIONS)],
            'recordedAt' => 'required|date',
        ]);

        $this->ensureMedicineIsOwned($request, $validated['medicineId'] ?? null);

        $existing = DoseLog::find($validated['id']);

        if ($existing instanceof DoseLog) {
            if ((int) $existing->user_id !== (int) $request->user()->id) {
                return response()->json(['message' => 'This dose log id is already in use.'], 409);
            }

            // Idempotent replay. The recorded action and its original timestamps are
            // immutable, so retrying a push after a timeout can never rewrite history.
            return response()->json([
                'data' => (new DoseLogResource($existing))->toArray($request),
            ], 201);
        }

        $doseLog = $request->user()->doseLogs()->create([
            'id' => $validated['id'],
            'medicine_id' => $validated['medicineId'] ?? null,
            'schedule_id' => $validated['scheduleId'] ?? null,
            'medicine_name' => $validated['medicineName'] ?? null,
            'scheduled_at' => Carbon::parse($validated['scheduledAt']),
            'action' => $validated['action'],
            'recorded_at' => Carbon::parse($validated['recordedAt']),
        ]);

        return response()->json([
            'data' => (new DoseLogResource($doseLog))->toArray($request),
        ], 201);
    }

    public function show(Request $request, string $id): DoseLogResource
    {
        return new DoseLogResource($request->user()->doseLogs()->findOrFail($id));
    }

    /**
     * Corrections are explicit and narrow: a user may fix what they actually did, but the
     * scheduled time, the medicine and the schedule a dose belonged to are never rewritten.
     */
    public function update(Request $request, string $id): DoseLogResource
    {
        $doseLog = $request->user()->doseLogs()->findOrFail($id);

        $validated = $request->validate([
            'action' => ['required', Rule::in(DoseLog::ACTIONS)],
            'recordedAt' => 'nullable|date',
        ]);

        $doseLog->update([
            'action' => $validated['action'],
            'recorded_at' => isset($validated['recordedAt'])
                ? Carbon::parse($validated['recordedAt'])
                : $doseLog->recorded_at,
        ]);

        return new DoseLogResource($doseLog);
    }

    public function destroy(Request $request, string $id): Response
    {
        $doseLog = $request->user()->doseLogs()->findOrFail($id);
        $doseLog->delete();

        return response()->noContent();
    }

    private function ensureMedicineIsOwned(Request $request, ?string $medicineId): void
    {
        if ($medicineId === null) {
            return;
        }

        if (! $request->user()->medicines()->whereKey($medicineId)->exists()) {
            throw ValidationException::withMessages([
                'medicineId' => ['The selected medicine does not belong to you.'],
            ]);
        }
    }
}
