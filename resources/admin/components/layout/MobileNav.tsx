import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { X } from 'lucide-react'
import { AdminNavLinks } from '@/components/layout/AdminNavLinks'

export interface MobileNavProps {
    open: boolean
    onClose: () => void
}

/**
 * Slide-over navigation for small screens. Headless UI's Dialog supplies the focus
 * trap, Escape handling and `aria-modal` semantics.
 */
export function MobileNav({ open, onClose }: MobileNavProps) {
    return (
        <Dialog open={open} onClose={onClose} className="relative z-40 lg:hidden">
            <DialogBackdrop
                transition
                className="fixed inset-0 bg-navy-900/50 transition-opacity duration-200 data-closed:opacity-0"
            />

            <div className="fixed inset-0 flex">
                <DialogPanel
                    transition
                    className="flex w-72 max-w-[85%] flex-col bg-surface shadow-xl transition-transform duration-200 data-closed:-translate-x-full"
                >
                    <div className="flex h-16 items-center justify-between border-b border-line px-4">
                        <DialogTitle className="text-sm font-semibold text-ink">MediTrack Admin</DialogTitle>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close navigation menu"
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-ink"
                        >
                            <X aria-hidden="true" className="h-4 w-4" />
                        </button>
                    </div>

                    <nav aria-label="Admin sections" className="flex-1 overflow-y-auto p-3">
                        <AdminNavLinks onNavigate={onClose} />
                    </nav>
                </DialogPanel>
            </div>
        </Dialog>
    )
}
