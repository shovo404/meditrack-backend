import { apiFetch } from '@/lib/api/client'
import type { AdminUser, LoginCredentials } from '@/lib/api/types'

/**
 * Endpoints from Phase 2A. The Admin Panel authenticates with the Sanctum session
 * cookie only — no personal access token is ever created or stored by this app.
 */

/** `GET /api/v1/admin/auth/user` — 200 admin, 401 unauthenticated, 403 non-admin. */
export async function fetchCurrentAdmin(signal?: AbortSignal): Promise<AdminUser> {
    const payload = await apiFetch<{ user: AdminUser }>('/admin/auth/user', { signal })

    return payload.user
}

/** `POST /api/v1/admin/auth/login` — administrator-only session login. */
export async function loginAdmin(credentials: LoginCredentials): Promise<AdminUser> {
    const payload = await apiFetch<{ user: AdminUser }>('/admin/auth/login', {
        method: 'POST',
        body: {
            email: credentials.email.trim(),
            password: credentials.password,
        },
    })

    return payload.user
}

/** `POST /api/v1/admin/auth/logout` — ends the session server-side. */
export function logoutAdmin(): Promise<void> {
    return apiFetch<void>('/admin/auth/logout', { method: 'POST' })
}
