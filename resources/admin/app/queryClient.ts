import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/client'

/**
 * Query defaults tuned for an admin panel:
 * - never retry auth/validation/permission failures (they are states, not flakes)
 * - retry transient network/5xx failures exactly once
 * - no refetch storm on window focus; mutations are explicit
 */
export function createAdminQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30_000,
                gcTime: 5 * 60_000,
                refetchOnWindowFocus: false,
                retry: (failureCount, error) => {
                    if (failureCount >= 1) {
                        return false
                    }

                    return error instanceof ApiError && (error.isNetworkError || error.isServerError)
                },
            },
            mutations: {
                retry: false,
            },
        },
    })
}
