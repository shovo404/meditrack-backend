import { useEffect, useState } from 'react'

/**
 * Returns `value` only after it has been stable for `delay` ms. Used to debounce the
 * catalog search box (~350ms) so we never hit the API on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value)

    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delay)

        return () => window.clearTimeout(timer)
    }, [value, delay])

    return debounced
}