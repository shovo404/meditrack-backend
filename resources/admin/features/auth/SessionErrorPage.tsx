import { ServerCrash } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useAdminAuth } from '@/features/auth/authContext'

/**
 * Shown when the session could not be verified at all (network failure or 5xx) — which
 * is deliberately different from "not signed in".
 */
export function SessionErrorPage() {
    const { error, refresh, logout } = useAdminAuth()
    const [isSigningOut, setIsSigningOut] = useState(false)

    const handleSignOut = async () => {
        setIsSigningOut(true)

        try {
            await logout()
        } finally {
            setIsSigningOut(false)
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
            <div className="w-full max-w-lg rounded-card border border-line bg-surface p-8 shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                        <ServerCrash aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <h1 className="text-lg font-semibold text-ink">We could not verify your session</h1>
                </div>

                <p className="mt-4 text-sm text-muted">
                    {error?.message ?? 'The admin session could not be verified. Please try again.'}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                    <Button onClick={refresh}>Try again</Button>
                    <Button variant="secondary" onClick={handleSignOut} isLoading={isSigningOut}>
                        Sign out
                    </Button>
                </div>
            </div>
        </main>
    )
}
