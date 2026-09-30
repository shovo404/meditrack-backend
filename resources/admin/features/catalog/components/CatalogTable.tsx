import { CatalogStatusBadge } from './CatalogStatusBadge'
import { CatalogImage } from './CatalogImage'
import { CatalogRowActions } from './CatalogRowActions'
import { formatCatalogDate, orDash } from '../lib/format'
import type { CatalogMedicine } from '../types'

export interface CatalogTableProps {
    medicines: CatalogMedicine[]
    onEdit: (medicine: CatalogMedicine) => void
    onActivate: (medicine: CatalogMedicine) => void
    onDeactivate: (medicine: CatalogMedicine) => void
    onDelete: (medicine: CatalogMedicine) => void
}

/** Desktop/tablet catalog table (`hidden md:block` in the page). */
export function CatalogTable({ medicines, onEdit, onActivate, onDeactivate, onDelete }: CatalogTableProps) {
    return (
        <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Global medicine catalog</caption>
            <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="px-4 py-3 font-semibold">
                        Medicine
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                        Generic Name
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                        Strength
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                        Dosage Form
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                        Manufacturer
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                        Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                        Updated
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">
                        <span className="sr-only">Actions</span>
                    </th>
                </tr>
            </thead>
            <tbody>
                {medicines.map((medicine) => (
                    <tr key={medicine.id} className="border-b border-line last:border-0 hover:bg-surface-muted/40">
                        <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                                <CatalogImage medicine={medicine} className="h-10 w-10 shrink-0" />
                                <div>
                                    <p className="font-medium text-ink">{medicine.name}</p>
                                </div>
                            </div>
                        </td>
                        <td className="px-4 py-3 text-muted">{orDash(medicine.genericName)}</td>
                        <td className="px-4 py-3 text-muted">{orDash(medicine.strength)}</td>
                        <td className="px-4 py-3 text-muted">{orDash(medicine.dosageForm)}</td>
                        <td className="px-4 py-3 text-muted">{orDash(medicine.manufacturer)}</td>
                        <td className="px-4 py-3">
                            <CatalogStatusBadge isActive={medicine.isActive} />
                        </td>
                        <td className="px-4 py-3 text-muted">{formatCatalogDate(medicine.updatedAt)}</td>
                        <td className="px-4 py-3 text-right">
                            <CatalogRowActions
                                medicine={medicine}
                                onEdit={onEdit}
                                onActivate={onActivate}
                                onDeactivate={onDeactivate}
                                onDelete={onDelete}
                            />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}