import { Card, CardBody } from '@/components/ui/Card'

/**
 * Placeholder for the three dashboard stat cards while the statistics load — mirrors the
 * real grid exactly so there is no layout jump.
 */
export function DashboardStatsSkeleton() {
    return (
        <section aria-label="Catalog statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
                <Card key={index}>
                    <CardBody className="space-y-4">
                        <div className="flex items-center gap-3" aria-hidden="true">
                            <div className="h-10 w-10 animate-pulse rounded-lg bg-surface-muted" />
                            <div className="h-3.5 w-24 animate-pulse rounded bg-surface-muted" />
                        </div>
                        <div className="space-y-2" aria-hidden="true">
                            <div className="h-8 w-16 animate-pulse rounded bg-surface-muted" />
                            <div className="h-3 w-40 animate-pulse rounded bg-surface-muted" />
                        </div>
                    </CardBody>
                </Card>
            ))}
        </section>
    )
}