import type { ComponentPropsWithoutRef } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md'

const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60'

const variants: Record<Variant, string> = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
    secondary: 'border border-line bg-surface text-ink hover:bg-surface-muted',
    ghost: 'text-muted hover:bg-surface-muted hover:text-ink',
}

const sizes: Record<Size, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
}

export interface ButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'className'> {
    variant?: Variant
    size?: Size
    /** Shows a spinner and blocks further interaction. */
    isLoading?: boolean
    fullWidth?: boolean
    className?: string
}

export function Button({
    variant = 'primary',
    size = 'md',
    isLoading = false,
    fullWidth = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
}: ButtonProps) {
    return (
        <button
            type={type}
            disabled={disabled || isLoading}
            aria-busy={isLoading || undefined}
            className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
            {...rest}
        >
            {isLoading ? <Spinner size="sm" /> : null}
            {children}
        </button>
    )
}
