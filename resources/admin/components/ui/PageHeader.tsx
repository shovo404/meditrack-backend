import type { ReactNode } from 'react'

export function PageHeader({
    title,
    description,
    actions,
}: {
    title: string
    description?: string
    actions?: ReactNode
}) {
    return (
        <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
                <h1 className="text-xl font-semibold text-ink sm:text-2xl">{title}</h1>
                {description ? <p className="max-w-2xl text-sm text-muted">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </header>
    )
}
