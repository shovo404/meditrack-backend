import { PackageOpen, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export interface CatalogEmptyStateProps {
    /** Whether the current criteria narrow the list (search or status filter applied). */
    isFiltered: boolean
    onReset: () => void
}

/** Differentiates "catalog is completely empty" from "nothing matches this search/filter". */
export function CatalogEmptyState({ isFiltered, onReset }: CatalogEmptyStateProps) {
    const Icon = isFiltered ? SearchX : PackageOpen

    return (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Icon aria-hidden="true" className="h-10 w-10 text-muted" />
            <p className="text-base font-medium text-ink">
                {isFiltered ? 'No medicines match your search.' : 'No medicines found.'}
            </p>
            <p className="max-w-md text-sm text-muted">
                {isFiltered
                    ? 'Try a different search term or status, or clear your filters to see the full catalog.'
                    : 'The catalog is empty. New medicines can be added once the Add Medicine form ships in the next phase.'}
            </p>
            {isFiltered ? (
                <Button variant="secondary" onClick={onReset}>
                    Clear filters
                </Button>
            ) : null}
        </div>
    )
}