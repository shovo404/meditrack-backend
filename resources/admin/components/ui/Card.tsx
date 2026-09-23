import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <div className={cn('rounded-card border border-line bg-surface shadow-sm', className)}>{children}</div>
    )
}

export function CardHeader({
    title,
    description,
    actions,
    className,
}: {
    title: ReactNode
    description?: ReactNode
    actions?: ReactNode
    className?: string
}) {
    return (
        <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4', className)}>
            <div className="space-y-1">
                <h2 className="text-base font-semibold text-ink">{title}</h2>
                {description ? <p className="text-sm text-muted">{description}</p> : null}
            </div>
            {actions}
        </div>
    )
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
    return <div className={cn('px-5 py-5', className)}>{children}</div>
}
