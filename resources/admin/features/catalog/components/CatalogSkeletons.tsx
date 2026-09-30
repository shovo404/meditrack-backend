/** Skeleton placeholders shown only on the very first catalog load (no cached data yet). */
export function CatalogTableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-0" aria-hidden="true">
            {Array.from({ length: rows }, (_, index) => (
                <div
                    key={index}
                    className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-0"
                >
                    <div className="h-10 w-10 animate-pulse rounded-lg bg-surface-muted" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-1/3 animate-pulse rounded bg-surface-muted" />
                        <div className="h-3 w-1/5 animate-pulse rounded bg-surface-muted" />
                    </div>
                    <div className="h-3 w-16 animate-pulse rounded bg-surface-muted" />
                    <div className="ml-auto h-8 w-24 animate-pulse rounded-lg bg-surface-muted" />
                </div>
            ))}
        </div>
    )
}

/** Mobile equivalent: card-shaped skeletons. */
export function CatalogCardsSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="space-y-3" aria-hidden="true">
            {Array.from({ length: rows }, (_, index) => (
                <div key={index} className="rounded-card border border-line bg-surface p-5">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 animate-pulse rounded-lg bg-surface-muted" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3.5 w-1/2 animate-pulse rounded bg-surface-muted" />
                            <div className="h-3 w-1/3 animate-pulse rounded bg-surface-muted" />
                        </div>
                        <div className="h-5 w-16 animate-pulse rounded-full bg-surface-muted" />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted">
                        <div className="h-3 animate-pulse rounded bg-surface-muted" />
                        <div className="h-3 animate-pulse rounded bg-surface-muted" />
                    </div>
                </div>
            ))}
        </div>
    )
}