import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { callsTo, fetchCalls, installFetchMock, mockResponse, type MockResponseSpec } from '@/test/fetchMock'
import { adminUserFixture } from '@/test/fixtures'
import { renderAdminApp } from '@/test/renderAdminApp'
import type { CatalogMedicine } from '@/features/catalog/types'

const sessionOk = { status: 200, body: { user: adminUserFixture } } as const

const recentlyUpdatedFixture: CatalogMedicine = {
    id: 1,
    name: 'Paracetamol',
    genericName: 'Acetaminophen',
    strength: '500mg',
    dosageForm: 'Tablet',
    manufacturer: 'MedCo',
    imageUrl: null,
    isActive: true,
    createdAt: '2026-09-01T00:00:00+00:00',
    updatedAt: '2026-09-28T00:00:00+00:00',
}

const statsFixture = {
    totalMedicines: 54,
    activeMedicines: 36,
    inactiveMedicines: 18,
    recentlyUpdated: [recentlyUpdatedFixture],
}

function mockDashboardBackend(stats?: MockResponseSpec | (() => Promise<Response> | Response)) {
    return installFetchMock(async (input, init) => {
        const url = typeof input === 'string' ? input : String(input)
        const method = init?.method ?? 'GET'

        if (url.includes('/sanctum/csrf-cookie')) {
            return mockResponse({ status: 204 })
        }

        if (url.includes('/admin/auth/user')) {
            return mockResponse(sessionOk)
        }

        if (url.includes('/admin/dashboard/stats')) {
            return typeof stats === 'function' ? stats() : mockResponse(stats ?? { status: 200, body: statsFixture })
        }

        return mockResponse({ status: 404, body: { message: `Unexpected request: ${url} (${method})` } })
    })
}

describe('DashboardPage', () => {
    it('shows skeleton cards while the statistics load, then the data', async () => {
        let resolveStats: ((response: Response) => void) | undefined
        const pending = new Promise<Response>((resolve) => {
            resolveStats = resolve
        })

        mockDashboardBackend(() => pending)
        renderAdminApp(['/admin'])

        // Skeleton grid is present before data arrives, and no totals are rendered yet.
        const statsSection = await screen.findByLabelText('Catalog statistics')
        expect(statsSection).toBeInTheDocument()
        expect(screen.queryByRole('group', { name: 'Total medicines' })).not.toBeInTheDocument()

        await act(async () => {
            resolveStats?.(mockResponse({ status: 200, body: statsFixture }))
        })

        expect(await screen.findByRole('group', { name: 'Total medicines' })).toBeInTheDocument()
        expect(statsSection).not.toBeInTheDocument()
    })

    it('renders the three whole-catalog statistics', async () => {
        mockDashboardBackend()
        renderAdminApp(['/admin'])

        const total = await screen.findByRole('group', { name: 'Total medicines' })
        const active = screen.getByRole('group', { name: 'Active medicines' })
        const inactive = screen.getByRole('group', { name: 'Inactive medicines' })

        expect(within(total).getByText('54')).toBeInTheDocument()
        expect(within(active).getByText('36')).toBeInTheDocument()
        expect(within(inactive).getByText('18')).toBeInTheDocument()
    })

    it('links the Add Medicine quick action to the create form', async () => {
        const user = userEvent.setup()
        mockDashboardBackend()
        renderAdminApp(['/admin'])

        await screen.findByRole('group', { name: 'Total medicines' })

        await user.click(screen.getByRole('button', { name: /add medicine/i }))
        expect(await screen.findByRole('heading', { name: 'Add Medicine' })).toBeInTheDocument()
    })

    it('links the View Catalog quick action to the catalog page', async () => {
        const user = userEvent.setup()
        mockDashboardBackend()
        renderAdminApp(['/admin'])

        await screen.findByRole('group', { name: 'Total medicines' })

        await user.click(screen.getByRole('button', { name: /view catalog/i }))
        expect(await screen.findByRole('heading', { name: 'Medicine Catalog' })).toBeInTheDocument()
    })

    it('renders the recently updated list with status and links to the catalog', async () => {
        const user = userEvent.setup()
        mockDashboardBackend()
        renderAdminApp(['/admin'])

        expect(await screen.findByText('Paracetamol')).toBeInTheDocument()
        expect(screen.getByText('Recently updated')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'View all medicines' }))
        expect(await screen.findByRole('heading', { name: 'Medicine Catalog' })).toBeInTheDocument()
    })

    it('shows a scoped 500 error with Retry and recovers after a retry', async () => {
        const user = userEvent.setup()
        let failures = 1
        const fetchMock = mockDashboardBackend(() => {
            if (failures > 0) {
                failures -= 1

                return mockResponse({ status: 500, body: { message: 'Server exploded.' } })
            }

            return mockResponse({ status: 200, body: statsFixture })
        })

        renderAdminApp(['/admin'])

        expect(await screen.findByText('Something went wrong on the server. Please try again.')).toBeInTheDocument()
        expect(screen.queryByRole('group', { name: 'Total medicines' })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Try again' }))

        expect(await screen.findByRole('group', { name: 'Total medicines' })).toBeInTheDocument()
        expect(callsTo(fetchMock, '/admin/dashboard/stats')).toHaveLength(2)
    })

    it('explains a 403 without showing any statistics', async () => {
        mockDashboardBackend({ status: 403, body: { message: 'Forbidden.' } })
        renderAdminApp(['/admin'])

        expect(await screen.findByText('Administrator access required')).toBeInTheDocument()
        expect(screen.queryByRole('group', { name: 'Total medicines' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })

    it('explains a rate-limited reply', async () => {
        mockDashboardBackend({ status: 429, headers: { 'Retry-After': '30' }, body: { message: 'Too Many Attempts.' } })
        renderAdminApp(['/admin'])

        expect(await screen.findByText('Too many requests')).toBeInTheDocument()
        expect(screen.getByText('Please wait about 30 seconds before trying again.')).toBeInTheDocument()
    })

    it('explains a network failure', async () => {
        mockDashboardBackend(() => Promise.reject(new TypeError('Failed to fetch')))
        renderAdminApp(['/admin'])

        expect(
            await screen.findByText('Unable to connect to the server. Please check your connection and try again.')
        ).toBeInTheDocument()
    })

    it('bounces to login when the statistics call returns 401', async () => {
        mockDashboardBackend({ status: 401, body: { message: 'Unauthenticated.' } })
        renderAdminApp(['/admin'])

        expect(await screen.findByRole('heading', { name: 'Sign in to the admin panel' })).toBeInTheDocument()
        expect(screen.queryByRole('group', { name: 'Total medicines' })).not.toBeInTheDocument()
    })

    it('never calls the user medicine endpoint', async () => {
        const fetchMock = mockDashboardBackend()
        renderAdminApp(['/admin'])

        await screen.findByRole('group', { name: 'Total medicines' })

        const userDataCalls = fetchCalls(fetchMock).filter(
            (call) => call.url.includes('/catalog/medicines') && !call.url.includes('/admin/')
        )

        expect(userDataCalls).toHaveLength(0)
    })

    it('lays the statistics out as a responsive grid for small and large screens', async () => {
        mockDashboardBackend()
        renderAdminApp(['/admin'])

        const statsSection = await screen.findByRole('group', { name: 'Total medicines' })
        const grid = statsSection.closest('section')

        expect(grid).toHaveClass('grid')
        expect(grid).toHaveClass('sm:grid-cols-2')
        expect(grid).toHaveClass('lg:grid-cols-3')
    })
})