import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { CatalogPaginationMeta } from '../types'

export interface CatalogPaginationProps {
    meta: CatalogPaginationMeta
    currentPage: number
    onPageChange: (page: number) => void
}

function pageWindow(currentPage: number, lastPage: number): number[] {
    const range: number[] = []
    const from = Math.max(1, currentPage - 2)
    const to = Math.min(lastPage, currentPage + 2)

    for (let page = from; page <= to; page += 1) {
        range.push(page)
    }

    return range
}

/**
 * Previous/next + a compact numbered window. Buttons are disabled at the edges and the
 * current page is announced. Relies on Laravel's `meta` so no client-side pagination.
 */
export function CatalogPagination({ meta, currentPage, onPageChange }: CatalogPaginationProps) {
    const lastPage = Math.max(1, meta.last_page)
    const clamped = Math.min(currentPage, lastPage)

    if (meta.total === 0) {
        return null
    }

    return (
        <nav aria-label="Catalog pagination" className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
                Page {clamped} of {lastPage}
            </p>

            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onPageChange(clamped - 1)}
                    disabled={clamped <= 1}
                    aria-label="Previous page"
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                    Previous
                </button>

                {lastPage > 1
                    ? pageWindow(clamped, lastPage).map((page) => (
                          <button
                              key={page}
                              type="button"
                              onClick={() => onPageChange(page)}
                              aria-current={page === clamped ? 'page' : undefined}
                              aria-label={`Page ${page}`}
                              className={cn(
                                  'h-9 w-9 rounded-lg text-sm font-medium transition-colors',
                                  page === clamped
                                      ? 'bg-brand-600 text-white'
                                      : 'border border-line bg-surface text-ink hover:bg-surface-muted'
                              )}
                          >
                              {page}
                          </button>
                      ))
                    : null}

                <button
                    type="button"
                    onClick={() => onPageChange(clamped + 1)}
                    disabled={clamped >= lastPage}
                    aria-label="Next page"
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Next
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
            </div>
        </nav>
    )
}