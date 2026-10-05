<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsUser(array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $this->withToken($user->createToken('auth_token')->plainTextToken);

        return $user;
    }

    public function test_unauthenticated_user_cannot_update_a_profile()
    {
        $response = $this->putJson('/api/v1/profile', ['name' => 'Mallory']);

        $response->assertStatus(401);
    }

    public function test_user_can_update_their_own_name()
    {
        $user = $this->actingAsUser(['name' => 'Old Name']);

        $response = $this->putJson('/api/v1/profile', ['name' => 'New Name']);

        $response->assertStatus(200);
        $response->assertJsonPath('message', 'Profile updated successfully.');
        $response->assertJsonPath('user.name', 'New Name');
        $response->assertJsonPath('user.email', $user->email);
        $response->assertJsonPath('user.id', $user->id);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'New Name',
        ]);
    }

    public function test_profile_update_advances_updated_at_for_reconciliation()
    {
        $user = $this->actingAsUser();
        $originalUpdatedAt = $user->updated_at->copy()->subDay();

        $user->forceFill(['updated_at' => $originalUpdatedAt])->save();

        $response = $this->putJson('/api/v1/profile', ['name' => 'Refreshed']);

        $response->assertStatus(200);
        $this->assertTrue(
            $user->fresh()->updated_at->greaterThan($originalUpdatedAt),
            'updated_at must advance so clients can reconcile last-write-wins.'
        );
    }

    public function test_user_cannot_update_another_user_by_sending_a_user_id()
    {
        $attacker = $this->actingAsUser(['name' => 'Attacker']);
        $victim = User::factory()->create(['name' => 'Victim']);

        $response = $this->putJson('/api/v1/profile', [
            'name' => 'Attacker Renamed',
            'user_id' => $victim->id,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('user_id');

        // Neither account may be altered by the rejected request.
        $this->assertDatabaseHas('users', ['id' => $attacker->id, 'name' => 'Attacker']);
        $this->assertDatabaseHas('users', ['id' => $victim->id, 'name' => 'Victim']);
    }

    public function test_user_cannot_update_another_user_by_sending_an_id()
    {
        $this->actingAsUser(['name' => 'Attacker']);
        $victim = User::factory()->create(['name' => 'Victim']);

        $response = $this->putJson('/api/v1/profile', [
            'name' => 'Attacker Renamed',
            'id' => $victim->id,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('id');
        $this->assertDatabaseHas('users', ['id' => $victim->id, 'name' => 'Victim']);
    }

    public function test_user_cannot_escalate_their_role()
    {
        $user = $this->actingAsUser(['name' => 'Normal', 'role' => User::ROLE_USER]);

        $response = $this->putJson('/api/v1/profile', [
            'name' => 'Normal',
            'role' => User::ROLE_ADMIN,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('role');
        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'role' => User::ROLE_USER,
        ]);
    }

    public function test_user_cannot_change_their_email_without_verification()
    {
        $user = $this->actingAsUser(['email' => 'original@example.com']);

        $response = $this->putJson('/api/v1/profile', [
            'name' => 'Renamed',
            'email' => 'attacker@example.com',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('email');
        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'email' => 'original@example.com',
        ]);
    }

    public function test_a_missing_name_is_rejected()
    {
        $this->actingAsUser();

        $response = $this->putJson('/api/v1/profile', []);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('name');
    }

    public function test_invalid_names_are_rejected()
    {
        $this->actingAsUser();

        foreach ([['name' => ''], ['name' => 'a'], ['name' => str_repeat('x', 256)]] as $payload) {
            $response = $this->putJson('/api/v1/profile', $payload);
            $response->assertStatus(422);
            $response->assertJsonValidationErrors('name');
        }
    }

    public function test_updating_the_name_leaves_the_password_untouched()
    {
        $user = $this->actingAsUser(['email' => 'keep@example.com']);
        $originalHash = $user->password;

        $response = $this->putJson('/api/v1/profile', ['name' => 'Renamed']);

        $response->assertStatus(200);
        $this->assertSame($originalHash, $user->fresh()->password);
        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_profile_update_never_returns_sensitive_columns()
    {
        $this->actingAsUser();

        $response = $this->putJson('/api/v1/profile', ['name' => 'Renamed']);

        $response->assertStatus(200);
        $response->assertJsonMissingPath('user.password');
        $response->assertJsonMissingPath('user.remember_token');
    }

    public function test_auth_user_endpoint_and_profile_update_agree_on_the_name()
    {
        $this->actingAsUser(['name' => 'Before']);

        $this->putJson('/api/v1/profile', ['name' => 'After'])->assertStatus(200);

        $this->getJson('/api/v1/auth/user')
            ->assertStatus(200)
            ->assertJsonPath('user.name', 'After');
    }
}
