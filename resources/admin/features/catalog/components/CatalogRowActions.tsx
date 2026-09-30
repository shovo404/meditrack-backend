import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { ChevronDown, Pencil, Power, Trash2 } from 'lucide-react'
import type { CatalogMedicine } from '../types'

export interface CatalogRowActionsProps {
    medicine: CatalogMedicine
    onEdit: (medicine: CatalogMedicine) => void
    onActivate: (medicine: CatalogMedicine) => void
    onDeactivate: (medicine: CatalogMedicine) => void
    onDelete: (medicine: CatalogMedicine) => void
}

/**
 * Per-row "Actions" menu (keyboard accessible via Headless UI's Menu). Edit opens the
 * Phase 2D form; activate/deactivate/delete keep the Phase 2C behaviour.
 */
export function CatalogRowActions({ medicine, onEdit, onActivate, onDeactivate, onDelete }: CatalogRowActionsProps) {
    return (
        <Menu as="div" className="relative">
            <MenuButton
                aria-label={`Actions for ${medicine.name}`}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted focus-visible:outline-2"
            >
                <span className="sr-only sm:not-sr-only sm:inline">Actions</span>
                <ChevronDown aria-hidden="true" className="h-4 w-4" />
            </MenuButton>

            <MenuItems
                anchor="bottom end"
                className="z-30 min-w-44 rounded-lg border border-line bg-surface p-1 shadow-lg"
            >
                <MenuItem>
                    {({ focus }) => (
                        <button
                            type="button"
                            onClick={() => onEdit(medicine)}
                            className={focus ? 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm bg-surface-muted text-ink' : 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink'}
                        >
                            <Pencil aria-hidden="true" className="h-4 w-4" />
                            Edit
                        </button>
                    )}
                </MenuItem>

                <div className="my-1 h-px bg-line" role="separator" />

                {medicine.isActive ? (
                    <MenuItem>
                        {({ focus }) => (
                            <button
                                type="button"
                                onClick={() => onDeactivate(medicine)}
                                className={focus ? 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm bg-surface-muted text-ink' : 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink'}
                            >
                                <Power aria-hidden="true" className="h-4 w-4" />
                                Deactivate
                            </button>
                        )}
                    </MenuItem>
                ) : (
                    <MenuItem>
                        {({ focus }) => (
                            <button
                                type="button"
                                onClick={() => onActivate(medicine)}
                                className={focus ? 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm bg-surface-muted text-ink' : 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink'}
                            >
                                <Power aria-hidden="true" className="h-4 w-4" />
                                Activate
                            </button>
                        )}
                    </MenuItem>
                )}

                <div className="my-1 h-px bg-line" role="separator" />

                <MenuItem>
                    {({ focus }) => (
                        <button
                            type="button"
                            onClick={() => onDelete(medicine)}
                            className={focus ? 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/50' : 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-700 dark:text-red-400'}
                        >
                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                            Delete
                        </button>
                    )}
                </MenuItem>
            </MenuItems>
        </Menu>
    )
}