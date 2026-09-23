import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { PageLoader } from '@/components/ui/Spinner'
import { AccessDeniedPage } from '@/features/auth/AccessDeniedPage'
import { useAdminAuth } from '@/features/auth/authContext'
import { SessionErrorPage } from '@/features/auth/SessionErrorPage'

/**
 * Client-side gate for everything under /admin.
 *
 * This is UX only — the Laravel backend (`auth:sanctum` + `AdminMiddleware`) remains the
 * real authorization boundary. Every admin page still fetches its data from guarded
 * endpoints, so a bypassed guard leaks nothing.
 */
export function RequireAdmin() {
    const { status } = useAdminAuth()
    const location = useLocation()

    if (status === 'loading') {
        return <PageLoader label="Checking your admin session…" />
    }

    if (status === 'unauthenticated') {
        // Remember where the user wanted to go so login can send them back.
        return <Navigate to="/admin/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    }

    if (status === 'forbidden') {
        return <AccessDeniedPage />
    }

    if (status === 'error') {
        return <SessionErrorPage />
    }

    return <Outlet />
}
