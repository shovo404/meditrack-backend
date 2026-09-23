<?php

namespace App\Providers;

use Closure;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * How many admin login attempts are allowed per minute, per email + IP pair.
     *
     * Deliberately generous enough for manual development/testing while still making
     * credential brute forcing impractical (default: 10 attempts/minute per account+IP;
     * successful logins count towards the limit as well).
     */
    private const ADMIN_LOGIN_MAX_ATTEMPTS_PER_MINUTE = 10;

    /**
     * Broad limit for the remaining admin authentication endpoints (per admin or IP).
     */
    private const ADMIN_AUTH_MAX_ATTEMPTS_PER_MINUTE = 120;

    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiters();
    }

    private function configureRateLimiters(): void
    {
        // Admin Panel (first-party SPA) login. Keyed by email + IP so that one account
        // cannot be sprayed from a single client, and one client cannot spray many accounts.
        RateLimiter::for('admin-login', function (Request $request) {
            return Limit::perMinute(self::ADMIN_LOGIN_MAX_ATTEMPTS_PER_MINUTE)
                ->by(Str::transliterate(
                    Str::lower((string) $request->input('email')).'|'.$request->ip()
                ))
                ->response($this->throttleResponse('Too many login attempts. Please try again shortly.'));
        });

        // Authenticated admin auth endpoints (session lookup / logout).
        RateLimiter::for('admin-auth', function (Request $request) {
            return Limit::perMinute(self::ADMIN_AUTH_MAX_ATTEMPTS_PER_MINUTE)
                ->by($request->user()?->getAuthIdentifier() ?: $request->ip())
                ->response($this->throttleResponse('Too many requests. Please slow down.'));
        });
    }

    /**
     * Consistent JSON body for throttled requests, with the standard rate-limit headers.
     */
    private function throttleResponse(string $message): Closure
    {
        return fn (Request $request, array $headers) => response()->json([
            'message' => $message,
        ], 429, $headers);
    }
}
