import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Headless UI v2's floating-ui dependency observes layout during popover rendering;
// jsdom has no ResizeObserver, so provide a no-op.
class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

afterEach(() => {
    cleanup()

    // Cookies carry the simulated session/CSRF state, so never leak them between tests.
    for (const cookie of document.cookie.split('; ')) {
        const name = cookie.split('=')[0]

        if (name) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
        }
    }
})
