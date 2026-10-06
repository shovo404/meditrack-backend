import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError, apiFetch, ensureCsrfCookie, readCookie, resetCsrfCookie } from '@/lib/api/client'
import { apiHandler, fetchCalls, installFetchMock, mockResponse } from '@/test/fetchMock'

describe('apiFetch', () => {
    beforeEach(() => {
        // The CSRF bootstrap is memoised at module scope: reset it between tests.
        resetCsrfCookie()
    })

    it('sends read requests with credentials, JSON headers and no CSRF token', async () => {
        const fetchMock = installFetchMock(() => mockResponse({ body: { user: { id: 1 } } }))

        const payload = await apiFetch<{ user: { id: number } }>('/admin/auth/user')

        expect(payload).toEqual({ user: { id: 1 } })
        expect(fetchMock).toHaveBeenCalledTimes(1)

        const [call] = fetchCalls(fetchMock)

        expect(call.url).toBe('/api/v1/admin/auth/user')
        expect(call.init.method).toBe('GET')
        expect(call.init.credentials).toBe('include')
        expect(call.headers.Accept).toBe('application/json')
        expect(call.headers['X-Requested-With']).toBe('XMLHttpRequest')
        expect(call.headers['X-XSRF-TOKEN']).toBeUndefined()
    })

    it('bootstraps the CSRF cookie and echoes the URL-decoded token on mutations', async () => {
        document.cookie = 'XSRF-TOKEN=abc%2Fdef%3D'
        const fetchMock = installFetchMock((input) =>
            String(input).includes('/sanctum/csrf-cookie')
                ? mockResponse({ status: 204 })
                : mockResponse({ body: { message: 'Logged out successfully.' } })
        )

        await apiFetch('/admin/auth/logout', { method: 'POST' })

        const calls = fetchCalls(fetchMock)

        expect(calls).toHaveLength(2)
        expect(calls[0].url).toBe('/sanctum/csrf-cookie')
        expect(calls[0].init.credentials).toBe('include')
        expect(calls[1].url).toBe('/api/v1/admin/auth/logout')
        expect(calls[1].init.method).toBe('POST')
        expect(calls[1].headers['X-XSRF-TOKEN']).toBe('abc/def=')
    })

    it('only bootstraps the CSRF cookie once for a burst of mutations', async () => {
        document.cookie = 'XSRF-TOKEN=token'
        const fetchMock = installFetchMock(() => mockResponse({ body: { ok: true } }))

        await ensureCsrfCookie()
        await apiFetch('/admin/auth/logout', { method: 'POST' })
        await apiFetch('/admin/auth/login', { method: 'POST', body: { email: 'a@b.c', password: 'x' } })

        const csrfCalls = fetchCalls(fetchMock).filter((call) => call.url.includes('/sanctum/csrf-cookie'))

        expect(csrfCalls).toHaveLength(1)
    })

    it('sends JSON bodies for POST requests', async () => {
        document.cookie = 'XSRF-TOKEN=token'
        const fetchMock = installFetchMock(() => mockResponse({ body: { ok: true } }))

        await apiFetch('/admin/auth/login', { method: 'POST', body: { email: 'a@b.c', password: 'secret' } })

        const loginCall = fetchCalls(fetchMock).find((call) => call.url.includes('/admin/auth/login'))

        expect(loginCall?.headers['Content-Type']).toBe('application/json')
        expect(loginCall?.init.body).toBe(JSON.stringify({ email: 'a@b.c', password: 'secret' }))
    })

    it('maps 401 responses to a typed unauthenticated error using the server message', async () => {
        installFetchMock(apiHandler({ status: 401, body: { message: 'Invalid credentials.' } }))

        const error = await apiFetch('/admin/auth/login', { method: 'POST' }).catch((e: unknown) => e)

        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(401)
        expect((error as ApiError).isUnauthenticated).toBe(true)
        expect((error as ApiError).message).toBe('Invalid credentials.')
    })

    it('maps 403 responses to forbidden', async () => {
        installFetchMock(
            apiHandler({ status: 403, body: { message: 'This account does not have administrator access.' } })
        )

        const error = (await apiFetch('/admin/auth/login', { method: 'POST' }).catch((e: unknown) => e)) as ApiError

        expect(error.isForbidden).toBe(true)
        expect(error.message).toBe('This account does not have administrator access.')
    })

    it('exposes 422 validation errors per field', async () => {
        installFetchMock(
            apiHandler({
                status: 422,
                body: { message: 'The email field is required.', errors: { email: ['The email field is required.'] } },
            })
        )

        const error = (await apiFetch('/admin/auth/login', { method: 'POST' }).catch((e: unknown) => e)) as ApiError

        expect(error.isValidationError).toBe(true)
        expect(error.errors?.email[0]).toBe('The email field is required.')
    })

    it('maps 429 responses and reads the Retry-After header', async () => {
        installFetchMock(
            apiHandler({
                status: 429,
                body: { message: 'Too many login attempts. Please try again shortly.' },
                headers: { 'Retry-After': '42' },
            })
        )

        const error = (await apiFetch('/admin/auth/login', { method: 'POST' }).catch((e: unknown) => e)) as ApiError

        expect(error.isRateLimited).toBe(true)
        expect(error.retryAfter).toBe(42)
    })

    it('falls back to a generic message when the error body is not JSON', async () => {
        installFetchMock(apiHandler({ status: 500, raw: '<html>Server Error</html>' }))

        const error = (await apiFetch('/admin/auth/user').catch((e: unknown) => e)) as ApiError

        expect(error.isServerError).toBe(true)
        expect(error.message).toBe('Something went wrong on the server. Please try again.')
    })

    it('reports network failures as a status 0 network error', async () => {
        installFetchMock(() => Promise.reject(new TypeError('Failed to fetch')))

        const error = (await apiFetch('/admin/auth/user').catch((e: unknown) => e)) as ApiError

        expect(error.isNetworkError).toBe(true)
        expect(error.status).toBe(0)
        expect(error.message).toContain('could not reach the server')
    })

    it('retries once after a 419 by re-fetching the CSRF cookie', async () => {
        document.cookie = 'XSRF-TOKEN=stale'
        let loginAttempts = 0

        const fetchMock = installFetchMock((input) => {
            const url = String(input)

            if (url.includes('/sanctum/csrf-cookie')) {
                return mockResponse({ status: 204 })
            }

            loginAttempts += 1

            return loginAttempts === 1
                ? mockResponse({ status: 419, body: { message: 'CSRF token mismatch.' } })
                : mockResponse({ body: { message: 'Logged in successfully.' } })
        })

        const payload = await apiFetch<{ message: string }>('/admin/auth/login', { method: 'POST' })

        expect(payload.message).toBe('Logged in successfully.')

        const urls = fetchCalls(fetchMock).map((call) => call.url)

        expect(urls).toEqual([
            '/sanctum/csrf-cookie',
            '/api/v1/admin/auth/login',
            '/sanctum/csrf-cookie',
            '/api/v1/admin/auth/login',
        ])
    })

    it('returns undefined for 204 and empty bodies', async () => {
        installFetchMock(() => mockResponse({ status: 204 }))
        expect(await apiFetch('/admin/auth/logout', { method: 'POST' })).toBeUndefined()

        installFetchMock(() => mockResponse({ status: 200, raw: '' }))
        expect(await apiFetch('/admin/auth/user')).toBeUndefined()
    })

    it('throws an ApiError when the server returns HTML instead of JSON (e.g. Netlify fallback)', async () => {
        installFetchMock(apiHandler({ status: 200, raw: '<html>SPA Fallback</html>' }))

        const error = (await apiFetch('/admin/auth/user').catch((e: unknown) => e)) as ApiError

        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(500)
        expect(error.message).toBe('Received an invalid (non-JSON) response from the server.')
    })

    it('resolves relative paths against the configured API base path', async () => {
        const fetchMock = installFetchMock(() => mockResponse({ body: {} }))

        await apiFetch('admin/auth/user')
        await apiFetch('/admin/auth/user')

        expect(fetchCalls(fetchMock).map((call) => call.url)).toEqual([
            '/api/v1/admin/auth/user',
            '/api/v1/admin/auth/user',
        ])
    })

    it('leaves absolute URLs untouched', async () => {
        const fetchMock = installFetchMock(() => mockResponse({ body: {} }))

        await apiFetch('https://api.example.test/v1/health')

        expect(fetchCalls(fetchMock)[0].url).toBe('https://api.example.test/v1/health')
    })

    it('reads and decodes cookies safely', () => {
        document.cookie = 'XSRF-TOKEN=hello%20world'
        document.cookie = 'session=abc'

        expect(readCookie('XSRF-TOKEN')).toBe('hello world')
        expect(readCookie('session')).toBe('abc')
        expect(readCookie('missing')).toBeNull()
    })
})
