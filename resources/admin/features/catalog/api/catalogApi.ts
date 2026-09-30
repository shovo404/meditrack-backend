import { apiFetch } from '@/lib/api/client'
import type { CatalogListParams, CatalogMedicine, CatalogMedicineList } from '../types'

/**
 * Number of catalog rows per page. Kept fixed (matches the backend default) so the
 * pagination page numbers in the URL always line up with the server's pages.
 */
export const CATALOG_PAGE_SIZE = 20

/**
 * Serialise list params into the query string we send to the backend.
 *
 * `status` is a frontend concern (`active`/`inactive`/absent for "all") and is mapped to
 * the backend's `is_active` boolean filter — the field the Laravel index supports.
 */
export function catalogListQueryString({ page, search, status }: CatalogListParams): string {
    const params = new URLSearchParams()

    params.set('page', String(page))
    params.set('per_page', String(CATALOG_PAGE_SIZE))

    const trimmed = search.trim()

    if (trimmed !== '') {
        params.set('search', trimmed)
    }

    if (status !== 'all') {
        params.set('is_active', status === 'active' ? '1' : '0')
    }

    return params.toString()
}

/** `GET /api/v1/admin/catalog/medicines` — server-side search, filter, pagination. */
export async function fetchCatalogMedicines(params: CatalogListParams, signal?: AbortSignal): Promise<CatalogMedicineList> {
    return apiFetch<CatalogMedicineList>(`/admin/catalog/medicines?${catalogListQueryString(params)}`, { signal })
}

/** `PATCH /api/v1/admin/catalog/medicines/{id}/status` — active/inactive toggle. */
export async function updateCatalogMedicineStatus(id: number, isActive: boolean): Promise<CatalogMedicine> {
    const payload = await apiFetch<{ data: CatalogMedicine; message?: string }>(`/admin/catalog/medicines/${id}/status`, {
        method: 'PATCH',
        body: { is_active: isActive },
    })

    return payload.data
}

/** `DELETE /api/v1/admin/catalog/medicines/{id}` — soft delete via the backend. */
export async function deleteCatalogMedicine(id: number): Promise<void> {
    await apiFetch<void>(`/admin/catalog/medicines/${id}`, { method: 'DELETE' })
}