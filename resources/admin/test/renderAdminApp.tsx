import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { createAdminQueryClient } from '@/app/queryClient'
import { adminRoutes } from '@/app/router'
import { AdminAuthProvider } from '@/features/auth/AdminAuthProvider'

/**
 * Renders the real admin route tree with a memory router, so tests exercise the same
 * guards, shell and pages the browser sees.
 */
export function renderAdminApp(initialEntries: string[] = ['/admin']) {
    const queryClient = createAdminQueryClient()
    const router = createMemoryRouter(adminRoutes, { initialEntries })

    const result = render(
        <QueryClientProvider client={queryClient}>
            <AdminAuthProvider>
                <RouterProvider router={router} />
            </AdminAuthProvider>
        </QueryClientProvider>
    )

    return { ...result, router, queryClient }
}
