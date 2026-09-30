import { ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useAdminAuth } from '@/features/auth/authContext'

/**
 * Shown when the session is valid but the account is not an administrator (403).
 * Renders outside the admin shell on purpose: no admin navigation is exposed.
 */
export function AccessDeniedPage() {
    const { logout, admin } = useAdminAuth()
    const navigate = useNavigate()
    const [isSigningOut, setIsSigningOut] = useState(false)

    const handleSignOut = async () => {
        setIsSigningOut(true)

        try {
            await logout()
            navigate('/admin/login', { replace: true })
        } finally {
            setIsSigningOut(false)
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
            <div className="w-full max-w-lg rounded-card border border-line bg-surface p-8 shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                        <ShieldAlert aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <h1 className="text-lg font-semibold text-ink">Administrator access required</h1>
                </div>

                <p className="mt-4 text-sm text-muted">
                    You are signed in, but this account does not have administrator access to the MediTrack admin
                    panel. The server rejected the request, so no catalog data is shown.
                </p>

                {admin ? (
                    <p className="mt-3 rounded-lg border border-line bg-surface-muted px-3 py-2 text-xs text-muted">
                        Signed in as <span className="font-medium text-ink">{admin.email}</span>
                    </p>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                    <Button onClick={handleSignOut} isLoading={isSigningOut}>
                        Sign in with another account
                    </Button>
                    <Button variant="secondary" onClick={() => navigate('/admin/login', { replace: true })}>
                        Back to sign in
                    </Button>
                </div>
            </div>
        </main>
    )
}
