import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteCatalogMedicine, updateCatalogMedicineStatus } from '../api/catalogApi'

const catalogQueriesKey = ['admin', 'catalog'] as const

/**
 * `PATCH /admin/catalog/medicines/{id}/status`. Non-optimistic: the UI only reflects the
 * new status after the server confirms and the list query is refetched.
 */
export function useCatalogStatusMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateCatalogMedicineStatus(id, isActive),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: catalogQueriesKey })
        },
    })
}

/** `DELETE /admin/catalog/medicines/{id}` (backend soft delete). */
export function useDeleteCatalogMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: number) => deleteCatalogMedicine(id),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: catalogQueriesKey })
        },
    })
}