<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateProfileRequest;

class ProfileController extends Controller
{
    /**
     * Update the authenticated user's own profile.
     *
     * The target row is always `$request->user()`. No identifier is read from the request,
     * so this endpoint cannot be redirected at another account. `UpdateProfileRequest`
     * additionally rejects `id`, `user_id`, `role` and `email` outright, and
     * `$request->validated()` returns only `name` — so the mass assignment below is
     * restricted to that single column.
     */
    public function update(UpdateProfileRequest $request)
    {
        $user = $request->user();

        $user->update($request->validated());

        // `fresh()` guarantees the response reflects exactly what is now persisted,
        // including the new updated_at that clients use for reconciliation.
        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => $user->fresh(),
        ]);
    }
}
