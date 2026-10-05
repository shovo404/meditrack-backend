<?php

namespace Database\Factories;

use App\Models\DoseLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class DoseLogFactory extends Factory
{
    protected $model = DoseLog::class;

    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'user_id' => User::factory(),
            'medicine_id' => null,
            'schedule_id' => null,
            'medicine_name' => $this->faker->words(2, true),
            'scheduled_at' => now(),
            'action' => DoseLog::ACTION_TAKEN,
            'recorded_at' => now(),
        ];
    }

    public function action(string $action): static
    {
        return $this->state(fn (array $attributes) => ['action' => $action]);
    }

    public function taken(): static
    {
        return $this->action(DoseLog::ACTION_TAKEN);
    }

    public function skipped(): static
    {
        return $this->action(DoseLog::ACTION_SKIPPED);
    }

    public function missed(): static
    {
        return $this->action(DoseLog::ACTION_MISSED);
    }
}
