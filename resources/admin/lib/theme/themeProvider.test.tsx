import { describe, expect, it, beforeEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, THEME_STORAGE_KEY, useTheme } from '@/lib/theme/themeProvider'

function Harness() {
    const { theme, setTheme, isDark } = useTheme()

    return (
        <div>
            <output data-testid="theme">{theme}</output>
            <output data-testid="is-dark">{String(isDark)}</output>
            <button onClick={() => setTheme('dark')}>theme:dark</button>
            <button onClick={() => setTheme('light')}>theme:light</button>
            <button onClick={() => setTheme('system')}>theme:system</button>
        </div>
    )
}

function renderThemeApp() {
    return render(
        <ThemeProvider>
            <Harness />
        </ThemeProvider>
    )
}

interface MatchMediaController {
    prefersDark: boolean
    setPrefersDark: (dark: boolean) => void
}

/** A controllable matchMedia stub so tests can flip the simulated OS preference. */
function stubMatchMedia(controller: MatchMediaController) {
    const listeners = new Set<(event: Event) => void>()

    const mql = {
        get matches() {
            return controller.prefersDark
        },
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: (_type: string, listener: (event: Event) => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: (event: Event) => void) => listeners.delete(listener),
        dispatchEvent: () => false,
        addListener: (listener: (event: Event) => void) => listeners.add(listener),
        removeListener: (listener: (event: Event) => void) => listeners.delete(listener),
    }

    vi.stubGlobal('matchMedia', () => mql)

    controller.setPrefersDark = (dark: boolean) => {
        controller.prefersDark = dark

        act(() => {
            for (const listener of listeners) {
                listener({ matches: dark } as unknown as Event)
            }
        })
    }

    return mql
}

describe('ThemeProvider', () => {
    beforeEach(() => {
        localStorage.clear()
        document.documentElement.classList.remove('dark')
    })

    it('defaults to the system preference and resolves light when the OS prefers light', () => {
        stubMatchMedia({ prefersDark: false } as MatchMediaController)

        renderThemeApp()

        expect(screen.getByTestId('theme')).toHaveTextContent('system')
        expect(screen.getByTestId('is-dark')).toHaveTextContent('false')
        expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('applies dark mode when the OS prefers dark and the user is on system', () => {
        stubMatchMedia({ prefersDark: true } as MatchMediaController)

        renderThemeApp()

        expect(screen.getByTestId('is-dark')).toHaveTextContent('true')
        expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('follows OS preference changes while in system mode', () => {
        const controller = { prefersDark: false } as MatchMediaController
        stubMatchMedia(controller)

        renderThemeApp()

        expect(document.documentElement.classList.contains('dark')).toBe(false)

        controller.setPrefersDark(true)

        expect(screen.getByTestId('is-dark')).toHaveTextContent('true')
        expect(document.documentElement.classList.contains('dark')).toBe(true)

        controller.setPrefersDark(false)

        expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('toggles to dark and persists the preference to localStorage', async () => {
        const user = userEvent.setup()
        stubMatchMedia({ prefersDark: false } as MatchMediaController)

        renderThemeApp()

        await user.click(screen.getByRole('button', { name: 'theme:dark' }))

        expect(screen.getByTestId('theme')).toHaveTextContent('dark')
        expect(document.documentElement.classList.contains('dark')).toBe(true)
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    })

    it('restores a stored dark preference on mount', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'dark')
        stubMatchMedia({ prefersDark: false } as MatchMediaController)

        renderThemeApp()

        expect(screen.getByTestId('theme')).toHaveTextContent('dark')
        expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('restores a stored light preference even when the OS prefers dark', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'light')
        stubMatchMedia({ prefersDark: true } as MatchMediaController)

        renderThemeApp()

        expect(screen.getByTestId('theme')).toHaveTextContent('light')
        expect(screen.getByTestId('is-dark')).toHaveTextContent('false')
        expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('ignores an unknown stored value and falls back to system', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'sepia')
        stubMatchMedia({ prefersDark: false } as MatchMediaController)

        renderThemeApp()

        expect(screen.getByTestId('theme')).toHaveTextContent('system')
    })
})