import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetCsrfCookie } from '@/lib/api/client'
import { mockAdminApi } from '@/test/apiMock'
import { callsTo, installFetchMock, mockResponse } from '@/test/fetchMock'
import { adminUserFixture } from '@/test/fixtures'
import { renderAdminApp } from '@/test/renderAdminApp'

async function fillAndSubmit(email: string, password: string) {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email address'), email)
    await user.type(screen.getByLabelText('Password'), password)
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    return user
}

describe('LoginPage', () => {
    beforeEach(() => {
        resetCsrfCookie()
    })

    it('validates required fields before calling the API', async () => {
        const fetchMock = mockAdminApi()

        renderAdminApp(['/admin/login'])

        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: /sign in/i }))

        expect(await screen.findByText('Enter your email address.')).toBeInTheDocument()
        expect(screen.getByText('Enter your password.')).toBeInTheDocument()
        expect(callsTo(fetchMock, '/admin/auth/login')).toHaveLength(0)
    })

    it('rejects malformed email addresses', async () => {
        mockAdminApi()

        renderAdminApp(['/admin/login'])

        await fillAndSubmit('not-an-email', 'secret-password')

        expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    })

    it('toggles password visibility', async () => {
        mockAdminApi()

        renderAdminApp(['/admin/login'])

        const password = screen.getByLabelText('Password')
        expect(password).toHaveAttribute('type', 'password')

        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Show password' }))
        expect(password).toHaveAttribute('type', 'text')

        await user.click(screen.getByRole('button', { name: 'Hide password' }))
        expect(password).toHaveAttribute('type', 'password')
    })

    it('signs in through the CSRF-protected session endpoint and lands on the dashboard', async () => {
        document.cookie = 'XSRF-TOKEN=csrf-token'
        const fetchMock = mockAdminApi()

        renderAdminApp(['/admin/login'])

        await fillAndSubmit('  admin@example.com  ', 'secret-password')

        expect(await screen.findByRole('heading', { name: 'Admin Dashboard' })).toBeInTheDocument()

        const loginCall = callsTo(fetchMock, '/admin/auth/login')[0]

        expect(loginCall.init.method).toBe('POST')
        expect(loginCall.init.credentials).toBe('include')
        expect(loginCall.headers['X-XSRF-TOKEN']).toBe('csrf-token')
        expect(JSON.parse(String(loginCall.init.body))).toEqual({
            email: 'admin@example.com',
            password: 'secret-password',
        })

        // The CSRF cookie is bootstrapped before the state-changing request.
        expect(callsTo(fetchMock, '/sanctum/csrf-cookie')).toHaveLength(1)
    })

    it('shows the invalid-credentials message returned by the API', async () => {
        mockAdminApi({ login: { status: 401, body: { message: 'Invalid credentials.' } } })

        renderAdminApp(['/admin/login'])

        await fillAndSubmit('admin@example.com', 'wrong-password')

        expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials.')
    })

    it('shows a specific message when the login is rate limited', async () => {
        mockAdminApi({
            login: {
                status: 429,
                body: { message: 'Too many login attempts. Please try again shortly.' },
                headers: { 'Retry-After': '30' },
            },
        })

        renderAdminApp(['/admin/login'])

        await fillAndSubmit('admin@example.com', 'secret-password')

        const alert = await screen.findByRole('alert')

        expect(alert).toHaveTextContent('Too many attempts')
        expect(alert).toHaveTextContent(/30 seconds/)
    })

    it('denies sign-in for a non-admin account and exposes no admin content', async () => {
        mockAdminApi({
            login: { status: 403, body: { message: 'This account does not have administrator access.' } },
        })

        renderAdminApp(['/admin/login'])

        await fillAndSubmit('smoke-user@example.com', 'secret-password')

        const alert = await screen.findByRole('alert')

        expect(alert).toHaveTextContent('Administrator access required')
        expect(alert).toHaveTextContent('This account does not have administrator access.')
        expect(screen.queryByRole('navigation', { name: 'Admin sections' })).not.toBeInTheDocument()
    })

    it('surfaces network failures', async () => {
        mockAdminApi({
            login: () => {
                throw new TypeError('Failed to fetch')
            },
        })

        renderAdminApp(['/admin/login'])

        await fillAndSubmit('admin@example.com', 'secret-password')

        expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server')
    })

    it('maps server-side validation errors onto the matching field', async () => {
        mockAdminApi({
            login: {
                status: 422,
                body: {
                    message: 'The given data was invalid.',
                    errors: { email: ['The email field must be a valid email address.'] },
                },
            },
        })

        renderAdminApp(['/admin/login'])

        await fillAndSubmit('admin@example.com', 'secret-password')

        expect(await screen.findByText('The email field must be a valid email address.')).toBeInTheDocument()
    })

    it('disables the submit button while the request is in flight', async () => {
        installFetchMock((input) => {
            const url = String(input)

            if (url.includes('/sanctum/csrf-cookie')) {
                return mockResponse({ status: 204 })
            }

            if (url.includes('/admin/auth/user')) {
                return mockResponse({ status: 401, body: { message: 'Unauthenticated.' } })
            }

            // The login request never resolves.
            return new Promise<Response>(() => {})
        })

        renderAdminApp(['/admin/login'])

        await fillAndSubmit('admin@example.com', 'secret-password')

        const submit = screen.getByRole('button', { name: /signing in/i })

        await waitFor(() => expect(submit).toBeDisabled())
    })

    it('redirects an already-authenticated admin away from the login page', async () => {
        mockAdminApi({ session: { status: 200, body: { user: adminUserFixture } } })

        renderAdminApp(['/admin/login'])

        expect(await screen.findByRole('heading', { name: 'Admin Dashboard' })).toBeInTheDocument()
        expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument()
    })
})
