import { Button } from '@/components/ui/Button'
import { CatalogDialog } from './CatalogDialog'

export interface UnsavedChangesDialogProps {
    open: boolean
    onStay: () => void
    onLeave: () => void
}

/**
 * React-router blocker UI for the Add/Edit form. Only shown while the form is dirty; a
 * clean form navigates away without confirmation.
 */
export function UnsavedChangesDialog({ open, onStay, onLeave }: UnsavedChangesDialogProps) {
    return (
        <CatalogDialog
            open={open}
            onClose={onStay}
            title="You have unsaved changes"
            description="Are you sure you want to leave? Any changes you made to this medicine will be lost."
        >
            <Button variant="secondary" onClick={onStay} autoFocus>
                Stay
            </Button>
            <Button onClick={onLeave}>Leave</Button>
        </CatalogDialog>
    )
}