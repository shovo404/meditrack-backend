import { useState } from 'react'
import { Pill } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { CatalogMedicine } from '../types'

/**
 * Catalog thumbnail. Falls back to the local placeholder on a broken/absent URL — the
 * admin UI never delegates to a remote placeholder service.
 */
export function CatalogImage({ medicine, className }: { medicine: CatalogMedicine; className?: string }) {
    const [failed, setFailed] = useState(false)

    const placeholder = (
        <span
            aria-hidden="true"
            className={cn(
                'flex items-center justify-center rounded-lg bg-surface-muted text-muted',
                className
            )}
        >
            <Pill className="h-5 w-5" />
        </span>
    )

    if (!medicine.imageUrl || failed) {
        return placeholder
    }

    return (
        <img
            src={medicine.imageUrl}
            alt={`Image of ${medicine.name}`}
            loading="lazy"
            onError={() => setFailed(true)}
            className={cn('rounded-lg object-cover', className)}
        />
    )
}