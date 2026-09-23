<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RevokesCurrentAccessToken;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Session (cookie) authentication for the first-party Admin SPA.
 *
 * The Android client keeps using `AuthController` (Sanctum personal access tokens).
 * This controller never issues a personal access token; it authenticates administrators
 * through Laravel's `web` session guard so the SPA can rely on the httpOnly session
 * cookie plus CSRF protection.
 *
 * Authorization is enforced by `AdminMiddleware` (and the FormRequests) on the admin API,
 * so `user()` is deliberately thin — it only reports who the current session is.
 */
class AdminAuthController extends Controller
{
    use RevokesCurrentAccessToken;

    public function login(Request $request): JsonResponse
    {
        // Session authentication is only meaningful for first-party (stateful) requests.
        // Requests without a session cannot receive a cookie, so fail loudly instead of
        // returning a success that silently does not authenticate anything.
        if (! $request->hasSession()) {
            return response()->json([
                'message' => 'Admin authentication requires a stateful first-party request. '
                    .'Request GET /sanctum/csrf-cookie from an origin listed in SANCTUM_STATEFUL_DOMAINS first.',
            ], 400);
        }

        $credentials = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::guard('web')->attempt($credentials)) {
            return response()->json([
                'message' => 'Invalid credentials.',
            ], 401);
        }

        $user = Auth::guard('web')->user();

        if (! $user instanceof User || ! $user->isAdmin()) {
            // A valid non-admin account must never keep a usable session.
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->json([
                'message' => 'This account does not have administrator access.',
            ], 403);
        }

        // Session fixation protection.
        $request->session()->regenerate();

        return response()->json([
            'message' => 'Logged in successfully.',
            'user' => $user,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        if (Auth::guard('web')->check()) {
            Auth::guard('web')->logout();
        }

        // Never call currentAccessToken()->delete() unconditionally: session requests
        // carry a TransientToken (or no token at all), which is not a persisted model.
        $this->revokeCurrentAccessToken($request);

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    public function user(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $request->user(),
        ]);
    }
}
