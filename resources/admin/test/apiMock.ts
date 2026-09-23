import { installFetchMock, mockResponse, type FetchMock, type MockResponseSpec } from '@/test/fetchMock'
import { adminUserFixture } from '@/test/fixtures'

export interface AdminApiMockOptions {
    /** `GET /api/v1/admin/auth/user` (defaults to 401 = no session). */
    session?: MockResponseSpec
    /** `POST /api/v1/admin/auth/login` (defaults to a successful admin login). */
    login?: MockResponseSpec | ((init: RequestInit) => MockResponseSpec)
    /** `POST /api/v1/admin/auth/logout` (defaults to 200). */
    logout?: MockResponseSpec
}

/**
 * Emulates the Phase 2A endpoints (plus the Sanctum CSRF bootstrap) so the SPA can be
 * driven end to end in tests.
 */
export function mockAdminApi(options: AdminApiMockOptions = {}): FetchMock {
    const session: MockResponseSpec = options.session ?? { status: 401, body: { message: 'Unauthenticated.' } }
    const login = options.login ?? { status: 200, body: { message: 'Logged in successfully.', user: adminUserFixture } }
    const logout: MockResponseSpec = options.logout ?? { status: 200, body: { message: 'Logged out successfully.' } }

    return installFetchMock((input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

        if (url.includes('/sanctum/csrf-cookie')) {
            return mockResponse({ status: 204 })
        }

        if (url.includes('/admin/auth/user')) {
            return mockResponse(session)
        }

        if (url.includes('/admin/auth/login')) {
            return mockResponse(typeof login === 'function' ? login(init ?? {}) : login)
        }

        if (url.includes('/admin/auth/logout')) {
            return mockResponse(logout)
        }

        return mockResponse({ status: 404, body: { message: `Unexpected request: ${url}` } })
    })
}
