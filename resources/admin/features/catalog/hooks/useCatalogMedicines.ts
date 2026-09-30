import { useQuery } from '@tanstack/react-query'
import { fetchCatalogMedicines } from '../api/catalogApi'
import type { CatalogListParams, CatalogMedicineList } from '../types'

/**
 * Stable query key for the catalog list. The `admin` prefix lets `AdminAuthProvider.logout`
 * clear every catalog cache entry alongside the rest of the admin queries.
 */
export function catalogQueryKey(params: CatalogListParams): readonly unknown[] {
    return ['admin', 'catalog', 'medicines', params] as const
}

/**
 * Reads a single catalog page from `GET /api/v1/admin/catalog/medicines`.
 *
 * `placeholderData` keeps the previous page on screen while pagination/filter/search
 * refetches, so the UI never flashes skeleton rows for a data change the user just issued.
 */
export function useCatalogMedicines(params: CatalogListParams) {
    return useQuery<CatalogMedicineList, Error>({
        queryKey: catalogQueryKey(params),
        queryFn: ({ signal }) => fetchCatalogMedicines(params, signal),
        // Fail fast and let the CatalogErrorState "Try again" button drive retries instead
        // of hiding failures behind react-query's default ~1s-backoff auto-retries.
        retry: false,
        placeholderData: (previous: CatalogMedicineList | undefined) => previous,
    })
}