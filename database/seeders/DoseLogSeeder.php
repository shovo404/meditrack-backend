<?php

namespace Database\Seeders;

use App\Models\DoseLog;
use App\Models\Medicine;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DoseLogSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->orderBy('id')->first();
        $medicine = Medicine::query()->orderBy('id')->first();

        if ($user === null || $medicine === null) {
            return;
        }

        DoseLog::query()->create([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'medicine_id' => $medicine->id,
            'schedule_id' => $medicine->schedules()->orderBy('id')->value('id'),
            'medicine_name' => $medicine->name,
            'scheduled_at' => now()->subHour(),
            'action' => DoseLog::ACTION_TAKEN,
            'recorded_at' => now()->subMinutes(55),
        ]);
    }
}
