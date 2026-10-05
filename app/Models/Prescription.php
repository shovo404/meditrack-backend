<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Prescription extends Model
{
    use HasFactory, HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'user_id',
        'title',
        'image_path',
        'doctor_name',
        'hospital_name',
        'prescription_date',
        'notes',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
