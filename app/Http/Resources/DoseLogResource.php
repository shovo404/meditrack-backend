<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DoseLogResource extends JsonResource
{
    /**
     * Medication history is a wall-clock record: the user took the dose at the local
     * time they experienced, so timestamps round-trip as naive ISO-8601 without any
     * timezone conversion that would shift them.
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'medicineId' => $this->medicine_id,
            'scheduleId' => $this->schedule_id,
            'medicineName' => $this->medicine_name,
            'scheduledAt' => $this->scheduled_at?->format('Y-m-d\TH:i:s'),
            'action' => $this->action,
            'recordedAt' => $this->recorded_at?->format('Y-m-d\TH:i:s'),
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
