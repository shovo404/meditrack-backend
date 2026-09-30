import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import type { ReactNode } from 'react'
import { useId } from 'react'

export interface CatalogDialogProps {
    open: boolean
    onClose: () => void
    title: string
    /** Longer explanation; linked via aria-describedby so it is read before confirming. */
    description?: ReactNode
    children: ReactNode
}

/**
 * Shared confirmation dialog shell. Headless UI wires up the focus trap, the light-dismiss
 * outside click/Escape and the labelled/title+description semantics.
 */
export function CatalogDialog({ open, onClose, title, description, children }: CatalogDialogProps) {
    const descriptionId = useId()

    return (
        <Dialog open={open} onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-navy-900/40" />

            <div className="fixed inset-0 flex items-end justify-center p-4 sm:items-center">
                <DialogPanel className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-lg">
                    <DialogTitle className="text-lg font-semibold text-ink">{title}</DialogTitle>

                    {description ? (
                        <div id={descriptionId} className="mt-2 text-sm text-muted">
                            {description}
                        </div>
                    ) : null}

                    <div className="mt-5 flex justify-end gap-2">{children}</div>
                </DialogPanel>
            </div>
        </Dialog>
    )
}