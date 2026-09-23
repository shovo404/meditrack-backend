import type { ValidationErrors } from '@/lib/api/types'

/**
 * A single typed error for every failed request, so UI code can branch on the status
 * without inspecting response objects.
 */
export class ApiError extends Error {
    readonly status: number
    readonly errors?: ValidationErrors
    readonly retryAfter?: number

    constructor(status: number, message: string, options: { errors?: ValidationErrors; retryAfter?: number } = {}) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.errors = options.errors
        this.retryAfter = options.retryAfter
    }

    /** No response at all: the request never reached the server. */
    get isNetworkError(): boolean {
        return this.status === 0
    }

    get isUnauthenticated(): boolean {
        return this.status === 401
    }

    get isForbidden(): boolean {
        return this.status === 403
    }

    /** Expired CSRF token / session. */
    get isCsrfMismatch(): boolean {
        return this.status === 419
    }

    get isValidationError(): boolean {
        return this.status === 422
    }

    get isRateLimited(): boolean {
        return this.status === 429
    }

    get isServerError(): boolean {
        return this.status >= 500
    }
}

/**
 * Base path of the API. Same-origin by default (`/api/v1`) in both development
 * (through the Vite proxy) and production; override with VITE_ADMIN_API_BASE_URL.
 */
export const API_BASE_URL = (import.meta.env.VITE_ADMIN_API_BASE_URL ?? '/api/v1').replace(/\/+$/, '')

/** Sanctum's session bootstrap endpoint. Deliberately outside the API prefix. */
export const CSRF_COOKIE_URL = '/sanctum/csrf-cookie'

export const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
export const CSRF_HEADER_NAME = 'X-XSRF-TOKEN'

/**
 * Read a cookie by name. Laravel URL-encodes the cookie value, so it is decoded
 * before being used as the `X-XSRF-TOKEN` header (matching what browsers/axios send).
 */
export function readCookie(name: string): string | null {
    const prefix = `${name}=`
    const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(prefix))

    if (!entry) {
        return null
    }

    const value = entry.slice(prefix.length)

    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

let csrfBootstrap: Promise<void> | null = null

/**
 * Ask Laravel to start a session and hand us the CSRF cookie.
 * Memoised so a burst of mutations only bootstraps once.
 */
export function ensureCsrfCookie(force = false): Promise<void> {
    if (!force && csrfBootstrap) {
        return csrfBootstrap
    }

    csrfBootstrap = fetch(CSRF_COOKIE_URL, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    })
        .then((response) => {
            if (!response.ok) {
                throw new ApiError(response.status, 'We could not start a secure session. Please reload the page.')
            }
        })
        .catch((error: unknown) => {
            csrfBootstrap = null
            throw error
        })

    return csrfBootstrap
}

/** Forget the memoised CSRF bootstrap (used after a 419 to re-fetch the token). */
export function resetCsrfCookie(): void {
    csrfBootstrap = null
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiFetchOptions {
    method?: HttpMethod
    /** Plain objects are JSON encoded; FormData is sent as multipart. */
    body?: unknown
    signal?: AbortSignal
    headers?: Record<string, string>
}

function resolveUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) {
        return path
    }

    return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

function isFormData(body: unknown): body is FormData {
    return typeof FormData !== 'undefined' && body instanceof FormData
}

function defaultMessageFor(status: number): string {
    if (status === 401) return 'Your session has expired. Please sign in again.'
    if (status === 403) return 'You do not have permission to perform this action.'
    if (status === 419) return 'Your session expired. Please try again.'
    if (status === 422) return 'Please correct the highlighted fields.'
    if (status === 429) return 'Too many attempts. Please wait a moment and try again.'
    if (status >= 500) return 'Something went wrong on the server. Please try again.'
    return 'The request could not be completed.'
}

async function toApiError(response: Response): Promise<ApiError> {
    let message = defaultMessageFor(response.status)
    let errors: ValidationErrors | undefined

    const retryAfterHeader = response.headers.get('Retry-After')
    const retryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined

    try {
        const payload: unknown = await response.json()

        if (payload && typeof payload === 'object') {
            const record = payload as { message?: unknown; errors?: unknown }

            if (typeof record.message === 'string' && record.message.trim() !== '') {
                message = record.message
            }

            if (record.errors && typeof record.errors === 'object') {
                errors = record.errors as ValidationErrors
            }
        }
    } catch {
        // Non-JSON body (an HTML error page, a proxy error): keep the default message.
    }

    return new ApiError(response.status, message, {
        errors,
        retryAfter: Number.isFinite(retryAfter) ? retryAfter : undefined,
    })
}

/**
 * The one HTTP transport used by the Admin Panel.
 *
 * - `credentials: 'include'` so the Sanctum session cookie travels with every call.
 * - State-changing requests first bootstrap `/sanctum/csrf-cookie` and echo the
 *   `XSRF-TOKEN` cookie in the `X-XSRF-TOKEN` header.
 * - A single automatic retry after a 419 (stale token), then a typed ApiError.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}, retryOnCsrfMismatch = true): Promise<T> {
    const method = options.method ?? 'GET'
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method)
    const body = options.body

    if (mutating) {
        await ensureCsrfCookie()
    }

    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...options.headers,
    }

    let payload: BodyInit | undefined

    if (isFormData(body)) {
        // Let the browser set the multipart boundary.
        payload = body
    } else if (body !== undefined) {
        headers['Content-Type'] = 'application/json'
        payload = JSON.stringify(body)
    }

    if (mutating) {
        const token = readCookie(CSRF_COOKIE_NAME)

        if (token) {
            headers[CSRF_HEADER_NAME] = token
        }
    }

    let response: Response

    try {
        response = await fetch(resolveUrl(path), {
            method,
            headers,
            body: payload,
            credentials: 'include',
            signal: options.signal,
        })
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw error
        }

        throw new ApiError(0, 'We could not reach the server. Check your connection and try again.')
    }

    if (response.status === 419 && retryOnCsrfMismatch) {
        resetCsrfCookie()
        await ensureCsrfCookie(true)

        return apiFetch<T>(path, options, false)
    }

    if (!response.ok) {
        throw await toApiError(response)
    }

    if (response.status === 204 || response.headers.get('Content-Length') === '0') {
        return undefined as T
    }

    const text = await response.text()

    if (text.trim() === '') {
        return undefined as T
    }

    return JSON.parse(text) as T
}
