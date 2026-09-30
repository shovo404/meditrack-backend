import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
    createCatalogMedicine,
    deleteCatalogMedicine,
    removeCatalogMedicineImage,
    updateCatalogMedicine,
    updateCatalogMedicineStatus,
} from '../api/catalogApi'
import type { CatalogMedicineDraft } from '../types'

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

/** `POST /admin/catalog/medicines` — create (optionally with an image file). */
export function useCreateCatalogMedicineMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ draft, image }: { draft: CatalogMedicineDraft; image: File | null }) =>
            createCatalogMedicine(draft, image),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: catalogQueriesKey })
        },
    })
}

/** `PUT /admin/catalog/medicines/{id}` — update text fields and/or replace the image. */
export function useUpdateCatalogMedicineMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, draft, image }: { id: number; draft: CatalogMedicineDraft; image: File | null }) =>
            updateCatalogMedicine(id, draft, image),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: catalogQueriesKey })
        },
    })
}

/** `PATCH /admin/catalog/medicines/{id}/image` — remove the stored image only. */
export function useRemoveCatalogMedicineImageMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: number) => removeCatalogMedicineImage(id),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: catalogQueriesKey })
        },
    })
}