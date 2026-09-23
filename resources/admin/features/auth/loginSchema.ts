import { z } from 'zod'

/**
 * Client-side mirror of the backend login rules. Client validation is for UX only —
 * the Laravel endpoint re-validates everything and stays authoritative.
 */
export const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .min(1, 'Enter your email address.')
        .email('Enter a valid email address.'),
    password: z.string().min(1, 'Enter your password.'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
