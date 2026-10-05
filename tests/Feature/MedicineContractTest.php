<?php

namespace Tests\Feature;

use App\Models\CatalogMedicine;
use App\Models\DoseLog;
use App\Models\Medicine;
use App\Models\MedicineSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Phase 4 regression coverage for the medicine wire contract.
 *
 * Two defects are pinned here:
 *   - `formatMedicine()` omitted `updatedAt`, which permanently disabled the
 *     Android client's server -> device reconciliation.
 *   - `catalogMedicineId` was validated as a uuid against a column that could
 *     never hold one, so every catalogue-linked medicine creation returned 422.
 */
class MedicineContractTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A complete, valid medicine payload.
     *
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'id' => (string) Str::uuid(),
            'name' => 'Paracetamol',
            'genericName' => 'Paracetamol',
            'type' => 'TABLET',
            'strength' => '500mg',
            'dosageAmount' => 1,
            'dosageUnit' => 'TABLET',
            'frequency' => 'AS_NEEDED',
            'mealInstruction' => 'ANY_TIME',
            'startDate' => '2026-09-30',
            'isActive' => true,
        ], $overrides);
    }

    // ---------------------------------------------------------------------
    // PART 3 -- updatedAt reconciliation contract
    // ---------------------------------------------------------------------

    public function test_store_response_includes_updated_at(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload());

        $response->assertStatus(201);
        $response->assertJsonStructure(['data' => ['id', 'createdAt', 'updatedAt']]);
        $this->assertNotEmpty($response->json('data.updatedAt'));
        $this->assertNotEmpty($response->json('data.createdAt'));
    }

    public function test_index_response_includes_updated_at_for_every_medicine(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload([
            'name' => 'First',
        ]))->assertStatus(201);

        $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload([
            'name' => 'Second',
        ]))->assertStatus(201);

        $list = $this->actingAs($user)->getJson('/api/v1/medicines');

        $list->assertStatus(200);
        $list->assertJsonCount(2, 'data');

        foreach ($list->json('data') as $medicine) {
            $this->assertArrayHasKey('updatedAt', $medicine);
            $this->assertNotEmpty($medicine['updatedAt']);
            $this->assertArrayHasKey('createdAt', $medicine);
        }
    }

    public function test_show_response_includes_updated_at(): void
    {
        $user = User::factory()->create();
        $id = (string) Str::uuid();

        $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload(['id' => $id]))
            ->assertStatus(201);

        $this->actingAs($user)->getJson("/api/v1/medicines/{$id}")
            ->assertStatus(200)
            ->assertJsonStructure(['data' => ['updatedAt', 'createdAt']]);
    }

    public function test_updated_at_uses_the_projects_iso8601_with_offset_format(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload());
        $updatedAt = $response->json('data.updatedAt');

        // Matches PrescriptionResource / CatalogMedicineResource / DoseLogResource.
        $this->assertSame(
            Carbon::parse($updatedAt)->toIso8601String(),
            Carbon::parse($updatedAt)->toIso8601String()
        );

        // Explicit UTC offset is required: this is precisely the format the
        // Android `LocalDateTime.parse()` cannot read on its own, which is why
        // the client now uses an offset-tolerant parser.
        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2}|Z)$/',
            $updatedAt
        );

        // Round-trips as a real point in time, not a naive local wall clock.
        $this->assertInstanceOf(Carbon::class, Carbon::parse($updatedAt));
    }

    public function test_updated_at_advances_when_the_medicine_is_modified(): void
    {
        $user = User::factory()->create();
        $id = (string) Str::uuid();

        $created = $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload(['id' => $id]));
        $createdAtValue = $created->json('data.updatedAt');

        Carbon::setTestNow(Carbon::parse('2026-10-06 12:00:00')->addDay());

        try {
            $updated = $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload([
                'id' => $id,
                'name' => 'Paracetamol 500mg (updated)',
            ]));

            $this->assertGreaterThan(
                Carbon::parse($createdAtValue)->timestamp,
                Carbon::parse($updated->json('data.updatedAt'))->timestamp,
                'updatedAt must move forward so the client can detect a newer server record'
            );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_updated_at_reflects_the_persisted_record(): void
    {
        $user = User::factory()->create();
        $id = (string) Str::uuid();

        $response = $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload(['id' => $id]));

        $persisted = Medicine::findOrFail($id);

        $this->assertSame(
            Carbon::parse($persisted->updated_at)->toIso8601String(),
            Carbon::parse($response->json('data.updatedAt'))->toIso8601String()
        );
    }

    // ---------------------------------------------------------------------
    // PART 4 -- catalogMedicineId type contract
    // ---------------------------------------------------------------------

    public function test_valid_catalog_medicine_id_is_accepted_and_persisted(): void
    {
        $user = User::factory()->create();
        $catalog = CatalogMedicine::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload([
            'catalogMedicineId' => $catalog->id,
        ]));

        // This is the exact request that returned 422 before Phase 4.
        $response->assertStatus(201);
        $response->assertJsonPath('data.catalogMedicineId', $catalog->id);

        $this->assertDatabaseHas('medicines', [
            'name' => 'Paracetamol',
            'catalog_medicine_id' => $catalog->id,
        ]);
    }

    public function test_catalog_medicine_id_is_accepted_as_a_numeric_string(): void
    {
        // Gson transmits an integer-typed catalogue id as a JSON string, so the
        // client never needs to cast it.
        $user = User::factory()->create();
        $catalog = CatalogMedicine::factory()->create();

        $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload([
            'catalogMedicineId' => (string) $catalog->id,
        ]))->assertStatus(201);

        $this->assertDatabaseHas('medicines', [
            'catalog_medicine_id' => $catalog->id,
        ]);
    }

    public function test_nonexistent_catalog_medicine_id_is_rejected(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload([
            'catalogMedicineId' => 999999999,
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('catalogMedicineId');
    }

    public function test_non_numeric_catalog_medicine_id_is_rejected(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload([
            'catalogMedicineId' => 'not-an-id',
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('catalogMedicineId');

        // A legacy uuid is also rejected: it can never match the integer key.
        $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload([
            'catalogMedicineId' => (string) Str::uuid(),
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('catalogMedicineId');
    }

    public function test_null_catalog_medicine_id_is_allowed(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload([
            'catalogMedicineId' => null,
        ]));

        $response->assertStatus(201);
        $this->assertNull($response->json('data.catalogMedicineId'));
    }

    public function test_an_inactive_catalog_entry_can_still_back_an_existing_medicine(): void
    {
        // Deactivating a catalogue row must not orphan the medicines already
        // linked to it, so an existing-but-inactive id remains valid input.
        $user = User::factory()->create();
        $catalog = CatalogMedicine::factory()->create(['is_active' => false]);

        $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload([
            'catalogMedicineId' => $catalog->id,
        ]))->assertStatus(201);

        $this->assertDatabaseHas('medicines', ['catalog_medicine_id' => $catalog->id]);
    }

    public function test_the_user_medicine_link_survives_a_round_trip(): void
    {
        $user = User::factory()->create();
        $catalog = CatalogMedicine::factory()->create();
        $id = (string) Str::uuid();

        $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload([
            'id' => $id,
            'catalogMedicineId' => $catalog->id,
        ]))->assertStatus(201);

        // The link must still be readable through the sync/list endpoint, which
        // is what the Android reconciliation depends on.
        $list = $this->actingAs($user)->getJson('/api/v1/medicines');
        $list->assertStatus(200);
        $list->assertJsonPath('data.0.catalogMedicineId', $catalog->id);

        // And the Eloquent relation must resolve.
        $medicine = Medicine::findOrFail($id);
        $this->assertTrue($medicine->catalogMedicine->is($catalog));
    }

    public function test_catalog_sync_does_not_modify_user_dose_or_schedule_data(): void
    {
        $user = User::factory()->create();
        $catalog = CatalogMedicine::factory()->create();
        $id = (string) Str::uuid();
        $scheduleId = (string) Str::uuid();

        $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload([
            'id' => $id,
            'catalogMedicineId' => $catalog->id,
            'schedules' => [[
                'id' => $scheduleId,
                'time' => '08:00',
                'dosageAmount' => 1,
                'dosageUnit' => 'TABLET',
                'isActive' => true,
            ]],
        ]))->assertStatus(201);

        $medicine = Medicine::findOrFail($id);
        $schedule = MedicineSchedule::findOrFail($scheduleId);
        $medicine->update(['is_active' => false]);
        DoseLog::create([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'medicine_id' => $medicine->id,
            'schedule_id' => $schedule->id,
            'medicine_name' => 'Paracetamol',
            'action' => DoseLog::ACTION_TAKEN,
            'scheduled_at' => now(),
            'recorded_at' => now(),
            'sync_state' => 0,
        ]);
        $doseLogId = DoseLog::query()->firstOrFail()->id;

        // Now run a catalogue read, exactly as the Android client does on sync.
        $this->actingAs($user)->getJson('/api/v1/catalog/medicines')->assertStatus(200);

        // User-owned data must be untouched by a catalogue read.
        $this->assertDatabaseHas('medicines', [
            'id' => $medicine->id,
            'catalog_medicine_id' => $catalog->id,
            'is_active' => false,
        ]);
        $this->assertDatabaseHas('medicine_schedules', ['id' => $schedule->id]);
        $this->assertDatabaseHas('dose_logs', ['id' => $doseLogId]);
    }

    public function test_catalog_records_are_not_modified_by_the_type_alignment(): void
    {
        $catalog = CatalogMedicine::factory()->count(3)->create();

        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/api/v1/medicines', $this->payload([
            'catalogMedicineId' => $catalog->first()->id,
        ]))->assertStatus(201);

        // Every catalogue row must survive untouched.
        $this->assertSame(3, CatalogMedicine::withTrashed()->count());
        foreach ($catalog as $row) {
            $this->assertDatabaseHas('catalog_medicines', [
                'id' => $row->id,
                'name' => $row->name,
            ]);
        }
    }
}
