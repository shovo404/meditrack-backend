<?php

namespace App\Http\Controllers;

use App\Http\Resources\CatalogMedicineResource;
use App\Models\CatalogMedicine;
use Illuminate\Http\Request;

/**
 * Catalog statistics for the Admin Dashboard (Phase 2E).
 *
 * The three counts describe the whole *live* catalog — soft-deleted medicines are
 * excluded, exactly like the `total` the catalog list reports. `recentlyUpdated`
 * powers the dashboard's "Recently updated" list from the same single request, so
 * the SPA never needs a second catalog data source.
 */
class AdminDashboardController extends Controller
{
    public function stats(Request $request)
    {
        return response()->json([
            'totalMedicines' => CatalogMedicine::count(),
            'activeMedicines' => CatalogMedicine::where('is_active', true)->count(),
            'inactiveMedicines' => CatalogMedicine::where('is_active', false)->count(),
            'recentlyUpdated' => CatalogMedicineResource::collection(
                CatalogMedicine::query()
                    ->orderByDesc('updated_at')
                    ->limit(5)
                    ->get()
            ),
        ]);
    }
}
