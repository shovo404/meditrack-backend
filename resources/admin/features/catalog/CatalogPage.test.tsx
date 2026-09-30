import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { installFetchMock, mockResponse, callsTo, type MockResponseSpec } from '@/test/fetchMock'
import { adminUserFixture } from '@/test/fixtures'
import { renderAdminApp } from '@/test/renderAdminApp'
import type { CatalogMedicine } from '@/features/catalog/types'

const sessionOk = { status: 200, body: { user: adminUserFixture } } as const

function medicine(id: number, overrides: Partial<CatalogMedicine> = {}): CatalogMedicine {
    return {
        id,
        name: `Medicine ${id}`,
        genericName: null,
        strength: null,
        dosageForm: null,
        manufacturer: null,
        imageUrl: null,
        isActive: true,
        createdAt: '2026-01-01T00:00:00+00:00',
        updatedAt: '2026-01-02T00:00:00+00:00',
        ...overrides,
    }
}

function catalogPage(rows: CatalogMedicine[], page: number, total: number) {
    return {
        data: rows,
        meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / 20)), per_page: 20, total },
    }
}

/**
 * Simulates the Laravel admin catalog index: `search` + `is_active` filtering and
 * `page` slicing, mirroring AdminCatalogMedicineController@index.
 */
function pagedServer(rows: CatalogMedicine[]) {
    return (url: string): Response => {
        const params = new URLSearchParams(url.split('?')[1] ?? '')
        let filtered = rows.slice()
        const search = params.get('search')

        if (search) {
            const term = search.toLowerCase()
            filtered = filtered.filter(
                (m) =>
                    m.name.toLowerCase().includes(term) ||
                    (m.manufacturer?.toLowerCase().includes(term) ?? false) ||
                    (m.genericName?.toLowerCase().includes(term) ?? false)
            )
        }

        const isActive = params.get('is_active')

        if (isActive !== null) {
            const want = isActive === '1'
            filtered = filtered.filter((m) => m.isActive === want)
        }

        const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10))
        const total = filtered.length
        const start = (page - 1) * 20
        const rowsOnPage = filtered.slice(start, start + 20)

        return mockResponse({ status: 200, body: catalogPage(rowsOnPage, page, total) })
    }
}

interface CatalogBackendOptions {
    session?: MockResponseSpec
    list?: (url: string) => Promise<Response> | Response
    detail?: (id: number) => Response
    patchStatus?: (id: number, body: { is_active: boolean }) => Response
    destroy?: (id: number) => Response
}

function mockCatalogBackend(options: CatalogBackendOptions) {
    const list = options.list ?? pagedServer([])

    return installFetchMock(async (input, init) => {
        const url = typeof input === 'string' ? input : String(input)
        const method = init?.method ?? 'GET'

        if (url.includes('/sanctum/csrf-cookie')) {
            return mockResponse({ status: 204 })
        }

        if (url.includes('/admin/auth/user')) {
            return mockResponse(options.session ?? sessionOk)
        }

        if (url.includes('/admin/catalog/medicines')) {
            const statusMatch = url.match(/admin\/catalog\/medicines\/(\d+)\/status$/)
            const deleteMatch = url.match(/admin\/catalog\/medicines\/(\d+)$/)
            const detailMatch = url.match(/admin\/catalog\/medicines\/(\d+)$/)

            if (method === 'PATCH' && statusMatch) {
                const body = init?.body ? (JSON.parse(String(init.body)) as { is_active: boolean }) : { is_active: false }

                return (options.patchStatus ?? (() => mockResponse({ status: 200, body: { message: 'ok' } })))(
                    Number.parseInt(statusMatch[1], 10),
                    body
                )
            }

            if (method === 'DELETE' && deleteMatch) {
                return (options.destroy ?? (() => mockResponse({ status: 200, body: { message: 'ok' } })))(
                    Number.parseInt(deleteMatch[1], 10)
                )
            }

            if (method === 'GET' && detailMatch) {
                return (options.detail ?? (() => mockResponse({ status: 200, body: { data: medicine(Number.parseInt(detailMatch[1], 10)) } })))(
                    Number.parseInt(detailMatch[1], 10)
                )
            }

            return list(url)
        }

        return mockResponse({ status: 404, body: { message: `Unexpected request: ${url}` } })
    })
}

const catalogListRequests = (mock: ReturnType<typeof installFetchMock>) =>
    callsTo(mock, '/admin/catalog/medicines?').filter((call) => call.init.method === undefined || call.init.method === 'GET')

describe('CatalogPage', () => {
    it('shows a loading skeleton on the first catalog load, then renders the table', async () => {
        let resolveList!: (spec: Response) => void
        const pending = new Promise<Response>((resolve) => {
            resolveList = resolve
        })

        mockCatalogBackend({ list: () => pending })

        renderAdminApp(['/admin/catalog'])

        await screen.findByRole('heading', { name: 'Medicine Catalog' })
        expect(screen.getByText('Loading catalog')).toBeInTheDocument()
        expect(screen.queryByRole('table')).not.toBeInTheDocument()

        await act(async () => {
            resolveList(mockResponse({ status: 200, body: catalogPage([medicine(1), medicine(2)], 1, 2) }))
        })

        const table = await screen.findByRole('table')
        expect(within(table).getByText('Medicine 1')).toBeInTheDocument()
        expect(within(table).getByText('Medicine 2')).toBeInTheDocument()
    })

    it('renders catalog rows from the real API shape', async () => {
        mockCatalogBackend({
            list: pagedServer([medicine(1), medicine(2, { isActive: false })]),
        })

        renderAdminApp(['/admin/catalog'])

        const table = await screen.findByRole('table')

        expect(within(table).getByText('Medicine 1')).toBeInTheDocument()
        expect(within(table).getByText('Medicine 2')).toBeInTheDocument()
        expect(within(table).getAllByText('Active')).toHaveLength(1)
        expect(within(table).getAllByText('Inactive')).toHaveLength(1)
    })

    it('searches server-side, resets the page to 1 and keeps the URL in sync', async () => {
        const rows = Array.from({ length: 45 }, (_, index) => medicine(index + 1))
        const mock = mockCatalogBackend({ list: pagedServer(rows) })

        renderAdminApp(['/admin/catalog'])
        await screen.findByRole('table')

        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Next page' }))
        await screen.findByText('Page 2 of 3')

        const before = catalogListRequests(mock).length
        expect(before).toBe(2) // page 1 + page 2

        const input = screen.getByLabelText('Search medicines')
        await user.click(input)
        await user.keyboard('Medicine 1')

        // Let the 350ms debounce settle, then flush the resulting refetch.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 500))
        })

        const searchRequests = catalogListRequests(mock)
        expect(searchRequests.length).toBe(before + 1) // one request even after many keystrokes
        const lastUrl = searchRequests[searchRequests.length - 1].url
        expect(lastUrl).toContain('search=Medicine+1')
        expect(lastUrl).toContain('page=1')

        // Pagination keeps the active search term, as required by the URL contract.
        await user.click(screen.getByRole('button', { name: 'Next page' }))
        await waitFor(() => {
            const url = catalogListRequests(mock)[catalogListRequests(mock).length - 1].url
            expect(url).toContain('search=Medicine')
            expect(url).toContain('page=2')
        })
    })

    it('debounces search so typing does not hit the API on every keystroke', async () => {
        const mock = mockCatalogBackend({ list: pagedServer([medicine(1), medicine(2)]) })

        renderAdminApp(['/admin/catalog'])
        await screen.findByRole('table')

        const before = catalogListRequests(mock).length

        const input = screen.getByLabelText('Search medicines')
        fireEvent.change(input, { target: { value: 'M' } })
        fireEvent.change(input, { target: { value: 'Me' } })
        fireEvent.change(input, { target: { value: 'Medic' } })

        // Nothing fired yet — the UI only flushed the URL, the network waits for the 350ms window.
        expect(catalogListRequests(mock).length).toBe(before)

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 400))
        })
        await act(async () => {})

        const after = catalogListRequests(mock)
        expect(after.length).toBe(before + 1)
        expect(after[after.length - 1].url).toContain('search=Medic')
    })

    it('filters by Active/Inactive through the status controls and the URL', async () => {
        const active = medicine(1, { isActive: true })
        const inactive = medicine(2, { isActive: false })
        const mock = mockCatalogBackend({ list: pagedServer([active, inactive]) })

        renderAdminApp(['/admin/catalog'])
        const table = await screen.findByRole('table')

        const user = userEvent.setup()

        await user.click(screen.getByRole('button', { name: 'Active' }))
        await waitFor(() => {
            expect(within(screen.getByRole('table')).queryByText('Medicine 2')).not.toBeInTheDocument()
        })
        const activeRequests = catalogListRequests(mock)
        expect(activeRequests[activeRequests.length - 1].url).toContain('is_active=1')

        await user.click(screen.getByRole('button', { name: 'Inactive' }))
        await waitFor(() => {
            expect(within(screen.getByRole('table')).getByText('Medicine 2')).toBeInTheDocument()
            expect(within(screen.getByRole('table')).queryByText('Medicine 1')).not.toBeInTheDocument()
        })
        const inactiveRequests = catalogListRequests(mock)
        expect(inactiveRequests[inactiveRequests.length - 1].url).toContain('is_active=0')

        await user.click(screen.getByRole('button', { name: 'All' }))
        await waitFor(() => {
            expect(within(screen.getByRole('table')).queryByText('Medicine 1')).toBeInTheDocument()
            expect(within(screen.getByRole('table')).getByText('Medicine 2')).toBeInTheDocument()
        })
        // Returning to "All" clears the status filter from the URL (the fresh `all` page is
        // served from the query cache, so there is no new network request to inspect).
        await waitFor(() => {
            expect(new URLSearchParams(window.location.search).has('status')).toBe(false)
        })
        expect(table).toBeInTheDocument()
    })

    it('paginates with previous/next and preserves the search term in the URL', async () => {
        const rows = Array.from({ length: 45 }, (_, index) => medicine(index + 1))
        mockCatalogBackend({ list: pagedServer(rows) })

        renderAdminApp(['/admin/catalog'])
        await screen.findByRole('table')

        const user = userEvent.setup()
        const next = screen.getByRole('button', { name: 'Next page' })

        await user.click(next)
        await screen.findByText('Page 2 of 3')
        expect(within(screen.getByRole('table')).getByText('Medicine 21')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Next page' }))
        await screen.findByText('Page 3 of 3')
        expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()

        await user.click(screen.getByRole('button', { name: 'Previous page' }))
        await screen.findByText('Page 2 of 3')
        expect(within(screen.getByRole('table')).getByText('Medicine 21')).toBeInTheDocument()
    })

    it('shows the empty catalog state when the catalog has no medicines', async () => {
        mockCatalogBackend({ list: pagedServer([]) })

        renderAdminApp(['/admin/catalog'])

        expect(await screen.findByText('No medicines found.')).toBeInTheDocument()
        expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('differentiates a filtered empty state and can clear the filters', async () => {
        mockCatalogBackend({ list: pagedServer([]) })

        renderAdminApp(['/admin/catalog?search=zzz&status=active'])

        expect(await screen.findByText('No medicines match your search.')).toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
        await screen.findByText('No medicines found.')
    })

    it('shows a friendly server error and a working retry', async () => {
        let failure = true
        mockCatalogBackend({
            list: (): Response =>
                failure
                    ? mockResponse({ status: 500, body: { message: 'internal error (not shown to users)' } })
                    : mockResponse({ status: 200, body: catalogPage([medicine(1)], 1, 1) }),
        })

        renderAdminApp(['/admin/catalog'])

        expect(await screen.findByText('Something went wrong on the server')).toBeInTheDocument()
        expect(screen.queryByText(/internal error/)).not.toBeInTheDocument()

        failure = false
        await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
        await screen.findByRole('table')
    })

    it('returns an expired session (401) to the admin login page', async () => {
        mockCatalogBackend({ list: (): Response => mockResponse({ status: 401, body: { message: 'Unauthenticated.' } }) })

        renderAdminApp(['/admin/catalog'])

        expect(await screen.findByRole('heading', { name: 'Sign in to the admin panel' })).toBeInTheDocument()
    })

    it('shows the administrator-access-required message on 403', async () => {
        mockCatalogBackend({ list: (): Response => mockResponse({ status: 403, body: { message: 'Forbidden.' } }) })

        renderAdminApp(['/admin/catalog'])

        expect(await screen.findByText('Administrator access required')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })

    it('surfaces the retry-after window when rate limited (429)', async () => {
        mockCatalogBackend({
            list: (): Response =>
                mockResponse({ status: 429, body: { message: 'Too Many Attempts.' }, headers: { 'Retry-After': '30' } }),
        })

        renderAdminApp(['/admin/catalog'])

        expect(await screen.findByText('Too many requests')).toBeInTheDocument()
        expect(screen.getByText(/about 30 seconds/)).toBeInTheDocument()
    })

    it('reports a clear connection error on network failure', async () => {
        mockCatalogBackend({
            list: (): Response => {
                throw new TypeError('fetch failed')
            },
        })

        renderAdminApp(['/admin/catalog'])

        expect(await screen.findByText('No connection')).toBeInTheDocument()
    })

    it('confirms a deactivation before submitting the status PATCH', async () => {
        const mock = mockCatalogBackend({
            list: pagedServer([medicine(1)]),
            patchStatus: (id: number, body: { is_active: boolean }): Response => {
                expect(id).toBe(1)
                expect(body).toEqual({ is_active: false })

                return mockResponse({ status: 200, body: { message: 'Status updated.', data: medicine(1, { isActive: false }) } })
            },
        })

        renderAdminApp(['/admin/catalog'])
        await screen.findByRole('table')

        await userEvent.click(screen.getAllByRole('button', { name: 'Actions for Medicine 1' })[0])
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Deactivate' }))

        const dialog = await screen.findByRole('dialog')
        expect(within(dialog).getByText(/no longer appear in active catalog selections for users/)).toBeInTheDocument()

        await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

        expect(await screen.findByText('“Medicine 1” is now inactive in the catalog.')).toBeInTheDocument()
        expect(callsTo(mock, '/admin/catalog/medicines/1/status')).toHaveLength(1)
    })

    it('confirms an activation before submitting the status PATCH', async () => {
        mockCatalogBackend({
            list: pagedServer([medicine(1, { isActive: false })]),
            patchStatus: (_id: number, _body: { is_active: boolean }): Response =>
                mockResponse({ status: 200, body: { message: 'ok', data: { ...medicine(1), isActive: true } } }),
        })

        renderAdminApp(['/admin/catalog'])
        await screen.findByRole('table')

        await userEvent.click(screen.getAllByRole('button', { name: 'Actions for Medicine 1' })[0])
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Activate' }))

        const dialog = await screen.findByRole('dialog')
        await userEvent.click(within(dialog).getByRole('button', { name: 'Activate' }))

        expect(await screen.findByText('“Medicine 1” is now active in the catalog.')).toBeInTheDocument()
    })

    it('requires confirmation before deleting and reports success afterwards', async () => {
        const mock = mockCatalogBackend({
            list: pagedServer([medicine(1), medicine(2)]),
            destroy: (id: number): Response => {
                expect(id).toBe(1)

                return mockResponse({ status: 200, body: { message: 'Medicine deleted successfully.' } })
            },
        })

        renderAdminApp(['/admin/catalog'])
        await screen.findByRole('table')

        await userEvent.click(screen.getAllByRole('button', { name: 'Actions for Medicine 1' })[0])
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))

        const dialog = await screen.findByRole('dialog')
        expect(within(dialog).getByText('Medicine 1')).toBeInTheDocument()
        expect(within(dialog).getByText(/removed?.*global medicine catalog/)).toBeInTheDocument()

        await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

        expect(await screen.findByText('“Medicine 1” was removed from the global catalog.')).toBeInTheDocument()
        expect(callsTo(mock, '/admin/catalog/medicines/1')).toHaveLength(1)
    })

    it('navigates to the Add Medicine form', async () => {
        mockCatalogBackend({ list: pagedServer([medicine(1)]) })

        renderAdminApp(['/admin/catalog'])
        await screen.findByRole('table')

        await userEvent.click(screen.getByRole('button', { name: 'Add Medicine' }))

        expect(await screen.findByRole('heading', { name: 'Add Medicine' })).toBeInTheDocument()
    })

    it('offers Edit in the row actions and opens the edit form', async () => {
        mockCatalogBackend({
            list: pagedServer([medicine(7)]),
            detail: () => mockResponse({ status: 200, body: { data: medicine(7) } }),
        })

        renderAdminApp(['/admin/catalog'])
        await screen.findByRole('table')

        await userEvent.click(screen.getAllByRole('button', { name: 'Actions for Medicine 7' })[0])
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))

        expect(await screen.findByRole('heading', { name: 'Edit Medicine' })).toBeInTheDocument()
        expect(await screen.findByLabelText('Medicine Name *')).toHaveValue('Medicine 7')
    })
})