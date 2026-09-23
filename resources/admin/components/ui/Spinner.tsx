import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const sizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-7 w-7',
} as const

export interface SpinnerProps {
    size?: keyof typeof sizes
    className?: string
    /** Announced to assistive technology when the spinner is the only loading cue. */
    label?: string
}

export function Spinner({ size = 'md', className, label }: SpinnerProps) {
    return (
        <span role="status" aria-live="polite" className="inline-flex items-center gap-2">
            <LoaderCircle aria-hidden="true" className={cn('animate-spin', sizes[size], className)} />
            {label ? <span className="sr-only">{label}</span> : null}
        </span>
    )
}

export interface PageLoaderProps {
    label?: string
}

/** Centred, full-height loading state used while the admin session is resolved. */
export function PageLoader({ label = 'Loading…' }: PageLoaderProps) {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 py-16">
            <Spinner size="lg" className="text-brand-600" />
            <p className="text-sm text-muted">{label}</p>
        </div>
    )
}
