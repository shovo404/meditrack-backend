import { LayoutDashboard, Pill, Settings, type LucideIcon } from 'lucide-react'

export interface AdminNavItem {
    label: string
    to: string
    icon: LucideIcon
    /** Exact match only (used for the dashboard root). */
    end?: boolean
}

export const adminNavItems: AdminNavItem[] = [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
    { label: 'Medicine Catalog', to: '/admin/catalog', icon: Pill },
    { label: 'Settings', to: '/admin/settings', icon: Settings },
]

/** Resolve the nav item for the current path, used for the topbar page title. */
export function findAdminNavItem(pathname: string): AdminNavItem | undefined {
    return adminNavItems.find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))
}
