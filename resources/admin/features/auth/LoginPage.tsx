import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Pill, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm, type UseFormSetError } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { useAdminAuth } from '@/features/auth/authContext'
import { loginSchema, type LoginFormValues } from '@/features/auth/loginSchema'
import { ApiError } from '@/lib/api/client'
import type { ValidationErrors } from '@/lib/api/types'

interface FormError {
    title: string
    message: string
}

/** Only ever redirect back into the admin area (no open-redirect via location.state). */
function safeRedirect(from: string | undefined): string {
    if (from && from.startsWith('/admin') && !from.startsWith('/admin/login')) {
        return from
    }

    return '/admin'
}

/** Turns any failure into a human-readable, specific message. */
function describeLoginError(error: unknown): FormError {
    if (error instanceof ApiError) {
        if (error.isRateLimited) {
            return {
                title: 'Too many attempts',
                message: error.retryAfter
                    ? `Too many sign-in attempts. Please try again in ${error.retryAfter} seconds.`
                    : 'Too many sign-in attempts. Please wait a moment and try again.',
            }
        }

        if (error.isForbidden) {
            return { title: 'Administrator access required', message: error.message }
        }

        if (error.isNetworkError) {
            return { title: 'Cannot reach the server', message: error.message }
        }

        if (error.isServerError) {
            return { title: 'Server error', message: error.message }
        }

        return { title: 'Sign-in failed', message: error.message }
    }

    return { title: 'Sign-in failed', message: 'Something went wrong. Please try again.' }
}

function applyServerErrors(errors: ValidationErrors, setError: UseFormSetError<LoginFormValues>): boolean {
    let applied = false

    for (const [field, messages] of Object.entries(errors)) {
        if ((field === 'email' || field === 'password') && messages.length > 0) {
            setError(field, { type: 'server', message: messages[0] })
            applied = true
        }
    }

    return applied
}

export function LoginPage() {
    const { status, login, isSubmitting } = useAdminAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [showPassword, setShowPassword] = useState(false)
    const [formError, setFormError] = useState<FormError | null>(null)

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting: isFormSubmitting },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' },
    })

    const from = (location.state as { from?: string } | null)?.from
    const isPending = isSubmitting || isFormSubmitting

    // Already signed in as an admin: no reason to show the form again.
    if (status === 'authenticated') {
        return <Navigate to={safeRedirect(from)} replace />
    }

    const onSubmit = handleSubmit(async (values) => {
        setFormError(null)

        try {
            await login(values)
            navigate(safeRedirect(from), { replace: true })
        } catch (error) {
            if (error instanceof ApiError && error.isValidationError && error.errors) {
                if (applyServerErrors(error.errors, setError)) {
                    return
                }
            }

            setFormError(describeLoginError(error))
        }
    })

    return (
        <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1fr_1.1fr]">
            <aside className="hidden bg-navy-900 px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                        <Pill aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <div>
                        <p className="text-base font-semibold">MediTrack</p>
                        <p className="text-xs text-brand-200">Admin Panel</p>
                    </div>
                </div>

                <div className="max-w-sm space-y-5">
                    <h2 className="text-2xl font-semibold leading-snug">
                        Manage the global medicine catalog with confidence.
                    </h2>
                    <p className="text-sm text-brand-100">
                        The admin panel is restricted to MediTrack administrators. Every request is authorised by the
                        MediTrack backend before any catalog data is touched.
                    </p>
                    <ul className="space-y-3 text-sm text-brand-100">
                        <li className="flex items-start gap-2">
                            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                            <span>Administrator-only access, enforced server-side.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                            <span>Session cookies and CSRF protection — no tokens in the browser.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                            <span>The global catalog your Android users sync from.</span>
                        </li>
                    </ul>
                </div>

                <p className="text-xs text-brand-200">
                    MediTrack Backend · Global medicine catalog administration
                </p>
            </aside>

            <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:min-h-0 lg:px-12">
                <div className="w-full max-w-md">
                    <div className="mb-8 flex items-center gap-3 lg:hidden">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-white">
                            <Pill aria-hidden="true" className="h-5 w-5" />
                        </span>
                        <div>
                            <p className="text-base font-semibold text-ink">MediTrack</p>
                            <p className="text-xs text-muted">Admin Panel</p>
                        </div>
                    </div>

                    <div className="rounded-card border border-line bg-surface p-6 shadow-sm sm:p-8">
                        <h1 className="text-xl font-semibold text-ink">Sign in to the admin panel</h1>
                        <p className="mt-1 text-sm text-muted">
                            Use your MediTrack administrator account to continue.
                        </p>

                        {formError ? (
                            <Alert tone="error" title={formError.title} className="mt-6">
                                {formError.message}
                            </Alert>
                        ) : null}

                        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
                            <Field label="Email address" error={errors.email?.message}>
                                {({ id, describedBy, hasError }) => (
                                    <Input
                                        id={id}
                                        type="email"
                                        autoComplete="username"
                                        inputMode="email"
                                        spellCheck={false}
                                        autoFocus
                                        placeholder="you@example.com"
                                        hasError={hasError}
                                        aria-describedby={describedBy}
                                        {...register('email')}
                                    />
                                )}
                            </Field>

                            <Field label="Password" error={errors.password?.message}>
                                {({ id, describedBy, hasError }) => (
                                    <div className="relative">
                                        <Input
                                            id={id}
                                            type={showPassword ? 'text' : 'password'}
                                            autoComplete="current-password"
                                            placeholder="••••••••"
                                            hasError={hasError}
                                            aria-describedby={describedBy}
                                            className="pr-11"
                                            {...register('password')}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((visible) => !visible)}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            aria-pressed={showPassword}
                                            aria-controls={id}
                                            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted transition-colors hover:text-ink"
                                        >
                                            {showPassword ? (
                                                <EyeOff aria-hidden="true" className="h-4 w-4" />
                                            ) : (
                                                <Eye aria-hidden="true" className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                )}
                            </Field>

                            <Button type="submit" fullWidth isLoading={isPending} disabled={isPending}>
                                {isPending ? 'Signing in…' : 'Sign in'}
                            </Button>
                        </form>
                    </div>

                    <p className="mt-6 text-center text-xs text-muted">
                        Administrator accounts are provisioned by the MediTrack backend team. There is no self-service
                        sign-up for the admin panel.
                    </p>
                </div>
            </main>
        </div>
    )
}
