import { createContext, useContext } from 'react'
import type { AdminAuthContextValue } from '@/features/auth/types'

/** Single source of truth for the cached admin session query. */
export const adminSessionQueryKey = ['admin', 'session'] as const

export const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

export function useAdminAuth(): AdminAuthContextValue {
    const context = useContext(AdminAuthContext)

    if (!context) {
        throw new Error('useAdminAuth() must be used inside an <AdminAuthProvider>.')
    }

    return context
}
