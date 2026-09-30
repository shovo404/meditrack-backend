import { NavLink } from 'react-router-dom'
import { adminNavItems } from '@/components/layout/navItems'
import { cn } from '@/lib/utils/cn'

export interface AdminNavLinksProps {
    /** Called after a link is activated (used to close the mobile drawer). */
    onNavigate?: () => void
    className?: string
}

export function AdminNavLinks({ onNavigate, className }: AdminNavLinksProps) {
    return (
        <ul className={cn('space-y-1', className)}>
            {adminNavItems.map((item) => (
                <li key={item.to}>
                    <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                            cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                isActive
                                    ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-100'
                                    : 'text-muted hover:bg-surface-muted hover:text-ink'
                            )
                        }
                    >
                        <item.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                    </NavLink>
                </li>
            ))}
        </ul>
    )
}
