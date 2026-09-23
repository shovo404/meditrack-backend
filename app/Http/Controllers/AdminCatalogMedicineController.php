<?php

namespace App\Http\Controllers;

use App\Models\CatalogMedicine;
use Illuminate\Http\Request;
use App\Http\Resources\CatalogMedicineResource;
use App\Http\Requests\StoreCatalogMedicineRequest;
use App\Http\Requests\UpdateCatalogMedicineRequest;
use App\Http\Requests\ChangeCatalogMedicineStatusRequest;

class AdminCatalogMedicineController extends Controller
{
    public function index(Request $request)
    {
        $query = CatalogMedicine::query();

        if ($request->has('search')) {
            $query->search($request->input('search'));
        }

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $medicines = $query->latest()->paginate(min($request->input('per_page', 20), 100));

        return CatalogMedicineResource::collection($medicines);
    }

    public function store(StoreCatalogMedicineRequest $request)
    {
        $medicine = CatalogMedicine::create($request->validated());

        return response()->json([
            'message' => 'Medicine created successfully.',
            'data' => new CatalogMedicineResource($medicine)
        ], 201);
    }

    public function show(CatalogMedicine $medicine)
    {
        return new CatalogMedicineResource($medicine);
    }

    public function update(UpdateCatalogMedicineRequest $request, CatalogMedicine $medicine)
    {
        $medicine->update($request->validated());

        return response()->json([
            'message' => 'Medicine updated successfully.',
            'data' => new CatalogMedicineResource($medicine)
        ]);
    }

    public function destroy(CatalogMedicine $medicine)
    {
        $medicine->delete();

        return response()->json([
            'message' => 'Medicine deleted successfully.'
        ]);
    }

    public function status(ChangeCatalogMedicineStatusRequest $request, CatalogMedicine $medicine)
    {
        $medicine->update([
            'is_active' => $request->validated('is_active'),
        ]);

        return response()->json([
            'message' => 'Medicine status updated successfully.',
            'data' => new CatalogMedicineResource($medicine)
        ]);
    }
}
