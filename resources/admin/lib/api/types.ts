/** The authenticated administrator, as returned by `GET /api/v1/admin/auth/user`. */
export interface AdminUser {
    id: number
    name: string
    email: string
    role: string
    emailVerifiedAt?: string | null
    createdAt?: string | null
    updatedAt?: string | null
}

export interface LoginCredentials {
    email: string
    password: string
}

/** Laravel's 422 payload shape: `{ field: ["message", ...] }`. */
export type ValidationErrors = Record<string, string[]>

export const ADMIN_ROLE = 'ADMIN'
