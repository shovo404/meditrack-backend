<?php

namespace Tests\Feature;

use App\Models\DoseLog;
use App\Models\Medicine;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class DoseLogTest extends TestCase
{
    use RefreshDatabase;

    protected function makeMedicine(User $user, ?string $id = null): Medicine
    {
        return $user->medicines()->create([
            'id' => $id ?? (string) Str::uuid(),
            'name' => 'Paracetamol',
            'generic_name' => 'Paracetamol',
            'type' => 'TABLET',
            'strength' => '500mg',
            'dosage_amount' => 1,
            'dosage_unit' => 'TABLET',
            'frequency' => 'DAILY',
            'meal_instruction' => 'ANY_TIME',
            'start_date' => '2026-10-01',
            'is_active' => true,
        ]);
    }

    protected function doseLogPayload(array $overrides = []): array
    {
        return array_merge([
            'id' => (string) Str::uuid(),
            'medicineId' => null,
            'scheduleId' => null,
            'medicineName' => 'Paracetamol',
            'scheduledAt' => '2026-10-05T08:00:00',
            'action' => DoseLog::ACTION_TAKEN,
            'recordedAt' => '2026-10-05T08:02:00',
        ], $overrides);
    }

    public function test_anonymous_cannot_access_dose_logs()
    {
        $this->getJson('/api/v1/dose_logs')->assertStatus(401);
        $this->postJson('/api/v1/dose_logs', $this->doseLogPayload())->assertStatus(401);
        $this->getJson('/api/v1/dose_logs/'.Str::uuid())->assertStatus(401);
    }

    public function test_user_can_create_dose_log()
    {
        $user = User::factory()->create();
        $medicine = $this->makeMedicine($user);
        $payload = $this->doseLogPayload(['medicineId' => $medicine->id]);

        $response = $this->actingAs($user)->postJson('/api/v1/dose_logs', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.id', $payload['id'])
            ->assertJsonPath('data.action', DoseLog::ACTION_TAKEN)
            ->assertJsonPath('data.scheduledAt', '2026-10-05T08:00:00')
            ->assertJsonPath('data.recordedAt', '2026-10-05T08:02:00');

        $this->assertDatabaseHas('dose_logs', [
            'id' => $payload['id'],
            'user_id' => $user->id,
            'medicine_id' => $medicine->id,
            'action' => DoseLog::ACTION_TAKEN,
        ]);
    }

    public function test_dose_log_can_be_created_without_a_medicine()
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson(
            '/api/v1/dose_logs',
            $this->doseLogPayload(['medicineId' => null, 'medicineName' => 'Archived medicine'])
        );

        $response->assertStatus(201)->assertJsonPath('data.medicineId', null);
        $this->assertDatabaseHas('dose_logs', [
            'id' => $response->json('data.id'),
            'medicine_id' => null,
            'medicine_name' => 'Archived medicine',
        ]);
    }

    public function test_replaying_the_same_dose_log_id_never_rewrites_the_recorded_action()
    {
        $user = User::factory()->create();
        $id = (string) Str::uuid();

        $this->actingAs($user)->postJson('/api/v1/dose_logs', $this->doseLogPayload([
            'id' => $id,
            'action' => DoseLog::ACTION_TAKEN,
            'recordedAt' => '2026-10-05T08:02:00',
        ]))->assertStatus(201);

        // A retried offline push must be idempotent: the already stored historical
        // action and its original recorded time are left exactly as they were.
        $replay = $this->actingAs($user)->postJson('/api/v1/dose_logs', $this->doseLogPayload([
            'id' => $id,
            'action' => DoseLog::ACTION_SKIPPED,
            'recordedAt' => '2026-10-05T23:59:00',
        ]));

        $replay->assertStatus(201)
            ->assertJsonPath('data.action', DoseLog::ACTION_TAKEN)
            ->assertJsonPath('data.recordedAt', '2026-10-05T08:02:00');

        $this->assertDatabaseCount('dose_logs', 1);
        $this->assertDatabaseHas('dose_logs', [
            'id' => $id,
            'action' => DoseLog::ACTION_TAKEN,
        ]);
    }

    public function test_bulk_push_is_idempotent_and_never_duplicates()
    {
        $user = User::factory()->create();
        $first = $this->doseLogPayload();
        $second = $this->doseLogPayload(['action' => DoseLog::ACTION_SKIPPED]);

        $this->actingAs($user)->postJson('/api/v1/dose_logs/bulk', [
            'logs' => [$first, $second],
        ])->assertStatus(201)->assertJsonCount(2, 'data');

        $this->actingAs($user)->postJson('/api/v1/dose_logs/bulk', [
            'logs' => [$first, $second],
        ])->assertStatus(201)->assertJsonCount(2, 'data');

        $this->assertDatabaseCount('dose_logs', 2);
    }

    public function test_bulk_push_ignores_logs_referencing_a_medicine_owned_by_another_user()
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $foreignMedicine = $this->makeMedicine($otherUser);

        $response = $this->actingAs($user)->postJson('/api/v1/dose_logs/bulk', [
            'logs' => [$this->doseLogPayload(['medicineId' => $foreignMedicine->id])],
        ]);

        $response->assertStatus(201)->assertJsonCount(0, 'data');
        $this->assertDatabaseCount('dose_logs', 0);
    }

    public function test_user_can_list_only_their_own_dose_logs()
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();

        $this->actingAs($user)->postJson('/api/v1/dose_logs', $this->doseLogPayload())->assertStatus(201);
        $this->actingAs($otherUser)->postJson('/api/v1/dose_logs', $this->doseLogPayload())->assertStatus(201);

        $response = $this->actingAs($user)->getJson('/api/v1/dose_logs');

        $response->assertStatus(200)->assertJsonCount(1, 'data');
    }

    public function test_dose_log_listing_is_paginated_and_ordered_by_recorded_at()
    {
        $user = User::factory()->create();

        foreach (range(1, 3) as $index) {
            $this->actingAs($user)->postJson('/api/v1/dose_logs', $this->doseLogPayload([
                'scheduledAt' => sprintf('2026-10-0%dT08:00:00', $index),
                'recordedAt' => sprintf('2026-10-0%dT08:02:00', $index),
            ]))->assertStatus(201);
        }

        $response = $this->actingAs($user)->getJson('/api/v1/dose_logs?per_page=2');

        $response->assertStatus(200)
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.scheduledAt', '2026-10-03T08:00:00')
            ->assertJsonPath('meta.total', 3);
    }

    public function test_dose_log_listing_can_be_capped_per_page()
    {
        $user = User::factory()->create();

        foreach (range(1, 3) as $index) {
            $this->actingAs($user)->postJson('/api/v1/dose_logs', $this->doseLogPayload([
                'scheduledAt' => sprintf('2026-10-0%dT08:00:00', $index),
            ]))->assertStatus(201);
        }

        $this->actingAs($user)->getJson('/api/v1/dose_logs?per_page=500')
            ->assertStatus(200)
            ->assertJsonCount(3, 'data');
    }

    public function test_user_cannot_access_another_users_dose_log()
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $id = (string) Str::uuid();

        $this->actingAs($owner)->postJson('/api/v1/dose_logs', $this->doseLogPayload(['id' => $id]))
            ->assertStatus(201);

        $this->actingAs($intruder)->getJson("/api/v1/dose_logs/{$id}")->assertStatus(404);
        $this->actingAs($intruder)->putJson("/api/v1/dose_logs/{$id}", [
            'action' => DoseLog::ACTION_MISSED,
        ])->assertStatus(404);
        $this->actingAs($intruder)->deleteJson("/api/v1/dose_logs/{$id}")->assertStatus(404);

        $this->assertDatabaseHas('dose_logs', [
            'id' => $id,
            'action' => DoseLog::ACTION_TAKEN,
        ]);
    }

    public function test_user_cannot_reuse_a_dose_log_id_owned_by_another_user()
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $id = (string) Str::uuid();

        $this->actingAs($owner)->postJson('/api/v1/dose_logs', $this->doseLogPayload(['id' => $id]))
            ->assertStatus(201);

        $this->actingAs($intruder)->postJson('/api/v1/dose_logs', $this->doseLogPayload([
            'id' => $id,
            'action' => DoseLog::ACTION_MISSED,
        ]))->assertStatus(409);

        $this->assertDatabaseHas('dose_logs', ['id' => $id, 'action' => DoseLog::ACTION_TAKEN]);
    }

    public function test_user_cannot_log_a_dose_against_another_users_medicine()
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $foreignMedicine = $this->makeMedicine($otherUser);

        $this->actingAs($user)->postJson('/api/v1/dose_logs', $this->doseLogPayload([
            'medicineId' => $foreignMedicine->id,
        ]))->assertStatus(422)->assertJsonValidationErrors('medicineId');

        $this->assertDatabaseCount('dose_logs', 0);
    }

    public function test_dose_log_creation_requires_a_known_action()
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/v1/dose_logs', $this->doseLogPayload([
            'action' => 'EXPLODED',
        ]))->assertStatus(422)->assertJsonValidationErrors('action');

        $this->assertDatabaseCount('dose_logs', 0);
    }

    public function test_user_can_correct_the_action_of_a_dose_log()
    {
        $user = User::factory()->create();
        $id = (string) Str::uuid();

        $this->actingAs($user)->postJson('/api/v1/dose_logs', $this->doseLogPayload(['id' => $id]))
            ->assertStatus(201);

        $response = $this->actingAs($user)->putJson("/api/v1/dose_logs/{$id}", [
            'action' => DoseLog::ACTION_TAKEN,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.action', DoseLog::ACTION_TAKEN)
            ->assertJsonPath('data.scheduledAt', '2026-10-05T08:00:00');

        $this->assertDatabaseHas('dose_logs', [
            'id' => $id,
            'action' => DoseLog::ACTION_TAKEN,
            'scheduled_at' => '2026-10-05 08:00:00',
        ]);
    }

    public function test_deleting_a_medicine_preserves_its_dose_history()
    {
        $user = User::factory()->create();
        $medicine = $this->makeMedicine($user);
        $id = (string) Str::uuid();

        $this->actingAs($user)->postJson('/api/v1/dose_logs', $this->doseLogPayload([
            'id' => $id,
            'medicineId' => $medicine->id,
            'medicineName' => $medicine->name,
        ]))->assertStatus(201);

        $this->actingAs($user)->deleteJson('/api/v1/medicines/'.$medicine->id)->assertStatus(204);

        $this->assertDatabaseHas('dose_logs', [
            'id' => $id,
            'medicine_id' => null,
            'medicine_name' => $medicine->name,
            'action' => DoseLog::ACTION_TAKEN,
        ]);

        $response = $this->actingAs($user)->getJson("/api/v1/dose_logs/{$id}");
        $response->assertStatus(200)
            ->assertJsonPath('data.medicineId', null)
            ->assertJsonPath('data.medicineName', $medicine->name)
            ->assertJsonPath('data.action', DoseLog::ACTION_TAKEN);
    }

    public function test_user_can_delete_their_own_dose_log()
    {
        $user = User::factory()->create();
        $id = (string) Str::uuid();

        $this->actingAs($user)->postJson('/api/v1/dose_logs', $this->doseLogPayload(['id' => $id]))
            ->assertStatus(201);

        $this->actingAs($user)->deleteJson("/api/v1/dose_logs/{$id}")->assertStatus(204);

        $this->assertDatabaseMissing('dose_logs', ['id' => $id]);
    }

    public function test_deleting_a_user_account_removes_only_that_users_history()
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();

        $this->actingAs($user)->postJson('/api/v1/dose_logs', $this->doseLogPayload())->assertStatus(201);
        $otherId = (string) Str::uuid();
        $this->actingAs($otherUser)->postJson('/api/v1/dose_logs', $this->doseLogPayload(['id' => $otherId]))
            ->assertStatus(201);

        $user->delete();

        $this->assertDatabaseCount('dose_logs', 1);
        $this->assertDatabaseHas('dose_logs', ['id' => $otherId]);
    }
}
