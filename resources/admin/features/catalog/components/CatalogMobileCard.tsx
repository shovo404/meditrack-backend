import { Card, CardBody } from '@/components/ui/Card'
import { CatalogStatusBadge } from './CatalogStatusBadge'
import { CatalogImage } from './CatalogImage'
import { CatalogRowActions } from './CatalogRowActions'
import { formatCatalogDate, orDash } from '../lib/format'
import type { CatalogMedicine } from '../types'

export interface CatalogMobileCardProps {
    medicine: CatalogMedicine
    onActivate: (medicine: CatalogMedicine) => void
    onDeactivate: (medicine: CatalogMedicine) => void
    onDelete: (medicine: CatalogMedicine) => void
}

/** Mobile catalog card (`md:hidden` in the page) — the wide table is never forced onto small screens. */
export function CatalogMobileCard({ medicine, onActivate, onDeactivate, onDelete }: CatalogMobileCardProps) {
    return (
        <Card>
            <CardBody className="space-y-3">
                <div className="flex items-start gap-3">
                    <CatalogImage medicine={medicine} className="h-12 w-12 shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">{medicine.name}</p>
                        <p className="truncate text-sm text-muted">{orDash(medicine.genericName)}</p>
                    </div>
                    <CatalogStatusBadge isActive={medicine.isActive} />
                </div>

                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <dt className="text-muted">Strength</dt>
                    <dd className="text-ink">{orDash(medicine.strength)}</dd>
                    <dt className="text-muted">Dosage form</dt>
                    <dd className="text-ink">{orDash(medicine.dosageForm)}</dd>
                    <dt className="text-muted">Manufacturer</dt>
                    <dd className="text-ink">{orDash(medicine.manufacturer)}</dd>
                    <dt className="text-muted">Updated</dt>
                    <dd className="text-ink">{formatCatalogDate(medicine.updatedAt)}</dd>
                </dl>

                <div className="flex justify-end border-t border-line pt-3">
                    <CatalogRowActions
                        medicine={medicine}
                        onActivate={onActivate}
                        onDeactivate={onDeactivate}
                        onDelete={onDelete}
                    />
                </div>
            </CardBody>
        </Card>
    )
}