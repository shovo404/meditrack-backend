import { LogOut, Menu, Monitor, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu as ThemeMenu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { Button } from '@/components/ui/Button'
import { findAdminNavItem } from '@/components/layout/navItems'
import { useAdminAuth } from '@/features/auth/authContext'
import { useTheme, type ThemeMode } from '@/lib/theme/themeProvider'
import { cn } from '@/lib/utils/cn'

const themeOptions: Array<{ mode: ThemeMode; label: string; icon: typeof Sun }> = [
    { mode: 'light', label: 'Light', icon: Sun },
    { mode: 'dark', label: 'Dark', icon: Moon },
    { mode: 'system', label: 'System', icon: Monitor },
]

export interface TopbarProps {
    isNavigationOpen: boolean
    onOpenNavigation: () => void
}

export function Topbar({ isNavigationOpen, onOpenNavigation }: TopbarProps) {
    const { admin, logout } = useAdminAuth()
    const { theme, setTheme, isDark } = useTheme()
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

    const CurrentThemeIcon = theme === 'light' || (theme === 'system' && !isDark) ? Sun : Moon

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

                <span className="rounded-full bg-brand-50 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
                    {admin?.role ?? 'ADMIN'}
                </span>

                <ThemeMenu as="div" className="relative">
                    <MenuButton
                        aria-label="Change theme"
                        title="Change theme"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-ink"
                    >
                        <CurrentThemeIcon aria-hidden="true" className="h-5 w-5" />
                    </MenuButton>

                    <MenuItems
                        anchor="bottom end"
                        className="z-40 min-w-44 rounded-lg border border-line bg-surface p-1 shadow-lg"
                    >
                        <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted">Theme</p>
                        {themeOptions.map(({ mode, label, icon: Icon }) => (
                            <MenuItem key={mode}>
                                {({ focus }) => (
                                    <button
                                        type="button"
                                        onClick={() => setTheme(mode)}
                                        className={cn(
                                            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink',
                                            focus && 'bg-surface-muted'
                                        )}
                                    >
                                        <Icon aria-hidden="true" className="h-4 w-4" />
                                        <span className="flex-1">{label}</span>
                                        {theme === mode ? (
                                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-600 dark:bg-brand-400" />
                                        ) : null}
                                    </button>
                                )}
                            </MenuItem>
                        ))}
                    </MenuItems>
                </ThemeMenu>

                <Button variant="secondary" size="sm" onClick={handleSignOut} isLoading={isSigningOut}>
                    <LogOut aria-hidden="true" className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign out</span>
                </Button>
            </div>
        </header>
    )
}
