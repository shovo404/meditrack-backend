<?php

namespace Tests\Feature;

use App\Models\CatalogMedicine;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Tests\TestCase;

/**
 * Admin Panel (first-party SPA) authentication.
 *
 * These tests cover the session/cookie authentication path added for the Admin SPA and
 * guard the Android bearer-token flow against regressions.
 *
 * Stateful requests are simulated by sending an Origin/Referer header whose host is listed
 * in SANCTUM_STATEFUL_DOMAINS (see phpunit.xml), which is how a browser marks a request as
 * first-party.
 *
 * Note: Laravel's CSRF middleware deliberately skips validation while running unit tests
 * (Illuminate\Foundation\Http\Middleware\PreventRequestForgery::runningUnitTests()), so the
 * 419 CSRF-token behaviour is asserted structurally (the middleware is active on the api
 * group) rather than by expecting a 419 response. CSRF rejection was not verified in a real
 * browser during this phase.
 */
class AdminAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    /** A first-party origin configured in phpunit.xml (Vite admin dev server). */
    private const ADMIN_ORIGIN = 'http://localhost:5174';

    private const ADMIN_PASSWORD = 'admin-password-123';

    private function admin(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role' => User::ROLE_ADMIN,
            'password' => Hash::make(self::ADMIN_PASSWORD),
        ], $attributes));
    }

    /**
     * Send requests the way the Admin SPA does: as a first-party (stateful) frontend.
     */
    private function asAdminSpa(): static
    {
        return $this->withHeaders([
            'Origin' => self::ADMIN_ORIGIN,
            'Referer' => self::ADMIN_ORIGIN.'/admin/login',
        ]);
    }

    private function loginPayload(?User $user = null, ?string $password = null): array
    {
        return [
            'email' => $user?->email ?? 'admin@example.com',
            'password' => $password ?? self::ADMIN_PASSWORD,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Sanctum stateful (SPA) configuration
    |--------------------------------------------------------------------------
    */

    public function test_stateful_api_middleware_is_registered_on_the_api_group()
    {
        $this->assertContains(
            EnsureFrontendRequestsAreStateful::class,
            $this->app['router']->getMiddlewareGroups()['api'],
            'Sanctum\'s stateful SPA middleware must be part of the api middleware group.'
        );
    }

    public function test_admin_login_requires_a_stateful_first_party_request()
    {
        $admin = $this->admin();

        // No Origin/Referer => not a stateful frontend request => no session, no cookie.
        $response = $this->postJson('/api/v1/admin/auth/login', $this->loginPayload($admin));

        $response->assertStatus(400);
        $this->assertGuest();
    }

    public function test_an_unconfigured_origin_is_not_treated_as_a_stateful_frontend()
    {
        $admin = $this->admin();

        $response = $this->withHeaders([
            'Origin' => 'https://not-configured.example.com',
            'Referer' => 'https://not-configured.example.com/admin/login',
        ])->postJson('/api/v1/admin/auth/login', $this->loginPayload($admin));

        $response->assertStatus(400);
        $this->assertGuest();
    }

    /*
    |--------------------------------------------------------------------------
    | Admin login
    |--------------------------------------------------------------------------
    */

    public function test_admin_login_succeeds_for_an_admin_user()
    {
        $admin = $this->admin();

        $response = $this->asAdminSpa()->postJson('/api/v1/admin/auth/login', $this->loginPayload($admin));

        $response->assertOk();
        $response->assertJsonPath('message', 'Logged in successfully.');
        $response->assertJsonPath('user.id', $admin->id);
        $response->assertJsonPath('user.email', $admin->email);
        $response->assertJsonPath('user.role', User::ROLE_ADMIN);

        // The Admin SPA authenticates with a session cookie, never with a personal access token.
        $this->assertArrayNotHasKey('access_token', $response->json());
        $this->assertDatabaseCount('personal_access_tokens', 0);

        // A session cookie must be issued so the browser can keep the session.
        $response->assertCookie(config('session.cookie'));

        $this->assertAuthenticatedAs($admin);
    }

    public function test_admin_login_is_rejected_for_a_normal_user()
    {
        $user = User::factory()->create([
            'role' => User::ROLE_USER,
            'password' => Hash::make(self::ADMIN_PASSWORD),
        ]);

        $response = $this->asAdminSpa()->postJson('/api/v1/admin/auth/login', $this->loginPayload($user));

        $response->assertStatus(403);
        $response->assertJsonPath('message', 'This account does not have administrator access.');
        $this->assertArrayNotHasKey('access_token', $response->json());

        // A rejected non-admin account must not keep a usable session.
        $this->assertGuest();
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_admin_login_is_rejected_with_invalid_credentials()
    {
        $this->admin();

        $response = $this->asAdminSpa()->postJson('/api/v1/admin/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'totally-wrong-password',
        ]);

        $response->assertStatus(401);
        $response->assertJsonPath('message', 'Invalid credentials.');
        $this->assertGuest();
    }

    public function test_admin_login_does_not_reveal_whether_an_email_exists()
    {
        $this->admin();

        // Existing email with a wrong password.
        $wrongPassword = $this->asAdminSpa()->postJson('/api/v1/admin/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'totally-wrong-password',
        ]);

        // Email with no account at all.
        $unknownEmail = $this->asAdminSpa()->postJson('/api/v1/admin/auth/login', [
            'email' => 'nobody@example.com',
            'password' => 'totally-wrong-password',
        ]);

        $wrongPassword->assertStatus(401);
        $unknownEmail->assertStatus(401);
        $this->assertSame(
            $wrongPassword->json('message'),
            $unknownEmail->json('message'),
            'Credential failures must not disclose whether the email exists.'
        );
    }

    public function test_admin_login_validates_its_input()
    {
        $response = $this->asAdminSpa()->postJson('/api/v1/admin/auth/login', [
            'email' => 'not-an-email',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_admin_login_is_throttled_after_repeated_attempts()
    {
        $this->admin();

        $payload = $this->loginPayload(null, 'totally-wrong-password');

        for ($attempt = 1; $attempt <= 10; $attempt++) {
            $this->asAdminSpa()
                ->postJson('/api/v1/admin/auth/login', $payload)
                ->assertStatus(401);
        }

        $throttled = $this->asAdminSpa()->postJson('/api/v1/admin/auth/login', $payload);

        $throttled->assertStatus(429);
        $throttled->assertJsonPath('message', 'Too many login attempts. Please try again shortly.');
        $throttled->assertHeader('Retry-After');
        $this->assertGuest();
    }

    public function test_throttling_a_client_does_not_lock_out_other_accounts()
    {
        $admin = $this->admin();

        for ($attempt = 1; $attempt <= 10; $attempt++) {
            $this->asAdminSpa()->postJson('/api/v1/admin/auth/login', [
                'email' => 'someone-else@example.com',
                'password' => 'totally-wrong-password',
            ])->assertStatus(401);
        }

        // The limiter is keyed by email + IP, so the real admin account is unaffected.
        $this->asAdminSpa()
            ->postJson('/api/v1/admin/auth/login', $this->loginPayload($admin))
            ->assertOk();
    }

    /*
    |--------------------------------------------------------------------------
    | Admin session user endpoint
    |--------------------------------------------------------------------------
    */

    public function test_admin_auth_user_returns_the_authenticated_admin()
    {
        $admin = $this->admin();

        $response = $this->asAdminSpa()->actingAs($admin)->getJson('/api/v1/admin/auth/user');

        $response->assertOk();
        $response->assertJsonPath('user.id', $admin->id);
        $response->assertJsonPath('user.email', $admin->email);
        $response->assertJsonPath('user.role', User::ROLE_ADMIN);
        $this->assertArrayNotHasKey('password', $response->json('user'));
    }

    public function test_admin_auth_user_rejects_a_normal_user()
    {
        $user = User::factory()->create(['role' => User::ROLE_USER]);

        $this->asAdminSpa()
            ->actingAs($user)
            ->getJson('/api/v1/admin/auth/user')
            ->assertStatus(403);
    }

    public function test_admin_auth_user_rejects_an_unauthenticated_request()
    {
        $this->asAdminSpa()->getJson('/api/v1/admin/auth/user')->assertStatus(401);
        $this->getJson('/api/v1/admin/auth/user')->assertStatus(401);
    }

    /*
    |--------------------------------------------------------------------------
    | Session lifecycle (cookie round-trip)
    |--------------------------------------------------------------------------
    */

    public function test_a_stateful_login_establishes_a_reusable_session()
    {
        $admin = $this->admin();

        $login = $this->asAdminSpa()->postJson('/api/v1/admin/auth/login', $this->loginPayload($admin));
        $login->assertOk();

        $sessionCookie = $login->getCookie(config('session.cookie'));
        $this->assertNotNull($sessionCookie, 'The stateful admin login must issue a session cookie.');

        // Drop in-memory guard state so the next request can only rely on the session cookie.
        $this->app['auth']->forgetGuards();

        $this->withCookie(config('session.cookie'), $sessionCookie->getValue())
            ->asAdminSpa()
            ->getJson('/api/v1/admin/auth/user')
            ->assertOk()
            ->assertJsonPath('user.email', $admin->email);
    }

    public function test_admin_logout_ends_the_session()
    {
        $admin = $this->admin();

        $login = $this->asAdminSpa()->postJson('/api/v1/admin/auth/login', $this->loginPayload($admin));
        $login->assertOk();

        $sessionCookie = $login->getCookie(config('session.cookie'));
        $this->assertNotNull($sessionCookie);

        $this->app['auth']->forgetGuards();

        $this->withCookie(config('session.cookie'), $sessionCookie->getValue())
            ->asAdminSpa()
            ->postJson('/api/v1/admin/auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Logged out successfully.');

        // The invalidated session must no longer authenticate anything.
        $this->app['auth']->forgetGuards();

        $this->withCookie(config('session.cookie'), $sessionCookie->getValue())
            ->asAdminSpa()
            ->getJson('/api/v1/admin/auth/user')
            ->assertStatus(401);
    }

    public function test_admin_logout_works_without_a_personal_access_token()
    {
        $admin = $this->admin();

        // Session-authenticated request: Sanctum resolves a non-persisted TransientToken,
        // so logout must not attempt to delete it.
        $this->asAdminSpa()
            ->actingAs($admin)
            ->postJson('/api/v1/admin/auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Logged out successfully.');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_admin_logout_does_not_revoke_other_devices_tokens()
    {
        $admin = $this->admin();
        $androidToken = $admin->createToken('android-app')->plainTextToken;

        $this->asAdminSpa()
            ->actingAs($admin)
            ->postJson('/api/v1/admin/auth/logout')
            ->assertOk();

        // Logging out of the Admin SPA must not sign the Android client out.
        $this->assertDatabaseHas('personal_access_tokens', ['tokenable_id' => $admin->id]);
        $this->withToken($androidToken)->getJson('/api/v1/auth/user')->assertOk();
    }

    public function test_admin_logout_revokes_a_bearer_token_when_one_is_present()
    {
        $admin = $this->admin();
        $token = $admin->createToken('admin-tooling')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/admin/auth/logout')->assertOk();

        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $admin->id]);
    }

    public function test_admin_logout_requires_authentication()
    {
        $this->asAdminSpa()->postJson('/api/v1/admin/auth/logout')->assertStatus(401);
    }

    /*
    |--------------------------------------------------------------------------
    | Android bearer-token flow must be unchanged
    |--------------------------------------------------------------------------
    */

    public function test_android_bearer_authentication_still_works()
    {
        $user = User::factory()->create([
            'role' => User::ROLE_USER,
            'password' => Hash::make('android-password-123'),
        ]);

        CatalogMedicine::factory()->create(['is_active' => true]);

        // Token login (no Origin/Referer, exactly like the Android OkHttp client).
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'android-password-123',
        ]);

        $login->assertOk();
        $login->assertJsonStructure(['message', 'access_token', 'user']);

        // Bearer requests are not stateful, so no session cookie is issued to the app.
        $this->assertNull($login->getCookie(config('session.cookie')));

        $token = $login->json('access_token');

        $this->withToken($token)->getJson('/api/v1/auth/user')
            ->assertOk()
            ->assertJsonPath('user.email', $user->email);

        $this->withToken($token)->getJson('/api/v1/catalog/medicines')
            ->assertOk()
            ->assertJsonStructure(['data', 'meta', 'links']);
    }

    public function test_android_logout_still_revokes_its_token()
    {
        $user = User::factory()->create([
            'role' => User::ROLE_USER,
            'password' => Hash::make('android-password-123'),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'android-password-123',
        ]);

        $token = $login->json('access_token');

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();

        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $user->id]);

        // Sanctum's RequestGuard caches the resolved user for the lifetime of the test
        // application, so forget guards before asserting the revoked token is rejected.
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->getJson('/api/v1/auth/user')->assertStatus(401);
    }

    /*
    |--------------------------------------------------------------------------
    | Existing admin catalog API authorisation is unchanged
    |--------------------------------------------------------------------------
    */

    public function test_admin_catalog_endpoints_remain_protected()
    {
        $admin = $this->admin();
        $user = User::factory()->create(['role' => User::ROLE_USER]);

        $userToken = $user->createToken('android-app')->plainTextToken;
        $adminToken = $admin->createToken('android-app')->plainTextToken;

        // Anonymous.
        $this->getJson('/api/v1/admin/catalog/medicines')->assertStatus(401);

        // Normal user, token and session. Guards are forgotten between identities because
        // Sanctum's RequestGuard caches the resolved user within the test application.
        $this->withToken($userToken)->getJson('/api/v1/admin/catalog/medicines')->assertStatus(403);
        $this->withToken($userToken)->postJson('/api/v1/admin/catalog/medicines', ['name' => 'Blocked'])->assertStatus(403);

        $this->app['auth']->forgetGuards();

        $this->asAdminSpa()->actingAs($user)->getJson('/api/v1/admin/catalog/medicines')->assertStatus(403);

        // Admin, token and session (the SPA path must work against the existing catalog API).
        $this->app['auth']->forgetGuards();

        $this->withToken($adminToken)->getJson('/api/v1/admin/catalog/medicines')->assertOk();

        $this->app['auth']->forgetGuards();

        $this->asAdminSpa()->actingAs($admin)->getJson('/api/v1/admin/catalog/medicines')->assertOk();
    }
}
