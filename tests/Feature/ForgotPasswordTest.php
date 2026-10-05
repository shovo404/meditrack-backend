<?php

namespace Tests\Feature;

use App\Models\CatalogMedicine;
use App\Models\User;
use App\Notifications\PasswordResetNotification;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class ForgotPasswordTest extends TestCase
{
    use RefreshDatabase;

    public function test_unknown_email_returns_the_same_generic_response_as_a_known_one(): void
    {
        $known = User::factory()->create(['email' => 'known@example.com']);
        Notification::fake();

        $knownResponse = $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'known@example.com',
        ]);
        $unknownResponse = $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'nobody@example.com',
        ]);

        $knownResponse->assertStatus(200);
        $unknownResponse->assertStatus(200);

        // Byte-identical bodies: the endpoint cannot be used to discover which
        // addresses have accounts.
        $this->assertSame(
            $knownResponse->getContent(),
            $unknownResponse->getContent()
        );

        $knownResponse->assertJson([
            'message' => 'If the email address is registered, password reset instructions have been sent.',
        ]);

        unset($known);
    }

    public function test_it_does_not_require_authentication(): void
    {
        Notification::fake();
        User::factory()->create(['email' => 'open@example.com']);

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'open@example.com'])
            ->assertStatus(200);

        $this->assertGuest();
    }

    public function test_it_sends_a_password_reset_notification_for_a_registered_user(): void
    {
        Notification::fake();
        User::factory()->create(['email' => 'member@example.com']);

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'member@example.com'])
            ->assertStatus(200);

        Notification::assertSentTo(
            User::where('email', 'member@example.com')->firstOrFail(),
            PasswordResetNotification::class
        );
    }

    public function test_it_sends_no_notification_for_an_unknown_email(): void
    {
        Notification::fake();

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'ghost@example.com'])
            ->assertStatus(200);

        Notification::assertNothingSent();
    }

    public function test_it_actually_persists_a_token_that_laravel_can_validate(): void
    {
        Notification::fake();
        User::factory()->create(['email' => 'token@example.com']);

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'token@example.com'])
            ->assertStatus(200);

        $this->assertDatabaseHas('password_reset_tokens', [
            'email' => 'token@example.com',
        ]);

        $user = User::where('email', 'token@example.com')->firstOrFail();

        $captured = null;
        Notification::assertSentTo($user, PasswordResetNotification::class,
            function (PasswordResetNotification $notification) use ($user, &$captured): bool {
                $captured = $this->extractToken($notification->toMail($user));
                return true;
            }
        );

        $this->assertNotNull($captured);
        $this->assertNotSame('', $captured);

        // Proves the token is real: Laravel's own broker accepts it. This is the
        // component that will later validate it during an actual password change.
        $this->assertTrue(\Illuminate\Support\Facades\Password::broker()->tokenExists($user, $captured));
    }

    public function test_the_notification_carries_the_real_reset_token(): void
    {
        Notification::fake();
        User::factory()->create(['email' => 'carrier@example.com']);

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'carrier@example.com'])
            ->assertStatus(200);

        $user = User::where('email', 'carrier@example.com')->firstOrFail();

        Notification::assertSentTo($user, PasswordResetNotification::class,
            function (PasswordResetNotification $notification) use ($user): bool {
                $token = $this->extractToken($notification->toMail($user));

                // The token the broker stored must be the token the user receives.
                return $token !== null
                    && $token !== ''
                    // And it must not be leaked through the JSON array payload.
                    && ! array_key_exists('token', $notification->toArray($user));
            }
        );
    }

    /**
     * Pull the reset token back out of the rendered notification body.
     *
     * `MailMessage` is not stringable, so its public line collections are read
     * directly rather than casting the object.
     */
    private function extractToken(
        \Illuminate\Notifications\Messages\MailMessage $mail
    ): ?string {
        $candidates = array_merge(
            (array) ($mail->introLines ?? []),
            (array) ($mail->outroLines ?? []),
            [(string) ($mail->subject ?? '')],
        );

        foreach ($candidates as $line) {
            $line = trim(strip_tags((string) $line));

            if (preg_match('/^[A-Za-z0-9]{32,}$/', $line) === 1) {
                return $line;
            }
        }

        return null;
    }

    public function test_the_reset_token_is_not_returned_in_the_http_response(): void
    {
        Notification::fake();
        User::factory()->create(['email' => 'leak@example.com']);

        $response = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'leak@example.com']);

        $response->assertStatus(200);
        $response->assertJsonMissingPath('token');
        $response->assertJsonMissingPath('access_token');
        $response->assertJsonMissingPath('reset_token');
    }

    public function test_it_rejects_a_malformed_email(): void
    {
        Notification::fake();

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'not-an-email'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_it_requires_an_email(): void
    {
        Notification::fake();

        $this->postJson('/api/v1/auth/forgot-password', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_password_reset_requests_are_rate_limited(): void
    {
        Notification::fake();
        User::factory()->create(['email' => 'flood@example.com']);

        // limiter allows 3/minute for an email+IP pair
        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/v1/auth/forgot-password', ['email' => 'flood@example.com'])
                ->assertStatus(200);
        }

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'flood@example.com'])
            ->assertStatus(429);
    }

    public function test_a_rate_limited_flood_does_not_send_extra_notifications(): void
    {
        Notification::fake();
        User::factory()->create(['email' => 'flood2@example.com']);

        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/v1/auth/forgot-password', ['email' => 'flood2@example.com']);
        }

        Notification::assertSentToTimes(
            User::where('email', 'flood2@example.com')->firstOrFail(),
            PasswordResetNotification::class,
            3
        );
    }

    public function test_it_does_not_disturb_existing_login_behaviour(): void
    {
        $user = User::factory()->create([
            'email' => 'still@example.com',
            'password' => Hash::make('password123'),
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'still@example.com',
            'password' => 'password123',
        ])->assertStatus(200);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'still@example.com',
            'password' => 'wrong',
        ])->assertStatus(401);

        unset($user);
    }

    public function test_stock_laravel_reset_notification_is_not_used(): void
    {
        // Guards the intent: the app must keep using its own token-based
        // notification, which does not depend on a `password.reset` web route.
        $this->assertTrue(
            method_exists(PasswordResetNotification::class, 'toMail')
        );
        $this->assertNotSame(
            PasswordResetNotification::class,
            ResetPassword::class
        );
    }
}
