import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { adminSessionQueryKey } from '@/features/auth/authContext'
import type { ApiError } from '@/lib/api/client'

export interface CatalogErrorStateProps {
    error: ApiError
    onRetry: () => void
}

function messageFor(error: ApiError): { title: string; detail: string } {
    if (error.isForbidden) {
        return {
            title: 'Administrator access required',
            detail: 'Your session does not have permission to manage the medicine catalog.',
        }
    }

    if (error.isRateLimited) {
        const seconds = error.retryAfter

        return {
            title: 'Too many requests',
            detail: seconds !== undefined
                ? `Please wait about ${seconds} second${seconds === 1 ? '' : 's'} before trying again.`
                : 'Please wait a moment before trying again.',
        }
    }

    if (error.isServerError) {
        return {
            title: 'Something went wrong on the server',
            detail: 'The catalog could not be loaded right now. Please try again shortly.',
        }
    }

    if (error.isNetworkError) {
        return {
            title: 'No connection',
            detail: 'Could not reach the server. Check your connection and try again.',
        }
    }

    return {
        title: 'Could not load the catalog',
        detail: error.message,
    }
}

/**
 * Catalog fetch error panel. 401 bounces back to the admin login (session expired); the
 * remaining types stay put with a scoped message and a Retry button.
 */
export function CatalogErrorState({ error, onRetry }: CatalogErrorStateProps) {
    const queryClient = useQueryClient()

    useEffect(() => {
        if (error.isUnauthenticated) {
            // The backend rejected this data request with 401, which means the session
            // cookie the client still holds is already dead. Drop the cached session so
            // `RequireAdmin` notices and bounces to the login route (and the login page
            // does not bounce us straight back here).
            queryClient.setQueryData(adminSessionQueryKey, null)
        }
    }, [error, queryClient])

    if (error.isUnauthenticated) {
        return null
    }

    const { title, detail } = messageFor(error)

    return (
        <Alert tone="error" title={title}>
            <div className="space-y-3" aria-live="polite">
                <p>{detail}</p>
                <Button variant="secondary" size="sm" onClick={onRetry}>
                    Try again
                </Button>
            </div>
        </Alert>
    )
}