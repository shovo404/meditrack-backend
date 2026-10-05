<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MedicineSchedule extends Model
{
    use HasFactory, HasUuids;

    protected $guarded = [];

    protected $casts = [
        'dosage_amount' => 'float',
        'is_active' => 'boolean',
    ];

    public function medicine()
    {
        return $this->belongsTo(Medicine::class);
    }
}
