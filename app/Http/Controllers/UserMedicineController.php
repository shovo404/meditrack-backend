<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UserMedicineController extends Controller
{
    public function index(Request $request)
    {
        $medicines = $request->user()->medicines()->with('schedules')->get();

        return response()->json([
            'data' => $medicines->map(function ($med) {
                return $this->formatMedicine($med);
            }),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'id' => 'required|uuid',
            'catalogMedicineId' => 'nullable|uuid|exists:catalog_medicines,id',
            'name' => 'required|string|max:255',
            'genericName' => 'required|string|max:255',
            'type' => 'required|string|max:100',
            'strength' => 'required|string|max:100',
            'dosageAmount' => 'required|numeric',
            'dosageUnit' => 'required|string|max:100',
            'frequency' => 'required|string|max:100',
            'instructions' => 'nullable|string',
            'mealInstruction' => 'required|string|max:100',
            'notes' => 'nullable|string',
            'imageUrl' => 'nullable|url',
            'startDate' => 'required|date',
            'endDate' => 'nullable|date',
            'isActive' => 'required|boolean',
            'schedules' => 'nullable|array',
            'schedules.*.id' => 'required|uuid',
            'schedules.*.time' => 'required|date_format:H:i',
            'schedules.*.dosageAmount' => 'required|numeric',
            'schedules.*.dosageUnit' => 'required|string|max:100',
            'schedules.*.isActive' => 'required|boolean',
        ]);

        $medicine = null;
        DB::transaction(function () use ($validated, $request, &$medicine) {
            $medicine = $request->user()->medicines()->updateOrCreate(
                ['id' => $validated['id']],
                [
                    'catalog_medicine_id' => $validated['catalogMedicineId'] ?? null,
                    'name' => $validated['name'],
                    'generic_name' => $validated['genericName'],
                    'type' => $validated['type'],
                    'strength' => $validated['strength'],
                    'dosage_amount' => $validated['dosageAmount'],
                    'dosage_unit' => $validated['dosageUnit'],
                    'frequency' => $validated['frequency'],
                    'instructions' => $validated['instructions'] ?? null,
                    'meal_instruction' => $validated['mealInstruction'],
                    'notes' => $validated['notes'] ?? null,
                    'image_url' => $validated['imageUrl'] ?? null,
                    'start_date' => $validated['startDate'],
                    'end_date' => $validated['endDate'] ?? null,
                    'is_active' => $validated['isActive'],
                ]
            );

            if (isset($validated['schedules'])) {
                $scheduleIds = [];
                foreach ($validated['schedules'] as $sch) {
                    $medicine->schedules()->updateOrCreate(
                        ['id' => $sch['id']],
                        [
                            'time' => $sch['time'],
                            'dosage_amount' => $sch['dosageAmount'],
                            'dosage_unit' => $sch['dosageUnit'],
                            'is_active' => $sch['isActive'],
                        ]
                    );
                    $scheduleIds[] = $sch['id'];
                }
                // delete any old ones
                $medicine->schedules()->whereNotIn('id', $scheduleIds)->delete();
            } else {
                $medicine->schedules()->delete();
            }
        });

        $medicine->load('schedules');

        return response()->json([
            'data' => $this->formatMedicine($medicine),
        ], 201);
    }

    public function show(Request $request, string $id)
    {
        $medicine = $request->user()->medicines()->with('schedules')->where('id', $id)->firstOrFail();

        return response()->json([
            'data' => $this->formatMedicine($medicine),
        ]);
    }

    public function update(Request $request, string $id)
    {
        // update uses store logic for simplicity as it handles updateOrCreate on ID
        $medicine = $request->user()->medicines()->where('id', $id)->firstOrFail();

        // Since it's exactly the same schema for sync, we can just call store
        // But for completeness, we just return the same method flow
        return $this->store($request);
    }

    public function destroy(Request $request, string $id)
    {
        $medicine = $request->user()->medicines()->where('id', $id)->firstOrFail();
        $medicine->delete();

        return response()->json(null, 204);
    }

    private function formatMedicine($medicine)
    {
        return [
            'id' => $medicine->id,
            'catalogMedicineId' => $medicine->catalog_medicine_id,
            'name' => $medicine->name,
            'genericName' => $medicine->generic_name,
            'type' => $medicine->type,
            'strength' => $medicine->strength,
            'dosageAmount' => $medicine->dosage_amount,
            'dosageUnit' => $medicine->dosage_unit,
            'frequency' => $medicine->frequency,
            'instructions' => $medicine->instructions,
            'mealInstruction' => $medicine->meal_instruction,
            'notes' => $medicine->notes,
            'imageUrl' => $medicine->image_url,
            'startDate' => $medicine->start_date ? $medicine->start_date->format('Y-m-d') : null,
            'endDate' => $medicine->end_date ? $medicine->end_date->format('Y-m-d') : null,
            'isActive' => $medicine->is_active,
            'schedules' => $medicine->schedules->map(function ($sch) {
                return [
                    'id' => $sch->id,
                    'medicineId' => $sch->medicine_id,
                    'time' => date('H:i', strtotime($sch->time)),
                    'dosageAmount' => $sch->dosage_amount,
                    'dosageUnit' => $sch->dosage_unit,
                    'isActive' => $sch->is_active,
                ];
            }),
        ];
    }
}
