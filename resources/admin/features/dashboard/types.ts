import type { CatalogMedicine } from '@/features/catalog/types'

/**
 * Response of `GET /api/v1/admin/dashboard/stats`.
 *
 * The three counts describe the whole live catalog (soft-deleted rows excluded), so
 * `totalMedicines` always equals `activeMedicines + inactiveMedicines`.
 * `recentlyUpdated` is the same request's answer to the dashboard's "recently updated"
 * list, so no second catalog fetch is needed.
 */
export interface DashboardStats {
    totalMedicines: number
    activeMedicines: number
    inactiveMedicines: number
    recentlyUpdated: CatalogMedicine[]
}