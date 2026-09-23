<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class CatalogMedicineResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'genericName' => $this->generic_name,
            'strength' => $this->strength,
            'dosageForm' => $this->dosage_form,
            'manufacturer' => $this->manufacturer,
            'imageUrl' => $this->imageUrl(),
            'isActive' => $this->is_active,
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }

    public function imageUrl(): ?string
    {
        if ($this->image_url === null) {
            return null;
        }

        if (filter_var($this->image_url, FILTER_VALIDATE_URL) !== false) {
            return $this->image_url;
        }

        return Storage::disk('public')->url($this->image_url);
    }
}
