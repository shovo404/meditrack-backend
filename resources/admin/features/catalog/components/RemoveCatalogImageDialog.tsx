import { Button } from '@/components/ui/Button'
import { CatalogDialog } from './CatalogDialog'

export interface RemoveCatalogImageDialogProps {
    open: boolean
    medicineName: string | null
    onClose: () => void
    onConfirm: () => void
    isSubmitting: boolean
}

/**
 * Confirmation before deleting the stored image. Deliberately scoped to the image only:
 * accepted values show a plain "remove the image" outcome, never the medicine itself.
 */
export function RemoveCatalogImageDialog({
    open,
    medicineName,
    onClose,
    onConfirm,
    isSubmitting,
}: RemoveCatalogImageDialogProps) {
    return (
        <CatalogDialog
            open={open}
            onClose={onClose}
            title="Remove this medicine image?"
            description={`${medicineName ? `“${medicineName}”` : 'This medicine'} will keep all of its details — only the stored image is removed from the global catalog.`}
        >
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
            </Button>
            <Button onClick={onConfirm} isLoading={isSubmitting} disabled={isSubmitting}>
                Remove image
            </Button>
        </CatalogDialog>
    )
}