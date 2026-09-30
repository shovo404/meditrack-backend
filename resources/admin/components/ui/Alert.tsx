import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

type Tone = 'error' | 'success' | 'info'

const tones: Record<Tone, { wrapper: string; icon: string }> = {
    error: {
        wrapper: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-100',
        icon: 'text-red-600 dark:text-red-400',
    },
    success: {
        wrapper:
            'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-100',
        icon: 'text-emerald-600 dark:text-emerald-400',
    },
    info: {
        wrapper:
            'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900/70 dark:bg-brand-900/50 dark:text-brand-100',
        icon: 'text-brand-700 dark:text-brand-300',
    },
}

const icons = {
    error: AlertCircle,
    success: CheckCircle2,
    info: Info,
}

export interface AlertProps {
    tone?: Tone
    title?: string
    children?: ReactNode
    /** `alert` interrupts the screen reader for errors; `status` is polite. */
    role?: 'alert' | 'status'
    className?: string
}

export function Alert({ tone = 'info', title, children, role, className }: AlertProps) {
    const Icon = icons[tone]

    return (
        <div
            role={role ?? (tone === 'error' ? 'alert' : 'status')}
            className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', tones[tone].wrapper, className)}
        >
            <Icon aria-hidden="true" className={cn('mt-0.5 h-4 w-4 shrink-0', tones[tone].icon)} />
            <div className="space-y-1">
                {title ? <p className="font-semibold">{title}</p> : null}
                {children ? <div className="[&_a]:underline">{children}</div> : null}
            </div>
        </div>
    )
}
