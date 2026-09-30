import { useQuery } from '@tanstack/react-query'
import { fetchDashboardStats } from '@/features/dashboard/api/dashboardApi'

/** Single source of truth for the dashboard statistics query. */
export const dashboardStatsQueryKey = ['admin', 'dashboard', 'stats'] as const

/**
 * Dashboard statistics. `retry: false` mirrors the other admin data hooks (the catalog
 * list): a failed stats load surfaces immediately with a scoped error and a Retry
 * button, rather than stalling behind an automatic backoff retry.
 */
export function useDashboardStats() {
    return useQuery({
        queryKey: dashboardStatsQueryKey,
        queryFn: ({ signal }) => fetchDashboardStats(signal),
        retry: false,
    })
}