import { Pill } from 'lucide-react'
import { AdminNavLinks } from '@/components/layout/AdminNavLinks'

/** Fixed sidebar, desktop only (below `lg` the mobile drawer takes over). */
export function Sidebar() {
    return (
        <aside className="hidden border-r border-line bg-surface lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col">
            <div className="flex h-16 items-center gap-3 border-b border-line px-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-900 text-white">
                    <Pill aria-hidden="true" className="h-4 w-4" />
                </span>
                <div>
                    <p className="text-sm font-semibold text-ink">MediTrack</p>
                    <p className="text-xs text-muted">Admin Panel</p>
                </div>
            </div>

            <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 py-4">
                <AdminNavLinks />
            </nav>

            <div className="border-t border-line px-5 py-4">
                <p className="text-xs text-muted">Global medicine catalog</p>
            </div>
        </aside>
    )
}
