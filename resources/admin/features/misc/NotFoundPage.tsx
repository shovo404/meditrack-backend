import { Link } from 'react-router-dom'

export function NotFoundPage() {
    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <p className="text-sm font-semibold text-brand-700">404</p>
            <h1 className="text-lg font-semibold text-ink">Page not found</h1>
            <p className="max-w-md text-sm text-muted">
                The page you are looking for does not exist in the MediTrack admin panel.
            </p>
            <Link
                to="/admin"
                className="mt-2 text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
            >
                Back to the dashboard
            </Link>
        </div>
    )
}
