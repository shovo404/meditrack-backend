import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { createAdminRouter } from '@/app/router'
import { createAdminQueryClient } from '@/app/queryClient'
import { AdminAuthProvider } from '@/features/auth/AdminAuthProvider'

export function AdminApp() {
    const [queryClient] = useState(createAdminQueryClient)
    const [router] = useState(createAdminRouter)

    return (
        <QueryClientProvider client={queryClient}>
            <AdminAuthProvider>
                <RouterProvider router={router} />
            </AdminAuthProvider>
        </QueryClientProvider>
    )
}
