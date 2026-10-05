<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DoseLog extends Model
{
    use HasFactory, HasUuids;

    public const ACTION_TAKEN = 'TAKEN';

    public const ACTION_SNOOZED = 'SNOOZED';

    public const ACTION_SKIPPED = 'SKIPPED';

    public const ACTION_MISSED = 'MISSED';

    public const ACTIONS = [
        self::ACTION_TAKEN,
        self::ACTION_SNOOZED,
        self::ACTION_SKIPPED,
        self::ACTION_MISSED,
    ];

    protected $fillable = [
        'id',
        'user_id',
        'medicine_id',
        'schedule_id',
        'medicine_name',
        'scheduled_at',
        'action',
        'recorded_at',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'recorded_at' => 'datetime',
        ];
    }

    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function medicine(): BelongsTo
    {
        return $this->belongsTo(Medicine::class);
    }
}
