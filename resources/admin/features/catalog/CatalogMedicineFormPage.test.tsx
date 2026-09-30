import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { callsTo, installFetchMock, mockResponse, type MockResponseSpec } from '@/test/fetchMock'
import { adminUserFixture } from '@/test/fixtures'
import { renderAdminApp } from '@/test/renderAdminApp'
import type { CatalogMedicine } from '@/features/catalog/types'

const sessionOk = { status: 200, body: { user: adminUserFixture } } as const

function medicine(id: number, overrides: Partial<CatalogMedicine> = {}): CatalogMedicine {
    return {
        id,
        name: `Test Medicine ${id}`,
        genericName: 'Acetaminophen',
        strength: '500 mg',
        dosageForm: 'Tablet',
        manufacturer: 'Sun Pharma',
        imageUrl: null,
        isActive: true,
        createdAt: '2026-01-01T00:00:00+00:00',
        updatedAt: '2026-01-02T00:00:00+00:00',
        ...overrides,
    }
}

function catalogPage(rows: CatalogMedicine[]) {
    return {
        data: rows,
        meta: { current_page: 1, last_page: 1, per_page: 20, total: rows.length },
    }
}

function pngFile(name = 'stripes.png'): File {
    return new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' })
}

function txtFile(): File {
    return new File(['hello'], 'notes.txt', { type: 'text/plain' })
}

function tooLargePng(): File {
    return new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' })
}

function bodyFormData(init: RequestInit | undefined): FormData {
    expect(init?.body).toBeInstanceOf(FormData)
    return init!.body as FormData
}

interface FormBackendOptions {
    session?: MockResponseSpec
    /** `GET /admin/catalog/medicines/{id}` — returns the medicine being edited. */
    detail?: (id: number) => MockResponseSpec | Promise<MockResponseSpec>
    /** `POST /admin/catalog/medicines` — create. Inspect `init` (multipart) before replying. */
    create?: (init: RequestInit) => MockResponseSpec | Promise<MockResponseSpec>
    /** `PUT /admin/catalog/medicines/{id}` — update. */
    update?: (id: number, init: RequestInit) => MockResponseSpec | Promise<MockResponseSpec>
    /** `PATCH /admin/catalog/medicines/{id}/image` — remove image. */
    removeImage?: (id: number) => MockResponseSpec | Promise<MockResponseSpec>
    /** `GET /admin/catalog/medicines?...` — list, used after redirecting back. */
    list?: (url: string) => Response | Promise<Response>
}

function mockFormBackend(options: FormBackendOptions = {}) {
    const list = options.list ?? (() => mockResponse({ status: 200, body: catalogPage([medicine(1)]) }))

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
            const imageMatch = url.match(/admin\/catalog\/medicines\/(\d+)\/image$/)
            const statusMatch = url.match(/admin\/catalog\/medicines\/(\d+)\/status$/)
            const idMatch = url.match(/admin\/catalog\/medicines\/(\d+)$/)

            if (method === 'PATCH' && imageMatch) {
                const id = Number.parseInt(imageMatch[1], 10)
                expect(JSON.parse(String(init?.body ?? '{}'))).toEqual({ remove_image: true })
                const spec =
                    options.removeImage?.(id) ??
                    { status: 200, body: { message: 'Image removed.', data: medicine(id) } }
                return mockResponse(await spec)
            }

            if (method === 'PUT' && idMatch) {
                const id = Number.parseInt(idMatch[1], 10)
                const spec =
                    options.update?.(id, init ?? {}) ??
                    { status: 200, body: { message: 'Updated.', data: medicine(id) } }
                return mockResponse(await spec)
            }

            if (method === 'POST' && !imageMatch && !statusMatch) {
                const spec =
                    options.create?.(init ?? {}) ??
                    { status: 201, body: { message: 'Medicine created successfully.', data: medicine(99) } }
                return mockResponse(await spec)
            }

            if (method === 'GET' && idMatch) {
                const id = Number.parseInt(idMatch[1], 10)
                const spec = options.detail?.(id) ?? { status: 200, body: { data: medicine(id) } }
                return mockResponse(await spec)
            }

            return await list(url)
        }

        return mockResponse({ status: 404, body: { message: `Unexpected request: ${url}` } })
    })
}

describe('CatalogMedicineFormPage – create', () => {
    it('creates a medicine via multipart POST and returns to the catalog', async () => {
        const mock = mockFormBackend({
            create: (init) => {
                const body = bodyFormData(init)

                expect(body.get('name')).toBe('New Med')
                expect(body.get('generic_name')).toBe('Acetaminophen')
                expect(body.get('strength')).toBe('500 mg')
                expect(body.get('dosage_form')).toBe('Tablet')
                expect(body.get('manufacturer')).toBe('Sun Pharma')
                expect(body.get('is_active')).toBe('1')

                return { status: 201, body: { message: 'Medicine created successfully.', data: medicine(99, { name: 'New Med' }) } }
            },
        })

        renderAdminApp(['/admin/catalog/new'])
        expect(await screen.findByRole('heading', { name: 'Add Medicine' })).toBeInTheDocument()

        const user = userEvent.setup()
        await user.type(screen.getByLabelText('Medicine Name *'), 'New Med')
        await user.type(screen.getByLabelText('Generic name'), 'Acetaminophen')
        await user.type(screen.getByLabelText('Strength'), '500 mg')
        await user.type(screen.getByLabelText('Dosage form'), 'Tablet')
        await user.type(screen.getByLabelText('Manufacturer'), 'Sun Pharma')
        await user.click(screen.getByRole('button', { name: 'Create medicine' }))

        // Lands back on the catalog listing (heading of the list page).
        expect(await screen.findByRole('heading', { name: 'Medicine Catalog' })).toBeInTheDocument()
        expect(callsTo(mock, '/admin/catalog/medicines').some((call) => call.init.method === 'POST')).toBe(true)
    })

    it('requires a medicine name before submitting', async () => {
        const mock = mockFormBackend({})

        renderAdminApp(['/admin/catalog/new'])
        await screen.findByRole('heading', { name: 'Add Medicine' })

        await userEvent.click(screen.getByRole('button', { name: 'Create medicine' }))

        expect(await screen.findByText('Medicine name is required.')).toBeInTheDocument()
        expect(callsTo(mock, '/admin/catalog/medicines').some((call) => call.init.method === 'POST')).toBe(false)
    })

    it('rejects a medicine name over 255 characters client-side', async () => {
        mockFormBackend({})

        renderAdminApp(['/admin/catalog/new'])
        await screen.findByRole('heading', { name: 'Add Medicine' })

        await userEvent.type(screen.getByLabelText('Medicine Name *'), 'x'.repeat(256))
        await userEvent.click(screen.getByRole('button', { name: 'Create medicine' }))

        expect(await screen.findByText('Medicine name must be 255 characters or fewer.')).toBeInTheDocument()
    })

    it('sends the inactive flag as 0 when unchecking the status field', async () => {
        let isActiveValue: string | null = '1'
        mockFormBackend({
            create: (init) => {
                const value = bodyFormData(init).get('is_active')
                isActiveValue = typeof value === 'string' ? value : null
                return { status: 201, body: { message: 'created', data: medicine(99, { name: 'New Med' }) } }
            },
        })

        renderAdminApp(['/admin/catalog/new'])
        await screen.findByRole('heading', { name: 'Add Medicine' })

        const user = userEvent.setup()
        await user.type(screen.getByLabelText('Medicine Name *'), 'New Med')
        await user.click(screen.getByText('Active in the catalog'))
        await user.click(screen.getByRole('button', { name: 'Create medicine' }))

        expect(await screen.findByRole('heading', { name: 'Medicine Catalog' })).toBeInTheDocument()
        expect(isActiveValue).toBe('0')
    })

    it('maps backend 422 field errors onto the form', async () => {
        mockFormBackend({
            create: () => ({
                status: 422,
                body: {
                    message: 'The given data was invalid.',
                    errors: {
                        name: ['The name has already been taken.'],
                        image: ['The image must be a file of type: jpg, jpeg, png, webp.'],
                    },
                },
            }),
        })

        renderAdminApp(['/admin/catalog/new'])
        await screen.findByRole('heading', { name: 'Add Medicine' })

        await userEvent.type(screen.getByLabelText('Medicine Name *'), 'Duplicate')
        await userEvent.click(screen.getByRole('button', { name: 'Create medicine' }))

        expect(await screen.findByText('The name has already been taken.')).toBeInTheDocument()
        expect(screen.getByText('The image must be a file of type: jpg, jpeg, png, webp.')).toBeInTheDocument()
    })

    it('holds a client-side type check: text files are rejected', async () => {
        mockFormBackend({})

        renderAdminApp(['/admin/catalog/new'])
        await screen.findByRole('heading', { name: 'Add Medicine' })

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
        // applyAccept off: the client-side validator must reject this file, not the helper.
        await userEvent.upload(fileInput, txtFile(), { applyAccept: false })

        expect(await screen.findByText('Please choose a JPG, PNG or WEBP image.')).toBeInTheDocument()
        expect(screen.getByText('No image yet')).toBeInTheDocument()
    })

    it('holds a client-side size check: images over 5 MB are rejected', async () => {
        mockFormBackend({})

        renderAdminApp(['/admin/catalog/new'])
        await screen.findByRole('heading', { name: 'Add Medicine' })

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
        await userEvent.upload(fileInput, tooLargePng(), { applyAccept: false })

        expect(await screen.findByText('Image must be 5 MB or smaller.')).toBeInTheDocument()
        expect(screen.getByText('No image yet')).toBeInTheDocument()
    })

    it('attaches a chosen, valid image to the create payload', async () => {
        let uploadedImage: unknown = null
        mockFormBackend({
            create: (init) => {
                uploadedImage = bodyFormData(init).get('image')
                return { status: 201, body: { message: 'created', data: medicine(99, { name: 'New Med' }) } }
            },
        })

        renderAdminApp(['/admin/catalog/new'])
        await screen.findByRole('heading', { name: 'Add Medicine' })

        const user = userEvent.setup()
        await user.type(screen.getByLabelText('Medicine Name *'), 'New Med')

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
        await user.upload(fileInput, pngFile('stripes.png'))

        // Preview shows the pending file with its replace-on-save semantics.
        expect(await screen.findByAltText('Preview of New Med medicine')).toBeInTheDocument()
        expect(screen.getByText('This image will replace the current one when you save.')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Create medicine' }))

        expect(await screen.findByRole('heading', { name: 'Medicine Catalog' })).toBeInTheDocument()
        expect(uploadedImage).toBeInstanceOf(File)
        expect((uploadedImage as File).name).toBe('stripes.png')
    })

    it('sends a 401 submission back to the admin login', async () => {
        mockFormBackend({ create: () => ({ status: 401, body: { message: 'Unauthenticated.' } }) })

        renderAdminApp(['/admin/catalog/new'])
        await screen.findByRole('heading', { name: 'Add Medicine' })

        await userEvent.type(screen.getByLabelText('Medicine Name *'), 'New Med')
        await userEvent.click(screen.getByRole('button', { name: 'Create medicine' }))

        expect(await screen.findByRole('heading', { name: 'Sign in to the admin panel' })).toBeInTheDocument()
    })

    it('shows the administrator-access-required message on 403', async () => {
        mockFormBackend({ create: () => ({ status: 403, body: { message: 'Forbidden.' } }) })

        renderAdminApp(['/admin/catalog/new'])
        await screen.findByRole('heading', { name: 'Add Medicine' })

        await userEvent.type(screen.getByLabelText('Medicine Name *'), 'New Med')
        await userEvent.click(screen.getByRole('button', { name: 'Create medicine' }))

        expect(await screen.findByText('Administrator access required')).toBeInTheDocument()
    })

    it('surfaces the retry-after window when rate limited (429)', async () => {
        mockFormBackend({
            create: () => ({ status: 429, body: { message: 'Too Many Attempts.' }, headers: { 'Retry-After': '30' } }),
        })

        renderAdminApp(['/admin/catalog/new'])
        await screen.findByRole('heading', { name: 'Add Medicine' })

        await userEvent.type(screen.getByLabelText('Medicine Name *'), 'New Med')
        await userEvent.click(screen.getByRole('button', { name: 'Create medicine' }))

        expect(await screen.findByText('Too many requests')).toBeInTheDocument()
        expect(screen.getByText(/about 30 seconds/)).toBeInTheDocument()
    })

    it('shows a friendly message on a server error (500)', async () => {
        mockFormBackend({
            create: () => ({ status: 500, body: { message: 'internal error (not shown to users)' } }),
        })

        renderAdminApp(['/admin/catalog/new'])
        await screen.findByRole('heading', { name: 'Add Medicine' })

        await userEvent.type(screen.getByLabelText('Medicine Name *'), 'New Med')
        await userEvent.click(screen.getByRole('button', { name: 'Create medicine' }))

        expect(await screen.findByText('Something went wrong on the server')).toBeInTheDocument()
        expect(screen.queryByText(/internal error/)).not.toBeInTheDocument()
    })

    it('reports a clear connection error on network failure', async () => {
        mockFormBackend({
            create: () => {
                throw new TypeError('fetch failed')
            },
        })

        renderAdminApp(['/admin/catalog/new'])
        await screen.findByRole('heading', { name: 'Add Medicine' })

        await userEvent.type(screen.getByLabelText('Medicine Name *'), 'New Med')
        await userEvent.click(screen.getByRole('button', { name: 'Create medicine' }))

        expect(await screen.findByText('No connection')).toBeInTheDocument()
    })

    it('disables the submit button while the create request is in flight', async () => {
        let resolveCreate!: (spec: MockResponseSpec) => void
        const pending = new Promise<MockResponseSpec>((resolve) => {
            resolveCreate = resolve
        })

        mockFormBackend({ create: () => pending })

        renderAdminApp(['/admin/catalog/new'])
        await screen.findByRole('heading', { name: 'Add Medicine' })

        await userEvent.type(screen.getByLabelText('Medicine Name *'), 'New Med')
        await userEvent.click(screen.getByRole('button', { name: 'Create medicine' }))

        const submit = await screen.findByRole('button', { name: 'Create medicine' })
        expect(submit).toBeDisabled()

        resolveCreate?.({ status: 201, body: { message: 'created', data: medicine(99, { name: 'New Med' }) } })
        await screen.findByRole('heading', { name: 'Medicine Catalog' })
    })
})

describe('CatalogMedicineFormPage – edit', () => {
    it('loads the medicine and prefills every editable field', async () => {
        mockFormBackend({
            detail: () => ({
                status: 200,
                body: {
                    data: medicine(7),
                },
            }),
        })

        renderAdminApp(['/admin/catalog/7/edit'])
        expect(await screen.findByRole('heading', { name: 'Edit Medicine' })).toBeInTheDocument()

        expect(await screen.findByLabelText('Medicine Name *')).toHaveValue('Test Medicine 7')
        expect(screen.getByLabelText('Generic name')).toHaveValue('Acetaminophen')
        expect(screen.getByLabelText('Strength')).toHaveValue('500 mg')
        expect(screen.getByLabelText('Dosage form')).toHaveValue('Tablet')
        expect(screen.getByLabelText('Manufacturer')).toHaveValue('Sun Pharma')
        expect(screen.getByLabelText('Active in the catalog')).toBeChecked()
    })

    it('updates text fields via multipart PUT and returns to the catalog', async () => {
        const mock = mockFormBackend({
            update: (id, init) => {
                expect(id).toBe(7)
                const body = bodyFormData(init)

                expect(body.get('name')).toBe('Test Medicine 7 (updated)')
                expect(body.get('strength')).toBe('1000 mg')
                expect(body.get('is_active')).toBe('0')

                return { status: 200, body: { message: 'Updated.', data: medicine(7, { name: 'Test Medicine 7 (updated)', strength: '1000 mg', isActive: false }) } }
            },
        })

        renderAdminApp(['/admin/catalog/7/edit'])
        await screen.findByLabelText('Medicine Name *')

        const user = userEvent.setup()
        await user.clear(screen.getByLabelText('Medicine Name *'))
        await user.type(screen.getByLabelText('Medicine Name *'), 'Test Medicine 7 (updated)')
        await user.clear(screen.getByLabelText('Strength'))
        await user.type(screen.getByLabelText('Strength'), '1000 mg')
        await user.click(screen.getByText('Active in the catalog'))
        await user.click(screen.getByRole('button', { name: 'Save medicine' }))

        expect(await screen.findByRole('heading', { name: 'Medicine Catalog' })).toBeInTheDocument()
        expect(callsTo(mock, '/admin/catalog/medicines/7').some((call) => call.init.method === 'PUT')).toBe(true)
    })

    it('replaces the stored image through the PUT payload', async () => {
        let uploadedImage: unknown = null
        mockFormBackend({
            detail: () => ({
                status: 200,
                body: { data: medicine(7, { imageUrl: '/storage/catalog-medicines/old.png' }) },
            }),
            update: (id, init) => {
                expect(id).toBe(7)
                uploadedImage = bodyFormData(init).get('image')
                return { status: 200, body: { message: 'Updated.', data: medicine(7, { imageUrl: '/storage/catalog-medicines/new.png' }) } }
            },
        })

        renderAdminApp(['/admin/catalog/7/edit'])
        expect(await screen.findByAltText('Current image of Test Medicine 7')).toBeInTheDocument()

        const user = userEvent.setup()
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
        await user.upload(fileInput, pngFile('new.png'))

        expect(await screen.findByAltText('Preview of Test Medicine 7 medicine')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Save medicine' }))

        expect(await screen.findByRole('heading', { name: 'Medicine Catalog' })).toBeInTheDocument()
        expect(uploadedImage).toBeInstanceOf(File)
        expect((uploadedImage as File).name).toBe('new.png')
    })

    it('removes the stored image after confirmation via the image endpoint', async () => {
        let imageUrl: string | null = '/storage/catalog-medicines/old.png'
        const mock = mockFormBackend({
            detail: () => ({ status: 200, body: { data: medicine(7, { imageUrl }) } }),
            removeImage: (id) => {
                expect(id).toBe(7)
                imageUrl = null
                return { status: 200, body: { message: 'Image removed.', data: medicine(7, { imageUrl: null }) } }
            },
        })

        renderAdminApp(['/admin/catalog/7/edit'])
        expect(await screen.findByAltText('Current image of Test Medicine 7')).toBeInTheDocument()

        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Remove image' }))

        const dialog = await screen.findByRole('dialog')
        expect(within(dialog).getByText('Remove this medicine image?')).toBeInTheDocument()
        expect(within(dialog).getByText(/only the stored image is removed/)).toBeInTheDocument()

        await user.click(within(dialog).getByRole('button', { name: 'Remove image' }))

        // Detail refetch shows the fallback placeholder.
        expect(await screen.findByText('No image yet')).toBeInTheDocument()
        expect(callsTo(mock, '/admin/catalog/medicines/7/image')).toHaveLength(1)
    })

    it('keeps the form on screen when the cancel removal dialog is used', async () => {
        let removed = false
        mockFormBackend({
            detail: () => ({
                status: 200,
                body: { data: medicine(7, { imageUrl: '/storage/catalog-medicines/old.png' }) },
            }),
            removeImage: () => {
                removed = true
                return { status: 200, body: { message: 'Image removed.', data: medicine(7, { imageUrl: null }) } }
            },
        })

        renderAdminApp(['/admin/catalog/7/edit'])
        expect(await screen.findByAltText('Current image of Test Medicine 7')).toBeInTheDocument()

        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Remove image' }))
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))

        expect(screen.getByRole('heading', { name: 'Edit Medicine' })).toBeInTheDocument()
        expect(screen.getByAltText('Current image of Test Medicine 7')).toBeInTheDocument()
        expect(removed).toBe(false)
    })

    it('blocks navigating away while the form is dirty until the user leaves', async () => {
        mockFormBackend({})

        renderAdminApp(['/admin/catalog/7/edit'])
        await screen.findByLabelText('Medicine Name *')

        const user = userEvent.setup()
        await user.type(screen.getByLabelText('Medicine Name *'), ' made messy')

        await user.click(screen.getByRole('button', { name: 'Back to catalog' }))

        const dialog = await screen.findByRole('dialog')
        expect(within(dialog).getByText('You have unsaved changes')).toBeInTheDocument()

        await user.click(within(dialog).getByRole('button', { name: 'Stay' }))
        expect(screen.getByRole('heading', { name: 'Edit Medicine' })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Back to catalog' }))
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Leave' }))

        expect(await screen.findByRole('heading', { name: 'Medicine Catalog' })).toBeInTheDocument()
    })

    it('does not block navigation when nothing was changed', async () => {
        mockFormBackend({})

        renderAdminApp(['/admin/catalog/7/edit'])
        await screen.findByLabelText('Medicine Name *')

        await userEvent.click(screen.getByRole('button', { name: 'Back to catalog' }))

        expect(await screen.findByRole('heading', { name: 'Medicine Catalog' })).toBeInTheDocument()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('redirects to login when the detail fetch is rejected with 401', async () => {
        mockFormBackend({ detail: () => ({ status: 401, body: { message: 'Unauthenticated.' } }) })

        renderAdminApp(['/admin/catalog/7/edit'])

        expect(await screen.findByRole('heading', { name: 'Sign in to the admin panel' })).toBeInTheDocument()
    })

    it('surfaces a 404/not-found detail error with a retry', async () => {
        let fail = true
        mockFormBackend({
            detail: () =>
                fail
                    ? { status: 404, body: { message: 'Not found.' } }
                    : { status: 200, body: { data: medicine(7) } },
        })

        renderAdminApp(['/admin/catalog/7/edit'])

        expect(await screen.findByText('Could not load the catalog')).toBeInTheDocument()

        fail = false
        await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
        await screen.findByLabelText('Medicine Name *')
    })
})