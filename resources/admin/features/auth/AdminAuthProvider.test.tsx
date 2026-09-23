import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createAdminQueryClient } from '@/app/queryClient'
import { AdminAuthProvider } from '@/features/auth/AdminAuthProvider'
import { useAdminAuth } from '@/features/auth/authContext'
import { mockAdminApi } from '@/test/apiMock'
import { callsTo, installFetchMock } from '@/test/fetchMock'
import { adminUserFixture } from '@/test/fixtures'

function StatusProbe() {
    const { status, admin, error } = useAdminAuth()

    return (
        <div>
            <span data-testid="status">{status}</span>
            <span data-testid="email">{admin?.email ?? 'none'}</span>
            <span data-testid="error">{error?.message ?? 'none'}</span>
        </div>
    )
}

function renderProbe() {
    const queryClient = createAdminQueryClient()

    return render(
        <QueryClientProvider client={queryClient}>
            <AdminAuthProvider>
                <StatusProbe />
            </AdminAuthProvider>
        </QueryClientProvider>
    )
}

describe('AdminAuthProvider', () => {
    it('starts in the loading state until the session is resolved', () => {
        installFetchMock(() => new Promise<Response>(() => {}))

        renderProbe()

        expect(screen.getByTestId('status')).toHaveTextContent('loading')
    })

    it('maps a 200 session response to an authenticated admin', async () => {
        mockAdminApi({ session: { status: 200, body: { user: adminUserFixture } } })

        renderProbe()

        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
        expect(screen.getByTestId('email')).toHaveTextContent(adminUserFixture.email)
    })

    it('maps a 401 session response to unauthenticated', async () => {
        mockAdminApi({ session: { status: 401, body: { message: 'Unauthenticated.' } } })

        renderProbe()

        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
        expect(screen.getByTestId('email')).toHaveTextContent('none')
    })

    it('maps a 403 session response to forbidden', async () => {
        mockAdminApi({ session: { status: 403, body: { message: 'This account does not have administrator access.' } } })

        renderProbe()

        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('forbidden'))
    })

    it('maps network failures to an error state', async () => {
        installFetchMock(() => Promise.reject(new TypeError('Failed to fetch')))

        renderProbe()

        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'))
        expect(screen.getByTestId('error')).toHaveTextContent(/could not reach the server/i)
    })

    it('checks the session exactly once, even across re-renders', async () => {
        const fetchMock = mockAdminApi({ session: { status: 200, body: { user: adminUserFixture } } })

        const { rerender } = renderProbe()

        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))

        rerender(
            <QueryClientProvider client={createAdminQueryClient()}>
                <AdminAuthProvider>
                    <StatusProbe />
                </AdminAuthProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(callsTo(fetchMock, '/admin/auth/user')).toHaveLength(1))
    })
})
