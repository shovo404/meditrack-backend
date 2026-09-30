import { Button } from '@/components/ui/Button'
import { CatalogDialog } from './CatalogDialog'
import type { CatalogMedicine } from '../types'

export interface StatusChangeDialogProps {
    medicine: CatalogMedicine | null
    /** The status we are about to switch to (the opposite of the current one). */
    targetActive: boolean
    open: boolean
    onClose: () => void
    onConfirm: () => void
    isSubmitting: boolean
}

/**
 * Confirmation before `PATCH /admin/catalog/medicines/{id}/status`. Deactivation spells
 * out the user-facing consequence; activating is a simple confirm. No optimistic update.
 */
export function StatusChangeDialog({ medicine, targetActive, open, onClose, onConfirm, isSubmitting }: StatusChangeDialogProps) {
    return (
        <CatalogDialog
            open={open}
            onClose={onClose}
            title={targetActive ? 'Activate this medicine?' : 'Deactivate this medicine?'}
            description={
                medicine ? (
                    targetActive ? (
                        <>
                            <span className="font-medium text-ink">{medicine.name}</span> will become available in active
                            catalog selections for users again.
                        </>
                    ) : (
                        <>
                            <span className="font-medium text-ink">{medicine.name}</span> will no longer appear in active
                            catalog selections for users. Existing user medicine records are not changed.
                        </>
                    )
                ) : undefined
            }
        >
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
            </Button>
            <Button onClick={onConfirm} isLoading={isSubmitting}>
                {targetActive ? 'Activate' : 'Deactivate'}
            </Button>
        </CatalogDialog>
    )
}