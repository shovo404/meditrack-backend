import type { ApiError } from '@/lib/api/client'
import type { AdminUser, LoginCredentials } from '@/lib/api/types'

/**
 * - `loading`       session check in flight (app startup / hard refresh)
 * - `authenticated` signed in as an administrator
 * - `unauthenticated` no valid session (401)
 * - `forbidden`     signed in, but the account is not an administrator (403)
 * - `error`         the session could not be verified (network / server failure)
 */
export type AdminAuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'forbidden' | 'error'

export interface AdminAuthContextValue {
    status: AdminAuthStatus
    admin: AdminUser | null
    error: ApiError | null
    /** True while the login request is in flight. */
    isSubmitting: boolean
    /** Re-run the session check (used by the "try again" states). */
    refresh: () => void
    login: (credentials: LoginCredentials) => Promise<AdminUser>
    logout: () => Promise<void>
}
