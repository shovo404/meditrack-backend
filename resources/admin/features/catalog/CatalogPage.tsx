import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ApiError } from '@/lib/api/client'
import { CATALOG_PAGE_SIZE } from './api/catalogApi'
import { CatalogMobileCard } from './components/CatalogMobileCard'
import { CatalogEmptyState } from './components/CatalogEmptyState'
import { CatalogErrorState } from './components/CatalogErrorState'
import { CatalogFilters } from './components/CatalogFilters'
import { CatalogPagination } from './components/CatalogPagination'
import { CatalogCardsSkeleton, CatalogTableSkeleton } from './components/CatalogSkeletons'
import { CatalogTable } from './components/CatalogTable'
import { DeleteCatalogDialog } from './components/DeleteCatalogDialog'
import { StatusChangeDialog } from './components/StatusChangeDialog'
import { useCatalogStatusMutation, useDeleteCatalogMutation } from './hooks/useCatalogMutations'
import { useCatalogMedicines, catalogQueryKey } from './hooks/useCatalogMedicines'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import type { CatalogListParams, CatalogMedicine, CatalogStatusFilter } from './types'

const SEARCH_DEBOUNCE_MS = 350

type Notice = { tone: 'success' | 'error' | 'info'; text: string } | null

function parseStatus(raw: string | null): CatalogStatusFilter {
    return raw === 'active' || raw === 'inactive' ? raw : 'all'
}

/**
 * Phase 2C — Admin Medicine Catalog List.
 *
 * URL is the single source of truth: `/admin/catalog?page=&search=&status=` fully restores
 * the same listing on refresh. The search box writes to the URL on every keystroke but the
 * network request only fires after a debounce; the table renders on desktop/tablet and
 * collapses into cards on phones; search/filter/pagination are all server-side
 * (TanStack Query).
 */
export function CatalogPage() {
    const queryClient = useQueryClient()
    const [searchParams, setSearchParams] = useSearchParams()

    const pageRaw = Number.parseInt(searchParams.get('page') ?? '1', 10)
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
    const searchRaw = searchParams.get('search') ?? ''
    const status = parseStatus(searchParams.get('status'))

    // The box echoes the URL value directly; the query is debounced so we never request
    // the API on every keystroke.
    const debouncedSearch = useDebouncedValue(searchRaw, SEARCH_DEBOUNCE_MS)

    const [statusTarget, setStatusTarget] = useState<{ medicine: CatalogMedicine; targetActive: boolean } | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<CatalogMedicine | null>(null)
    const [notice, setNotice] = useState<Notice>(null)

    const params = useMemo<CatalogListParams>(
        () => ({ page, search: debouncedSearch, status, perPage: CATALOG_PAGE_SIZE }),
        [page, debouncedSearch, status]
    )

    const query = useCatalogMedicines(params)
    const statusMutation = useCatalogStatusMutation()
    const deleteMutation = useDeleteCatalogMutation()

    const medicines = query.data?.data ?? []
    const meta = query.data?.meta ?? null
    const isFiltered = debouncedSearch.trim() !== '' || status !== 'all'

    // Auto-dismiss success notices so stale feedback does not linger.
    useEffect(() => {
        if (!notice) {
            return
        }

        const timer = window.setTimeout(() => setNotice(null), 4000)

        return () => window.clearTimeout(timer)
    }, [notice])

    const updateParams = (updater: (prev: URLSearchParams) => void, replace = false) =>
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            updater(next)

            return next
        }, { replace })

    const handleSearchChange = (value: string) =>
        updateParams(
            (next) => {
                if (value.trim() !== '') {
                    next.set('search', value)
                } else {
                    next.delete('search')
                }

                // Any new query starts at the first page.
                next.delete('page')
            },
            true
        )

    const handleStatusChange = (nextStatus: CatalogStatusFilter) =>
        updateParams((next) => {
            if (nextStatus === 'all') {
                next.delete('status')
            } else {
                next.set('status', nextStatus)
            }

            next.delete('page')
        })

    const handlePageChange = (nextPage: number) =>
        updateParams((next) => {
            next.set('page', String(nextPage))
        })

    const handleResetFilters = () =>
        updateParams((next) => {
            next.delete('search')
            next.delete('status')
            next.delete('page')
        })

    const showMutationError = (error: unknown) => {
        if (error instanceof ApiError && error.isUnauthenticated) {
            setNotice({ tone: 'error', text: 'Your session has expired. Please sign in again.' })
            return
        }

        setNotice({
            tone: 'error',
            text:
                error instanceof ApiError
                    ? error.message
                    : 'The request could not be completed. Please try again.',
        })
    }

    const handleStatusConfirm = async () => {
        if (!statusTarget) {
            return
        }

        const { medicine, targetActive } = statusTarget

        try {
            await statusMutation.mutateAsync({ id: medicine.id, isActive: targetActive })
            setNotice({
                tone: 'success',
                text: `“${medicine.name}” is now ${targetActive ? 'active' : 'inactive'} in the catalog.`,
            })
        } catch (error) {
            showMutationError(error)
        } finally {
            setStatusTarget(null)
        }
    }

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) {
            return
        }

        const medicine = deleteTarget
        const cached = queryClient.getQueryData<{ data: CatalogMedicine[] }>(catalogQueryKey(params))
        const rowsOnPage = cached?.data.length ?? 0

        try {
            await deleteMutation.mutateAsync(medicine.id)
            setNotice({ tone: 'success', text: `“${medicine.name}” was removed from the global catalog.` })
        } catch (error) {
            showMutationError(error)
        } finally {
            setDeleteTarget(null)
        }

        // Deleting the last row of a later page would strand the user on an empty page.
        if (rowsOnPage === 1 && page > 1) {
            handlePageChange(page - 1)
        }
    }

    const renderContent = () => {
        if (query.isPending) {
            return (
                <div className="relative">
                    <p role="status" className="sr-only">
                        Loading catalog
                    </p>
                    <div className="hidden md:block">
                        <CatalogTableSkeleton />
                    </div>
                    <div className="md:hidden">
                        <CatalogCardsSkeleton />
                    </div>
                </div>
            )
        }

        if (query.error) {
            return <CatalogErrorState error={query.error as ApiError} onRetry={() => void query.refetch()} />
        }

        if (medicines.length === 0) {
            return <CatalogEmptyState isFiltered={isFiltered} onReset={handleResetFilters} />
        }

        return (
            <div className="space-y-4">
                <div className="hidden md:block overflow-x-auto">
                    <CatalogTable
                        medicines={medicines}
                        onActivate={(medicine) => setStatusTarget({ medicine, targetActive: true })}
                        onDeactivate={(medicine) => setStatusTarget({ medicine, targetActive: false })}
                        onDelete={(medicine) => setDeleteTarget(medicine)}
                    />
                </div>

                <div className="space-y-3 md:hidden">
                    {medicines.map((medicine) => (
                        <CatalogMobileCard
                            key={medicine.id}
                            medicine={medicine}
                            onActivate={(item) => setStatusTarget({ medicine: item, targetActive: true })}
                            onDeactivate={(item) => setStatusTarget({ medicine: item, targetActive: false })}
                            onDelete={(item) => setDeleteTarget(item)}
                        />
                    ))}
                </div>

                {meta ? <CatalogPagination meta={meta} currentPage={page} onPageChange={handlePageChange} /> : null}
            </div>
        )
    }

    return (
        <div className="space-y-6" aria-busy={query.isPending || undefined}>
            <PageHeader
                title="Medicine Catalog"
                description="The global medicine catalog that MediTrack clients synchronise from. Admin actions only affect catalog data — never user medicine records."
                actions={
                    <Button onClick={() => setNotice({ tone: 'info', text: 'Add Medicine arrives in the next phase.' })}>
                        <Plus aria-hidden="true" className="h-4 w-4" />
                        Add Medicine
                    </Button>
                }
            />

            {notice ? (
                <Alert tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>
                    {notice.text}
                </Alert>
            ) : null}

            <Card>
                <CatalogFilters
                    search={searchRaw}
                    onSearchChange={handleSearchChange}
                    status={status}
                    onStatusChange={handleStatusChange}
                    total={meta?.total}
                    isRefetching={query.isFetching && !query.isPending}
                />
            </Card>

            <Card>{renderContent()}</Card>

            <StatusChangeDialog
                medicine={statusTarget?.medicine ?? null}
                targetActive={statusTarget?.targetActive ?? false}
                open={statusTarget !== null}
                onClose={() => setStatusTarget(null)}
                onConfirm={() => void handleStatusConfirm()}
                isSubmitting={statusMutation.isPending}
            />

            <DeleteCatalogDialog
                medicine={deleteTarget}
                open={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                onConfirm={() => void handleDeleteConfirm()}
                isSubmitting={deleteMutation.isPending}
            />
        </div>
    )
}