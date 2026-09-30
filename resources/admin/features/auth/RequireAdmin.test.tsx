import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockAdminApi } from '@/test/apiMock'
import { callsTo, installFetchMock } from '@/test/fetchMock'
import { adminUserFixture } from '@/test/fixtures'
import { renderAdminApp } from '@/test/renderAdminApp'

describe('RequireAdmin', () => {
    it('shows a loader while the session is being verified', () => {
        installFetchMock(() => new Promise<Response>(() => {}))

        renderAdminApp(['/admin'])

        expect(screen.getByText('Checking your admin session…')).toBeInTheDocument()
    })

    it('redirects unauthenticated visitors to the login page', async () => {
        mockAdminApi({ session: { status: 401, body: { message: 'Unauthenticated.' } } })

        renderAdminApp(['/admin'])

        expect(await screen.findByRole('heading', { name: 'Sign in to the admin panel' })).toBeInTheDocument()
        expect(screen.queryByRole('navigation', { name: 'Admin sections' })).not.toBeInTheDocument()
    })

    it('shows the access-denied screen for a signed-in non-admin without rendering admin content', async () => {
        mockAdminApi({
            session: { status: 403, body: { message: 'This account does not have administrator access.' } },
        })

        renderAdminApp(['/admin/catalog'])

        expect(await screen.findByRole('heading', { name: 'Administrator access required' })).toBeInTheDocument()
        expect(screen.queryByRole('navigation', { name: 'Admin sections' })).not.toBeInTheDocument()
        expect(screen.queryByText('Catalog management arrives in the next phase.')).not.toBeInTheDocument()
    })

    it('renders the admin shell with navigation and identity for an authenticated admin', async () => {
        mockAdminApi({ session: { status: 200, body: { user: adminUserFixture } } })

        renderAdminApp(['/admin'])

        expect(await screen.findByRole('heading', { name: 'Admin Dashboard' })).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: 'Admin sections' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Medicine Catalog' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
        expect(screen.getByText(adminUserFixture.name)).toBeInTheDocument()
        expect(screen.getByText(adminUserFixture.email)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    })

    it('renders the medicine catalog route inside the admin shell', async () => {
        mockAdminApi({ session: { status: 200, body: { user: adminUserFixture } } })

        renderAdminApp(['/admin/catalog'])

        expect(await screen.findByRole('heading', { name: 'Medicine Catalog' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add Medicine' })).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: 'Admin sections' })).toBeInTheDocument()
    })

    it('signs out from the shell and returns to the login page', async () => {
        const user = userEvent.setup()
        const fetchMock = mockAdminApi({ session: { status: 200, body: { user: adminUserFixture } } })

        renderAdminApp(['/admin'])

        await screen.findByRole('heading', { name: 'Admin Dashboard' })
        await user.click(screen.getByRole('button', { name: /sign out/i }))

        expect(await screen.findByRole('heading', { name: 'Sign in to the admin panel' })).toBeInTheDocument()
        expect(callsTo(fetchMock, '/admin/auth/logout')).toHaveLength(1)
    })
})
