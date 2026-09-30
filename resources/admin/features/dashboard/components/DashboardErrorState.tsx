import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { adminSessionQueryKey } from '@/features/auth/authContext'
import type { ApiError } from '@/lib/api/client'

export interface DashboardErrorStateProps {
    error: ApiError
    onRetry: () => void
}

function messageFor(error: ApiError): { title: string; detail: string } {
    if (error.isForbidden) {
        return {
            title: 'Administrator access required',
            detail: 'Your session does not have permission to view dashboard statistics.',
        }
    }

    if (error.isRateLimited) {
        const seconds = error.retryAfter

        return {
            title: 'Too many requests',
            detail:
                seconds !== undefined
                    ? `Please wait about ${seconds} second${seconds === 1 ? '' : 's'} before trying again.`
                    : 'Please wait a moment before trying again.',
        }
    }

    if (error.isServerError) {
        return {
            title: 'Something went wrong on the server',
            detail: 'Something went wrong on the server. Please try again.',
        }
    }

    if (error.isNetworkError) {
        return {
            title: 'No connection',
            detail: 'Unable to connect to the server. Please check your connection and try again.',
        }
    }

    return {
        title: 'Could not load the dashboard',
        detail: error.message,
    }
}

/**
 * Dashboard fetch error panel. A 401 means the cached session is already dead, so it
 * drops the session (RequireAdmin bounces to login); every other failure stays put with
 * a scoped message and a Retry button.
 */
export function DashboardErrorState({ error, onRetry }: DashboardErrorStateProps) {
    const queryClient = useQueryClient()

    useEffect(() => {
        if (error.isUnauthenticated) {
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