<?php

namespace App\Http\Controllers;

use App\Http\Requests\ChangeCatalogMedicineStatusRequest;
use App\Http\Requests\RemoveCatalogMedicineImageRequest;
use App\Http\Requests\StoreCatalogMedicineRequest;
use App\Http\Requests\UpdateCatalogMedicineRequest;
use App\Http\Resources\CatalogMedicineResource;
use App\Models\CatalogMedicine;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class AdminCatalogMedicineController extends Controller
{
    public const IMAGE_DIRECTORY = 'catalog-medicines';

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
        $data = $request->validated();
        unset($data['image']);

        if ($request->hasFile('image')) {
            $data['image_url'] = $this->storeImage($request->file('image'));
        }

        $medicine = CatalogMedicine::create($data);

        return response()->json([
            'message' => 'Medicine created successfully.',
            'data' => new CatalogMedicineResource($medicine),
        ], 201);
    }

    public function show(CatalogMedicine $medicine)
    {
        return new CatalogMedicineResource($medicine);
    }

    public function update(UpdateCatalogMedicineRequest $request, CatalogMedicine $medicine)
    {
        $data = $request->validated();
        unset($data['image'], $data['remove_image']);

        $replacing = $request->hasFile('image');
        $removing = $request->boolean('remove_image');

        if ($replacing) {
            $data['image_url'] = $this->storeImage($request->file('image'));
        } elseif ($removing) {
            $data['image_url'] = null;
        }

        $oldImagePath = $medicine->image_url;
        $medicine->update($data);

        if ($replacing || $removing) {
            $this->deleteImage($oldImagePath);
        }

        return response()->json([
            'message' => 'Medicine updated successfully.',
            'data' => new CatalogMedicineResource($medicine),
        ]);
    }

    public function removeImage(RemoveCatalogMedicineImageRequest $request, CatalogMedicine $medicine)
    {
        $oldImagePath = $medicine->image_url;

        $medicine->update(['image_url' => null]);

        $this->deleteImage($oldImagePath);

        return response()->json([
            'message' => 'Medicine image removed successfully.',
            'data' => new CatalogMedicineResource($medicine),
        ]);
    }

    public function destroy(CatalogMedicine $medicine)
    {
        $medicine->delete();

        return response()->json([
            'message' => 'Medicine deleted successfully.',
        ]);
    }

    public function status(ChangeCatalogMedicineStatusRequest $request, CatalogMedicine $medicine)
    {
        $medicine->update([
            'is_active' => $request->validated('is_active'),
        ]);

        return response()->json([
            'message' => 'Medicine status updated successfully.',
            'data' => new CatalogMedicineResource($medicine),
        ]);
    }

    private function storeImage(UploadedFile $image): string
    {
        return $image->store(self::IMAGE_DIRECTORY, 'public');
    }

    private function deleteImage(?string $imageUrl): void
    {
        if (! $imageUrl || filter_var($imageUrl, FILTER_VALIDATE_URL) !== false) {
            return;
        }

        Storage::disk('public')->delete($imageUrl);
    }
}
