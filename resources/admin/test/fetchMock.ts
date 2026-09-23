import { vi, type Mock } from 'vitest'

export interface MockResponseSpec {
    status?: number
    body?: unknown
    /** Raw text body, used to simulate non-JSON responses (HTML error pages, proxies). */
    raw?: string
    headers?: Record<string, string>
}

export type FetchMock = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>

/**
 * Minimal Response stand-in so tests never depend on the runtime having a full
 * fetch/Response implementation (jsdom does not provide one).
 */
export function mockResponse(spec: MockResponseSpec = {}): Response {
    const status = spec.status ?? 200
    const headers: Record<string, string> = {}

    for (const [key, value] of Object.entries(spec.headers ?? {})) {
        headers[key.toLowerCase()] = value
    }

    const raw = spec.raw ?? (spec.body === undefined ? null : JSON.stringify(spec.body))

    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get: (name: string) => headers[name.toLowerCase()] ?? null,
        },
        json: async () => {
            if (raw === null) {
                throw new Error('No JSON body')
            }

            return JSON.parse(raw) as unknown
        },
        text: async () => raw ?? '',
    } as unknown as Response
}

export function installFetchMock(
    handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>
): FetchMock {
    const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(input, init))
    vi.stubGlobal('fetch', mock)

    return mock as unknown as FetchMock
}

/**
 * Handler that answers the Sanctum CSRF bootstrap with 204 and every other request with
 * the given response — so error responses under test are not returned for the bootstrap.
 */
export function apiHandler(spec: MockResponseSpec) {
    return (input: RequestInfo | URL) =>
        String(input).includes('/sanctum/csrf-cookie')
            ? mockResponse({ status: 204 })
            : mockResponse(spec)
}

export interface RecordedCall {
    url: string
    init: RequestInit
    headers: Record<string, string>
}

export function fetchCalls(mock: FetchMock): RecordedCall[] {
    return mock.mock.calls.map(([input, init]) => ({
        url: typeof input === 'string' ? input : String(input),
        init: init ?? {},
        headers: (init?.headers ?? {}) as Record<string, string>,
    }))
}

export function callsTo(mock: FetchMock, fragment: string): RecordedCall[] {
    return fetchCalls(mock).filter((call) => call.url.includes(fragment))
}
