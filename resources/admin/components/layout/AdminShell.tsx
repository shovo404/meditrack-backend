import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { MobileNav } from '@/components/layout/MobileNav'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'

/** Authenticated layout: sidebar (desktop) / drawer (mobile) + topbar + routed content. */
export function AdminShell() {
    const location = useLocation()
    const [isNavigationOpen, setIsNavigationOpen] = useState(false)

    // Close the mobile drawer whenever the route changes.
    useEffect(() => {
        setIsNavigationOpen(false)
    }, [location.pathname])

    return (
        <div className="min-h-screen bg-canvas">
            <a
                href="#admin-content"
                className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-md"
            >
                Skip to content
            </a>

            <Sidebar />
            <MobileNav open={isNavigationOpen} onClose={() => setIsNavigationOpen(false)} />

            <div className="lg:pl-64">
                <Topbar
                    isNavigationOpen={isNavigationOpen}
                    onOpenNavigation={() => setIsNavigationOpen(true)}
                />

                <main id="admin-content" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
