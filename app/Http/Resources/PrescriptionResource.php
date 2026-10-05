<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class PrescriptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'remoteUrl' => url(Storage::url($this->image_path)),
            'doctorName' => $this->doctor_name,
            'hospitalName' => $this->hospital_name,
            'prescriptionDate' => $this->prescription_date,
            'notes' => $this->notes,
            'createdAt' => $this->created_at->toIso8601String(),
            'updatedAt' => $this->updated_at ? $this->updated_at->toIso8601String() : null,
        ];
    }
}
