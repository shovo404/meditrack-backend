import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * Storage key for the theme *preference only* — never auth/session data. Kept in sync
 * with the no-JS-flash bootstrap inline script in `resources/views/admin/app.blade.php`.
 */
export const THEME_STORAGE_KEY = 'meditrack-admin-theme'

function darkMediaQuery(): MediaQueryList {
    return window.matchMedia('(prefers-color-scheme: dark)')
}

/** The OS-aware resolution of a mode into an actual dark/light decision. */
function resolveDark(mode: ThemeMode): boolean {
    if (mode === 'dark') return true
    if (mode === 'light') return false

    return darkMediaQuery().matches
}

function readStoredTheme(): ThemeMode {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)

    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

export interface ThemeContextValue {
    theme: ThemeMode
    setTheme: (mode: ThemeMode) => void
    /** Whether the UI is dark right now (the resolved value for the `system` mode). */
    isDark: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Class-based dark mode: toggles the `dark` class on `<html>`, which flips the semantic
 * CSS tokens in `styles/admin.css`. The preference persists to localStorage (`system`
 * default). While `system` is active a `matchMedia` listener follows OS changes — no
 * polling, and only updates the class when it actually flips.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme)
    const [isDark, setIsDark] = useState<boolean>(() => resolveDark(readStoredTheme()))

    useEffect(() => {
        const dark = resolveDark(theme)
        document.documentElement.classList.toggle('dark', dark)
        setIsDark(dark)
    }, [theme])

    useEffect(() => {
        if (theme !== 'system') {
            return
        }

        const media = darkMediaQuery()
        const handleChange = () => {
            const dark = media.matches
            document.documentElement.classList.toggle('dark', dark)
            setIsDark(dark)
        }

        media.addEventListener('change', handleChange)

        return () => media.removeEventListener('change', handleChange)
    }, [theme])

    const setTheme = useCallback((mode: ThemeMode) => {
        localStorage.setItem(THEME_STORAGE_KEY, mode)
        setThemeState(mode)
    }, [])

    const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme, isDark }), [theme, setTheme, isDark])

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext)

    if (!context) {
        throw new Error('useTheme() must be used inside a <ThemeProvider>.')
    }

    return context
}