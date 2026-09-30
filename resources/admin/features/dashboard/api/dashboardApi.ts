import { apiFetch } from '@/lib/api/client'
import type { DashboardStats } from '@/features/dashboard/types'

/**
 * `GET /api/v1/admin/dashboard/stats` — whole-catalog counts plus the five most
 * recently updated medicines. Behind `auth:sanctum` + `AdminMiddleware` server-side.
 */
export async function fetchDashboardStats(signal?: AbortSignal): Promise<DashboardStats> {
    return apiFetch<DashboardStats>('/admin/dashboard/stats', { signal })
}