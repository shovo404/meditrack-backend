<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the forgot-password request.
 *
 * There is intentionally no `exists:users,email` rule here. Rejecting unknown
 * addresses with a 422 would turn this endpoint into a user-enumeration oracle,
 * so address validity is checked by format only and existence is resolved
 * internally by the controller.
 */
class ForgotPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
        ];
    }
}
