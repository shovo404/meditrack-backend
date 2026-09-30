import { Search, X } from 'lucide-react'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils/cn'
import type { CatalogStatusFilter } from '../types'

export interface CatalogFiltersProps {
    search: string
    onSearchChange: (value: string) => void
    status: CatalogStatusFilter
    onStatusChange: (status: CatalogStatusFilter) => void
    /** Total results for the current page's criteria, shown in the summary line. */
    total?: number
    isRefetching: boolean
}

const statusOptions: { value: CatalogStatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
]

/**
 * Search (server-side, debounced upstream) + status filter. Changing either resets the
 * page to 1; the parent owns that URL transition.
 */
export function CatalogFilters({ search, onSearchChange, status, onStatusChange, total, isRefetching }: CatalogFiltersProps) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
                <Field label="Search medicines" className="sm:max-w-sm sm:flex-1">
                    {({ id, describedBy }) => (
                        <div className="relative">
                            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                            <Input
                                id={id}
                                aria-describedby={describedBy}
                                value={search}
                                onChange={(event) => onSearchChange(event.target.value)}
                                placeholder="Name, generic name or manufacturer…"
                                className="pl-9 pr-9"
                            />
                            {search !== '' ? (
                                <button
                                    type="button"
                                    onClick={() => onSearchChange('')}
                                    aria-label="Clear search"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted transition-colors hover:bg-surface-muted hover:text-ink"
                                >
                                    <X aria-hidden="true" className="h-4 w-4" />
                                </button>
                            ) : null}
                        </div>
                    )}
                </Field>

                <fieldset>
                    <legend className="mb-1.5 block text-sm font-medium text-ink">Status</legend>
                    <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
                        {statusOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                aria-pressed={status === option.value}
                                onClick={() => onStatusChange(option.value)}
                                className={cn(
                                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                                    status === option.value
                                        ? 'bg-brand-600 text-white'
                                        : 'text-muted hover:bg-surface-muted hover:text-ink'
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </fieldset>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
                {isRefetching ? <Spinner size="sm" /> : null}
                {typeof total === 'number' && !isRefetching ? (
                    <span>
                        {total} {total === 1 ? 'medicine' : 'medicines'}
                    </span>
                ) : null}
            </div>
        </div>
    )
}