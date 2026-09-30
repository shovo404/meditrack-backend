import { useQuery } from '@tanstack/react-query'
import { fetchCatalogMedicine } from '../api/catalogApi'
import type { CatalogMedicine } from '../types'

/**
 * Stable query key for a single catalog medicine, namespaced so a create/update/delete
 * invalidates the edit form's cache alongside the list.
 */
export function catalogMedicineQueryKey(id: number): readonly unknown[] {
    return ['admin', 'catalog', 'medicines', 'detail', id] as const
}

/**
 * Reads one medicine from `GET /api/v1/admin/catalog/medicines/{id}`. Disabled for the
 * create form (no id yet); the caller gates rendering on `isPending`/`error`.
 */
export function useCatalogMedicine(id: number | undefined) {
    return useQuery<CatalogMedicine, Error>({
        queryKey: ['admin', 'catalog', 'medicines', 'detail', id] as const,
        queryFn: ({ signal }) => fetchCatalogMedicine(id as number, signal),
        enabled: id !== undefined,
        // Fail fast and let the inline CatalogErrorState "Try again" button drive retries.
        retry: false,
    })
}