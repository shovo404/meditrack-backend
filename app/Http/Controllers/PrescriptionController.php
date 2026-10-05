<?php

namespace App\Http\Controllers;

use App\Http\Resources\PrescriptionResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PrescriptionController extends Controller
{
    public function index(Request $request)
    {
        return PrescriptionResource::collection($request->user()->prescriptions()->orderBy('created_at', 'desc')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'id' => 'required|uuid',
            'title' => 'required|string|max:255',
            'image' => 'required|image|mimes:jpeg,png,jpg,webp|max:5120',
            'doctorName' => 'nullable|string|max:255',
            'hospitalName' => 'nullable|string|max:255',
            'prescriptionDate' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        $path = $request->file('image')->store('prescriptions/'.$request->user()->id, 'public');

        $prescription = $request->user()->prescriptions()->create([
            'id' => $validated['id'],
            'title' => $validated['title'],
            'image_path' => $path,
            'doctor_name' => $validated['doctorName'] ?? null,
            'hospital_name' => $validated['hospitalName'] ?? null,
            'prescription_date' => $validated['prescriptionDate'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ]);

        return new PrescriptionResource($prescription);
    }

    public function show(Request $request, string $id)
    {
        $prescription = $request->user()->prescriptions()->findOrFail($id);

        return new PrescriptionResource($prescription);
    }

    public function update(Request $request, string $id)
    {
        $prescription = $request->user()->prescriptions()->findOrFail($id);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:5120',
            'doctorName' => 'nullable|string|max:255',
            'hospitalName' => 'nullable|string|max:255',
            'prescriptionDate' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        $path = $prescription->image_path;
        $oldPath = null;

        if ($request->hasFile('image')) {
            $oldPath = $prescription->image_path;
            $path = $request->file('image')->store('prescriptions/'.$request->user()->id, 'public');
        }

        $prescription->update([
            'title' => $validated['title'],
            'image_path' => $path,
            'doctor_name' => $validated['doctorName'] ?? null,
            'hospital_name' => $validated['hospitalName'] ?? null,
            'prescription_date' => $validated['prescriptionDate'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ]);

        if ($oldPath) {
            Storage::disk('public')->delete($oldPath);
        }

        return new PrescriptionResource($prescription);
    }

    public function destroy(Request $request, string $id)
    {
        $prescription = $request->user()->prescriptions()->findOrFail($id);

        $path = $prescription->image_path;
        $prescription->delete();

        Storage::disk('public')->delete($path);

        return response()->noContent();
    }
}
