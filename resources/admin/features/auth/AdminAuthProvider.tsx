import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, type ReactNode } from 'react'
import { AdminAuthContext, adminSessionQueryKey } from '@/features/auth/authContext'
import type { AdminAuthContextValue, AdminAuthStatus } from '@/features/auth/types'
import { fetchCurrentAdmin, loginAdmin, logoutAdmin } from '@/lib/api/adminApi'
import { ApiError } from '@/lib/api/client'
import type { AdminUser, LoginCredentials } from '@/lib/api/types'

/**
 * Resolves the admin session exactly once per page load (no per-render polling) and
 * exposes a small, typed surface for the rest of the app.
 */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient()

    const session = useQuery({
        queryKey: adminSessionQueryKey,
        queryFn: ({ signal }) => fetchCurrentAdmin(signal),
        // Auth failures must surface immediately: a 401/403 is a state, not a flake.
        retry: false,
        // The session is only ever changed by login/logout on this client.
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    })

    const loginMutation = useMutation({ mutationFn: loginAdmin })
    const logoutMutation = useMutation({ mutationFn: logoutAdmin })

    const login = useCallback(
        async (credentials: LoginCredentials): Promise<AdminUser> => {
            const admin = await loginMutation.mutateAsync(credentials)
            queryClient.setQueryData(adminSessionQueryKey, admin)

            return admin
        },
        [loginMutation, queryClient]
    )

    const logout = useCallback(async (): Promise<void> => {
        try {
            await logoutMutation.mutateAsync()
        } finally {
            // Even if the request failed, drop every trace of the admin session locally.
            queryClient.setQueryData(adminSessionQueryKey, null)
            queryClient.removeQueries({
                queryKey: ['admin'],
                predicate: (query) => query.queryKey[1] !== 'session',
            })
        }
    }, [logoutMutation, queryClient])

    const status = useMemo<AdminAuthStatus>(() => {
        if (session.isPending) {
            return 'loading'
        }

        if (session.isSuccess) {
            return session.data ? 'authenticated' : 'unauthenticated'
        }

        if (session.error instanceof ApiError) {
            if (session.error.isUnauthenticated) {
                return 'unauthenticated'
            }

            if (session.error.isForbidden) {
                return 'forbidden'
            }
        }

        return 'error'
    }, [session.isPending, session.isSuccess, session.data, session.error])

    const value = useMemo<AdminAuthContextValue>(
        () => ({
            status,
            admin: session.data ?? null,
            error: session.error instanceof ApiError ? session.error : null,
            isSubmitting: loginMutation.isPending,
            refresh: () => {
                void session.refetch()
            },
            login,
            logout,
        }),
        [status, session.data, session.error, session.refetch, loginMutation.isPending, login, logout]
    )

    return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}
