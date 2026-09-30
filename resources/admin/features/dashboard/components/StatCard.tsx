import type { ComponentType } from 'react'
import { Card, CardBody } from '@/components/ui/Card'
import { cn } from '@/lib/utils/cn'

export interface StatCardProps {
    /** Human-readable name, also used as the accessible group label. */
    label: string
    value: number
    /** Placed under the number so the card means more than a coloured box. */
    hint: string
    icon: ComponentType<{ 'aria-hidden'?: boolean; className?: string }>
}

/**
 * A single catalogue statistic. The icon, label and hint all carry meaning, so the card
 * never relies on colour alone (the icon square tints identically in both themes).
 */
export function StatCard({ label, value, hint, icon: Icon }: StatCardProps) {
    return (
        <Card>
            <CardBody className="space-y-4">
                <div className="flex items-center gap-3">
                    <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300"
                    >
                        <Icon className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-medium text-muted">{label}</p>
                </div>

                <div role="group" aria-label={label} className={cn('space-y-1')}>
                    <p className="text-3xl font-semibold tracking-tight text-ink">{value.toLocaleString()}</p>
                    <p className="text-sm text-muted">{hint}</p>
                </div>
            </CardBody>
        </Card>
    )
}