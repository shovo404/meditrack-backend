import { apiFetch } from '@/lib/api/client'
import type { CatalogListParams, CatalogMedicine, CatalogMedicineDraft, CatalogMedicineList } from '../types'

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

/** `GET /api/v1/admin/catalog/medicines/{id}` — single medicine for the edit form. */
export async function fetchCatalogMedicine(id: number, signal?: AbortSignal): Promise<CatalogMedicine> {
    const payload = await apiFetch<{ data: CatalogMedicine }>(`/admin/catalog/medicines/${id}`, { signal })

    return payload.data
}

/**
 * Maps the form draft onto the `multipart/form-data` body the Laravel store/update
 * endpoints expect. Empty strings are sent as absent fields (the backend treats them as
 * `null`); `is_active` uses the backend's boolean-distinguishing `1`/`0`. `apiFetch`
 * keeps multipart bodies untouched so the browser sets the boundary.
 */
export function catalogMedicineFormData(draft: CatalogMedicineDraft): FormData {
    const form = new FormData()

    form.set('name', draft.name)

    for (const [key, value] of [
        ['generic_name', draft.genericName],
        ['strength', draft.strength],
        ['dosage_form', draft.dosageForm],
        ['manufacturer', draft.manufacturer],
    ] as const) {
        if (value.trim() !== '') {
            form.set(key, value)
        }
    }

    form.set('is_active', draft.isActive ? '1' : '0')

    return form
}

/** `POST /api/v1/admin/catalog/medicines` — create (optionally with an image file). */
export async function createCatalogMedicine(draft: CatalogMedicineDraft, image: File | null): Promise<CatalogMedicine> {
    const body = catalogMedicineFormData(draft)

    if (image) {
        body.set('image', image, image.name)
    }

    const payload = await apiFetch<{ data: CatalogMedicine }>('/admin/catalog/medicines', {
        method: 'POST',
        body,
    })

    return payload.data
}

/**
 * `PUT /api/v1/admin/catalog/medicines/{id}` — update. When a new image file is supplied
 * it travels inside the same multipart body and the backend replaces the stored file.
 */
export async function updateCatalogMedicine(
    id: number,
    draft: CatalogMedicineDraft,
    image: File | null
): Promise<CatalogMedicine> {
    const body = catalogMedicineFormData(draft)

    if (image) {
        body.set('image', image, image.name)
    }

    const payload = await apiFetch<{ data: CatalogMedicine }>(`/admin/catalog/medicines/${id}`, {
        method: 'PUT',
        body,
    })

    return payload.data
}

/**
 * `PATCH /api/v1/admin/catalog/medicines/{id}/image` — removes the stored image only
 * (never the medicine). Kept separate from the text-field update endpoint per the
 * Laravel contract (`remove_image` + `prohibits:image`).
 */
export async function removeCatalogMedicineImage(id: number): Promise<CatalogMedicine> {
    const payload = await apiFetch<{ data: CatalogMedicine }>(`/admin/catalog/medicines/${id}/image`, {
        method: 'PATCH',
        body: { remove_image: true },
    })

    return payload.data
}