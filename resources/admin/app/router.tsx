import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AdminShell } from '@/components/layout/AdminShell'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAdmin } from '@/features/auth/RequireAdmin'
import { CatalogMedicineFormPage } from '@/features/catalog/CatalogMedicineFormPage'
import { CatalogPage } from '@/features/catalog/CatalogPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { NotFoundPage } from '@/features/misc/NotFoundPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

/**
 * Phase 2B route table.
 *
 * `/admin/login` is public (it renders the form); everything else under `/admin` sits
 * behind RequireAdmin + the AdminShell. Exported as plain objects so tests can mount the
 * same tree with a memory router.
 */
export const adminRoutes: RouteObject[] = [
    { path: '/', element: <Navigate to="/admin" replace /> },
    { path: '/admin/login', element: <LoginPage /> },
    {
        element: <RequireAdmin />,
        children: [
            {
                element: <AdminShell />,
                children: [
                    { path: '/admin', element: <DashboardPage /> },
                    { path: '/admin/catalog', element: <CatalogPage /> },
                    { path: '/admin/catalog/new', element: <CatalogMedicineFormPage /> },
                    { path: '/admin/catalog/:medicineId/edit', element: <CatalogMedicineFormPage /> },
                    { path: '/admin/settings', element: <SettingsPage /> },
                    { path: '/admin/*', element: <NotFoundPage /> },
                ],
            },
        ],
    },
    { path: '*', element: <NotFoundPage /> },
]

export function createAdminRouter() {
    return createBrowserRouter(adminRoutes)
}
