import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { useId } from 'react'

export function Label({ className, children, ...rest }: ComponentPropsWithoutRef<'label'>) {
    return (
        <label className={cn('block text-sm font-medium text-ink', className)} {...rest}>
            {children}
        </label>
    )
}

export interface FieldProps {
    label: string
    /** Node rendered as the field control; receives `id`, `aria-describedby` and `aria-invalid`. */
    children: (props: { id: string; describedBy?: string; hasError: boolean }) => ReactNode
    error?: string
    hint?: string
    className?: string
}

/**
 * Accessible field wrapper: ties the label, hint and error message to the control
 * through generated ids and surfaces the error to screen readers.
 */
export function Field({ label, children, error, hint, className }: FieldProps) {
    const id = useId()
    const hintId = hint ? `${id}-hint` : undefined
    const errorId = error ? `${id}-error` : undefined
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

    return (
        <div className={cn('space-y-1.5', className)}>
            <Label htmlFor={id}>{label}</Label>

            {children({ id, describedBy, hasError: Boolean(error) })}

            {hint && !error ? (
                <p id={hintId} className="text-xs text-muted">
                    {hint}
                </p>
            ) : null}

            {error ? (
                <p id={errorId} role="alert" className="text-xs font-medium text-red-600">
                    {error}
                </p>
            ) : null}
        </div>
    )
}
