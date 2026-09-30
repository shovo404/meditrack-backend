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

// The image picker previews chosen files via URL.createObjectURL. jsdom has no
// implementation and vitest's bundled one crashes on jsdom File objects, so always
// replace it with a deterministic stub.
globalThis.URL.createObjectURL = () => 'blob:mediatrack-preview'

// jsdom does not implement `matchMedia` (used by the theme's `system` mode). Provide a
// no-op stub that reports the light scheme; theme tests stub `window.matchMedia`
// themselves to control the effective preference.
if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string) => {
        const listeners = new Set<() => void>()

        return {
            media: query,
            get matches() {
                return false
            },
            onchange: null,
            addEventListener: (type: string, listener: () => void) => {
                if (type === 'change') {
                    listeners.add(listener)
                }
            },
            removeEventListener: (type: string, listener: () => void) => {
                if (type === 'change') {
                    listeners.delete(listener)
                }
            },
            addListener: (listener: () => void) => listeners.add(listener),
            removeListener: (listener: () => void) => listeners.delete(listener),
            dispatchEvent: () => false,
        } as unknown as MediaQueryList
    }
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
