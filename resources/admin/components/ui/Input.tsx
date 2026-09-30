import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils/cn'

export interface InputProps extends Omit<ComponentPropsWithoutRef<'input'>, 'className'> {
    hasError?: boolean
    className?: string
}

export function Input({ hasError = false, className, ...rest }: InputProps) {
    return (
        <input
            aria-invalid={hasError || undefined}
            className={cn(
                'block w-full rounded-lg border bg-surface px-3 py-2.5 text-sm text-ink shadow-xs transition-colors',
                'placeholder:text-muted disabled:cursor-not-allowed disabled:bg-surface-muted',
                hasError ? 'border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-400' : 'border-line focus:border-brand-500',
                className
            )}
            {...rest}
        />
    )
}
