import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { createAdminRouter } from '@/app/router'
import { createAdminQueryClient } from '@/app/queryClient'
import { AdminAuthProvider } from '@/features/auth/AdminAuthProvider'
import { ThemeProvider } from '@/lib/theme/themeProvider'

export function AdminApp() {
    const [queryClient] = useState(createAdminQueryClient)
    const [router] = useState(createAdminRouter)

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <AdminAuthProvider>
                    <RouterProvider router={router} />
                </AdminAuthProvider>
            </ThemeProvider>
        </QueryClientProvider>
    )
}
