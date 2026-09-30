/** Catalog status shown in the URL (`/admin/catalog?status=active`). */
export type CatalogStatusFilter = 'all' | 'active' | 'inactive'

export interface CatalogMedicine {
    id: number
    name: string
    genericName: string | null
    strength: string | null
    dosageForm: string | null
    manufacturer: string | null
    imageUrl: string | null
    isActive: boolean
    createdAt: string | null
    updatedAt: string | null
}

/** Laravel LengthAwarePaginator `meta` payload, exactly as returned on the wire. */
export interface CatalogPaginationMeta {
    current_page: number
    last_page: number
    per_page: number
    total: number
}

export interface CatalogMedicineList {
    data: CatalogMedicine[]
    meta: CatalogPaginationMeta
}

/** Everything that shapes the server request and therefore the query key. */
export interface CatalogListParams {
    page: number
    search: string
    status: CatalogStatusFilter
    perPage: number
}