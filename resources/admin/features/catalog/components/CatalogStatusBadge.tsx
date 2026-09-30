import { cn } from '@/lib/utils/cn'

/**
 * Status pill. Conveys state with a label, a dot and a ring — never colour alone.
 */
export function CatalogStatusBadge({ isActive, className }: { isActive: boolean; className?: string }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1',
                isActive
                    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800/70'
                    : 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800/70',
                className
            )}
        >
            <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-emerald-500' : 'bg-amber-500')} />
            {isActive ? 'Active' : 'Inactive'}
        </span>
    )
}