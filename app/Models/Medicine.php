<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Medicine extends Model
{
    use HasFactory, HasUuids;

    protected $guarded = [];

    protected $casts = [
        'dosage_amount' => 'float',
        'is_active' => 'boolean',
        'start_date' => 'date:Y-m-d',
        'end_date' => 'date:Y-m-d',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function catalogMedicine()
    {
        return $this->belongsTo(CatalogMedicine::class);
    }

    public function schedules()
    {
        return $this->hasMany(MedicineSchedule::class);
    }

    public function doseLogs()
    {
        return $this->hasMany(DoseLog::class);
    }
}
