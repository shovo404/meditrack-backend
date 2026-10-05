<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class UserMedicineTest extends TestCase
{
    use RefreshDatabase;

    public function test_anonymous_cannot_access()
    {
        $response = $this->getJson('/api/v1/medicines');
        $response->assertStatus(401);
    }

    public function test_user_can_create_and_list_own_medicine()
    {
        $user = User::factory()->create();
        $id = (string) Str::uuid();

        $response = $this->actingAs($user)->postJson('/api/v1/medicines', [
            'id' => $id,
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
        ]);

        $response->assertStatus(201);

        $listResponse = $this->actingAs($user)->getJson('/api/v1/medicines');
        $listResponse->assertStatus(200);
        $listResponse->assertJsonCount(1, 'data');
        $this->assertEquals('Paracetamol', $listResponse->json('data.0.name'));
    }

    public function test_user_cannot_access_other_user_medicine()
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();
        $id = (string) Str::uuid();

        $this->actingAs($userA)->postJson('/api/v1/medicines', [
            'id' => $id,
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
        ])->assertStatus(201);

        $this->actingAs($userB)->getJson("/api/v1/medicines/{$id}")
            ->assertStatus(404);

        $this->actingAs($userB)->putJson("/api/v1/medicines/{$id}", [
            'id' => $id,
            'name' => 'Hacked',
            'genericName' => 'Paracetamol',
            'type' => 'TABLET',
            'strength' => '500mg',
            'dosageAmount' => 1,
            'dosageUnit' => 'TABLET',
            'frequency' => 'AS_NEEDED',
            'mealInstruction' => 'ANY_TIME',
            'startDate' => '2026-09-30',
            'isActive' => true,
        ])->assertStatus(404);

        $this->actingAs($userB)->deleteJson("/api/v1/medicines/{$id}")
            ->assertStatus(404);
    }
}
