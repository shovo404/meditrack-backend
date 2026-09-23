<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Model;

trait RevokesCurrentAccessToken
{
    /**
     * Revoke the request's personal access token, if it actually has one.
     *
     * Bearer-token clients (the Android app) authenticate through Sanctum's token guard,
     * so their token is a persisted model that must be deleted on logout.
     *
     * First-party SPA clients (the Admin Panel) authenticate through the session guard.
     * Sanctum represents those requests with a `TransientToken`, which is not backed by
     * the database and therefore must never be deleted. Session requests without an
     * authenticated user resolve `null` as well.
     */
    protected function revokeCurrentAccessToken(Request $request): void
    {
        $token = $request->user()?->currentAccessToken();

        if ($token instanceof Model) {
            $token->delete();
        }
    }
}
