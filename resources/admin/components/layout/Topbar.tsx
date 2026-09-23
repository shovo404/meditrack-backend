import { LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { findAdminNavItem } from '@/components/layout/navItems'
import { useAdminAuth } from '@/features/auth/authContext'

export interface TopbarProps {
    isNavigationOpen: boolean
    onOpenNavigation: () => void
}

export function Topbar({ isNavigationOpen, onOpenNavigation }: TopbarProps) {
    const { admin, logout } = useAdminAuth()
    const location = useLocation()
    const navigate = useNavigate()
    const [isSigningOut, setIsSigningOut] = useState(false)

    const pageTitle = findAdminNavItem(location.pathname)?.label ?? 'MediTrack Admin'

    const handleSignOut = async () => {
        setIsSigningOut(true)

        try {
            await logout()
            navigate('/admin/login', { replace: true })
        } finally {
            setIsSigningOut(false)
        }
    }

    return (
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
            <button
                type="button"
                onClick={onOpenNavigation}
                aria-label="Open navigation menu"
                aria-expanded={isNavigationOpen}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-ink lg:hidden"
            >
                <Menu aria-hidden="true" className="h-5 w-5" />
            </button>

            {/* A plain label rather than a heading: each page owns its own <h1>. */}
            <p className="truncate text-sm font-semibold text-ink">{pageTitle}</p>

            <div className="ml-auto flex items-center gap-3">
                {admin ? (
                    <div className="hidden text-right sm:block">
                        <p className="text-sm font-medium text-ink">{admin.name}</p>
                        <p className="text-xs text-muted">{admin.email}</p>
                    </div>
                ) : null}

                <span className="rounded-full bg-brand-50 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-brand-800">
                    {admin?.role ?? 'ADMIN'}
                </span>

                <Button variant="secondary" size="sm" onClick={handleSignOut} isLoading={isSigningOut}>
                    <LogOut aria-hidden="true" className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign out</span>
                </Button>
            </div>
        </header>
    )
}
