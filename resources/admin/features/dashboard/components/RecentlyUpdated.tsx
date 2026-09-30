import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CatalogImage } from '@/features/catalog/components/CatalogImage'
import { CatalogStatusBadge } from '@/features/catalog/components/CatalogStatusBadge'
import { formatCatalogDate, orDash } from '@/features/catalog/lib/format'
import type { CatalogMedicine } from '@/features/catalog/types'

export interface RecentlyUpdatedProps {
    medicines: CatalogMedicine[]
    onViewAll: () => void
}

/**
 * The most recently changed medicines, straight from the dashboard statistics response —
 * reused catalog data, no second fetch. Collapses to compact rows on phones.
 */
export function RecentlyUpdated({ medicines, onViewAll }: RecentlyUpdatedProps) {
    return (
        <Card>
            <CardHeader
                title="Recently updated"
                description="The latest changes to the global medicine catalog."
                actions={
                    <Button variant="secondary" size="sm" onClick={onViewAll}>
                        View all medicines
                    </Button>
                }
            />

            {medicines.length === 0 ? (
                <CardBody>
                    <p className="text-sm text-muted">No medicines have been updated yet.</p>
                </CardBody>
            ) : (
                <ul className="divide-y divide-line">
                    {medicines.map((medicine) => (
                        <li key={medicine.id} className="flex items-center gap-3 px-5 py-3">
                            <CatalogImage medicine={medicine} className="h-10 w-10 shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-ink">{medicine.name}</p>
                                <p className="truncate text-xs text-muted">{orDash(medicine.genericName)}</p>
                            </div>
                            <span className="hidden text-xs text-muted sm:block">
                                Updated {formatCatalogDate(medicine.updatedAt)}
                            </span>
                            <CatalogStatusBadge isActive={medicine.isActive} />
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    )
}