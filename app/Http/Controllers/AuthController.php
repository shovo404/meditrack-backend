<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RevokesCurrentAccessToken;
use App\Http\Requests\ForgotPasswordRequest;
use App\Notifications\PasswordResetNotification;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;

class AuthController extends Controller
{
    use RevokesCurrentAccessToken;

    /**
     * The response body shape shared by `register()` and `login()`.
     *
     * The Android client (`AuthResponse`) reads `access_token` + `user` from both
     * endpoints and only promotes the session to `Authenticated` when a token is
     * present. Returning the identical structure from both flows is what keeps
     * "registration succeeded" and "the user is actually signed in" the same event.
     *
     * @return array<string, mixed>
     */
    private function authenticatedSessionPayload(User $user, string $message): array
    {
        return [
            'message' => $message,
            'access_token' => $user->createToken('auth_token')->plainTextToken,
            'token_type' => 'Bearer',
            'user' => $user,
        ];
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            // Explicitly derived, never taken from the request body, so a
            // `role: ADMIN` payload can never escalate the new account.
            'role' => User::ROLE_USER,
        ]);

        event(new Registered($user));

        return response()->json(
            $this->authenticatedSessionPayload($user, 'User registered successfully.'),
            201
        );
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Invalid credentials.'
            ], 401);
        }

        return response()->json(
            $this->authenticatedSessionPayload($user, 'Logged in successfully.')
        );
    }

    /**
     * Issue a password reset token.
     *
     * Always answers 200 with the same body, whether or not the address is
     * registered, so this endpoint cannot be used to discover which email
     * addresses have accounts. The token itself is minted by Laravel's password
     * broker (the component that actually stores and validates it) and delivered
     * out-of-band; it is never returned in this response.
     */
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $email = $request->validated()['email'];

        $user = User::where('email', $email)->first();

        if ($user) {
            // Laravel's broker mints *and persists* the token, so it stays the
            // single source of truth for reset tokens. `createToken()` returns
            // the plaintext token directly.
            $token = Password::broker()->createToken($user);

            if (is_string($token) && $token !== '') {
                // Sent synchronously so it does not depend on a queue worker.
                // A delivery failure is logged rather than surfaced, because
                // reporting it back would re-introduce the enumeration oracle.
                try {
                    Notification::send($user, new PasswordResetNotification($token, $email));
                } catch (\Throwable $e) {
                    Log::error('Password reset notification delivery failed.', [
                        'user_id' => $user->id,
                        'exception' => $e->getMessage(),
                    ]);
                }
            } else {
                Log::warning('Password reset token could not be created.', [
                    'user_id' => $user->id,
                ]);
            }
        }

        return response()->json([
            'message' => 'If the email address is registered, password reset instructions have been sent.',
        ]);
    }

    public function logout(Request $request)
    {
        // Token clients (Android) revoke their personal access token here. The call is
        // guarded so session-authenticated first-party requests cannot crash on a null
        // or non-persisted (TransientToken) current access token.
        $this->revokeCurrentAccessToken($request);

        return response()->json([
            'message' => 'Logged out successfully.'
        ]);
    }

    public function user(Request $request)
    {
        return response()->json([
            'user' => $request->user()
        ]);
    }
}
