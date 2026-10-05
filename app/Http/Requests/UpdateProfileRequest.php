<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    /**
     * The route already sits behind `auth:sanctum`, and the controller only ever updates
     * `$request->user()`. Ownership therefore comes from the bearer token and can never be
     * influenced by request input.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * The editable profile surface is deliberately minimal: only `name`.
     *
     * Fields that are never client-writable are declared `prohibited` rather than silently
     * ignored, so a caller cannot believe it changed something it did not.
     *
     * - `role` decides admin access, so it is never accepted from the client.
     * - `id` / `user_id` would let a caller aim the update at another account.
     * - `email` has no verification flow yet, so changing it here would let a user take an
     *   address they cannot prove they own.
     *
     * `validated()` therefore only ever contains `name`, and the controller cannot be made to
     * fill anything else even if it tried.
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'role' => ['prohibited'],
            'email' => ['prohibited'],
            'id' => ['prohibited'],
            'user_id' => ['prohibited'],
        ];
    }
}
