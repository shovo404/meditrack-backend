import { Button } from '@/components/ui/Button'
import { CatalogDialog } from './CatalogDialog'
import type { CatalogMedicine } from '../types'

export interface DeleteCatalogDialogProps {
    medicine: CatalogMedicine | null
    open: boolean
    onClose: () => void
    onConfirm: () => void
    isSubmitting: boolean
}

/**
 * Confirmation before the backend soft delete. States plainly that this is a global-catalog
 * deletion; it never claims to touch user medicine records.
 */
export function DeleteCatalogDialog({ medicine, open, onClose, onConfirm, isSubmitting }: DeleteCatalogDialogProps) {
    return (
        <CatalogDialog
            open={open}
            onClose={onClose}
            title="Delete this medicine?"
            description={
                medicine ? (
                    <>
                        You are about to remove <span className="font-medium text-ink">{medicine.name}</span> from the
                        global medicine catalog. User medicine records, schedules and alarms are not affected.
                    </>
                ) : undefined
            }
        >
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
            </Button>
            <Button
                variant="secondary"
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={onConfirm}
                isLoading={isSubmitting}
            >
                Delete
            </Button>
        </CatalogDialog>
    )
}