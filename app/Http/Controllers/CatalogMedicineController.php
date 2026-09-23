<?php

namespace App\Http\Controllers;

use App\Models\CatalogMedicine;
use Illuminate\Http\Request;
use App\Http\Resources\CatalogMedicineResource;

class CatalogMedicineController extends Controller
{
    public function index(Request $request)
    {
        $query = CatalogMedicine::where('is_active', true);

        if ($request->has('search')) {
            $query->search($request->input('search'));
        }

        $medicines = $query->latest()->paginate(min($request->input('per_page', 20), 100));

        return CatalogMedicineResource::collection($medicines);
    }
}
