<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Artisan;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_registration_succeeds()
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure(['message', 'user' => ['id', 'name', 'email', 'role']]);
        
        $this->assertDatabaseHas('users', [
            'email' => 'john@example.com',
            'role' => User::ROLE_USER,
        ]);
    }

    public function test_duplicate_email_registration_fails()
    {
        User::factory()->create(['email' => 'john@example.com']);

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'John Doe 2',
            'email' => 'john@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(422);
    }

    public function test_invalid_registration_validation_fails()
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'John Doe',
            'email' => 'not-an-email',
            'password' => 'pass',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(422);
    }

    public function test_user_login_succeeds()
    {
        $user = User::factory()->create([
            'password' => Hash::make('password123')
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure(['message', 'access_token', 'user']);
    }

    public function test_invalid_login_fails_with_401()
    {
        $user = User::factory()->create([
            'password' => Hash::make('password123')
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(401);
    }

    public function test_authenticated_user_endpoint_works()
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/v1/auth/user');

        $response->assertStatus(200);
        $response->assertJsonPath('user.email', $user->email);
    }

    public function test_logout_revokes_token()
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withHeaders(['Authorization' => "Bearer $token"])
                         ->postJson('/api/v1/auth/logout');

        $response->assertStatus(200);
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $user->id,
        ]);
    }

    public function test_normal_user_cannot_access_admin_test_endpoint()
    {
        $user = User::factory()->create(['role' => User::ROLE_USER]);

        $response = $this->actingAs($user)->getJson('/api/v1/admin/test');

        $response->assertStatus(403);
    }

    public function test_admin_can_access_admin_test_endpoint()
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $response = $this->actingAs($admin)->getJson('/api/v1/admin/test');

        $response->assertStatus(200);
        $response->assertJson(['success' => true]);
    }

    public function test_public_registration_cannot_create_admin()
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Admin wannabe',
            'email' => 'admin@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => User::ROLE_ADMIN,
        ]);

        $response->assertStatus(201);
        
        $this->assertDatabaseHas('users', [
            'email' => 'admin@example.com',
            'role' => User::ROLE_USER,
        ]);
    }

    public function test_admin_creation_mechanism_works()
    {
        $this->artisan('make:admin')
             ->expectsQuestion('Enter admin name', 'Admin Test')
             ->expectsQuestion('Enter admin email', 'admin2@example.com')
             ->expectsQuestion('Enter admin password', 'securepass123')
             ->assertSuccessful();

        $this->assertDatabaseHas('users', [
            'email' => 'admin2@example.com',
            'role' => User::ROLE_ADMIN,
        ]);
    }
}
