import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useForm, type UseFormSetError } from 'react-hook-form'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Label } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ui/Spinner'
import { adminSessionQueryKey } from '@/features/auth/authContext'
import { ApiError } from '@/lib/api/client'
import type { ValidationErrors } from '@/lib/api/types'
import {
    catalogMedicineFormSchema,
    catalogMedicineToFormValues,
    emptyCatalogMedicineForm,
    type CatalogMedicineFormValues,
} from './catalogSchema'
import { CatalogErrorState } from './components/CatalogErrorState'
import { CatalogImagePicker } from './components/CatalogImagePicker'
import { RemoveCatalogImageDialog } from './components/RemoveCatalogImageDialog'
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog'
import { useCatalogMedicine } from './hooks/useCatalogMedicine'
import {
    useCreateCatalogMedicineMutation,
    useRemoveCatalogMedicineImageMutation,
    useUpdateCatalogMedicineMutation,
} from './hooks/useCatalogMutations'

interface FormError {
    title: string
    message: string
}

/** Maps Laravel validation field names onto the react-hook-form fields. */
const FIELD_MAP: Record<string, keyof CatalogMedicineFormValues> = {
    name: 'name',
    generic_name: 'genericName',
    strength: 'strength',
    dosage_form: 'dosageForm',
    manufacturer: 'manufacturer',
    is_active: 'isActive',
}

/**
 * Applies backend 422 field errors to the matching form fields (and the image control),
 * mirroring the LoginPage server-error pattern.
 */
function applyServerFieldErrors(
    errors: ValidationErrors,
    setError: UseFormSetError<CatalogMedicineFormValues>,
    setImageError: (message: string | undefined) => void
): boolean {
    let applied = false

    for (const [field, messages] of Object.entries(errors)) {
        if (!messages.length) {
            continue
        }

        const message = messages[0]

        if (field === 'image') {
            setImageError(message)
            applied = true
            continue
        }

        const target = FIELD_MAP[field]

        if (target) {
            setError(target, { type: 'server', message })
            applied = true
        }
    }

    return applied
}

function describeSubmitError(error: unknown): FormError {
    if (error instanceof ApiError) {
        if (error.isNetworkError) {
            return {
                title: 'No connection',
                message: 'Unable to connect to the server. Please check your connection and try again.',
            }
        }

        if (error.isForbidden) {
            return {
                title: 'Administrator access required',
                message: 'Your session does not have permission to manage the medicine catalog.',
            }
        }

        if (error.isRateLimited) {
            return {
                title: 'Too many requests',
                message:
                    error.retryAfter !== undefined
                        ? `Please wait about ${error.retryAfter} second${error.retryAfter === 1 ? '' : 's'} before trying again.`
                        : 'Please wait a moment before trying again.',
            }
        }

        if (error.isServerError) {
            return {
                title: 'Something went wrong on the server',
                message: 'The medicine could not be saved right now. Please try again shortly.',
            }
        }

        return { title: 'Could not save the medicine', message: error.message }
    }

    return { title: 'Could not save the medicine', message: 'The request could not be completed. Please try again.' }
}

/**
 * Phase 2D — Add / Edit / Image management for the global medicine catalog.
 *
 * `/admin/catalog/new` renders the create form; `/admin/catalog/:medicineId/edit` loads
 * the existing medicine and prefills the form (text edits + image replacement flow
 * through the same PUT payload; image removal uses the dedicated `/image` endpoint).
 */
export function CatalogMedicineFormPage() {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const { medicineId: rawId } = useParams()

    const parsedId = Number(rawId)
    const medicineId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : undefined
    const isEdit = medicineId !== undefined

    const detail = useCatalogMedicine(medicineId)
    const createMutation = useCreateCatalogMedicineMutation()
    const updateMutation = useUpdateCatalogMedicineMutation()
    const removeImageMutation = useRemoveCatalogMedicineImageMutation()

    const [selectedImage, setSelectedImage] = useState<File | null>(null)
    const [imageError, setImageError] = useState<string | undefined>(undefined)
    const [formError, setFormError] = useState<FormError | null>(null)
    const [removeDialogOpen, setRemoveDialogOpen] = useState(false)

    const {
        register,
        handleSubmit,
        reset,
        setError,
        watch,
        formState: { errors, isDirty },
    } = useForm<CatalogMedicineFormValues>({
        resolver: zodResolver(catalogMedicineFormSchema),
        defaultValues: emptyCatalogMedicineForm(),
    })

    const isActive = watch('isActive')
    const nameValue = watch('name')

    // Prefill the edit form exactly once per medicine id. Later refetches (e.g. after an
    // image removal) update the cached medicine without clobbering the user's own edits.
    const loadedForId = useRef<number | null>(null)

    useEffect(() => {
        const medicine = detail.data

        if (medicine && loadedForId.current !== medicine.id) {
            loadedForId.current = medicine.id
            reset(catalogMedicineToFormValues(medicine))
            setSelectedImage(null)
            setImageError(undefined)
            setFormError(null)
        }
    }, [detail.data, reset])

    // Arm/darm the blocker: a fresh save must not be interrupted by the same navigate()
    // that lands on the catalog afterwards.
    const savedRef = useRef(false)

    useEffect(() => {
        if (isDirty) {
            savedRef.current = false
        }
    }, [isDirty])

    const blocker = useBlocker(({ currentLocation, nextLocation }) => {
        if (savedRef.current) {
            return false
        }

        return isDirty && nextLocation.pathname !== currentLocation.pathname
    })

    const isSavePending = createMutation.isPending || updateMutation.isPending

    const backToCatalog = () => navigate('/admin/catalog')

    const onSubmit = handleSubmit(async (values) => {
        setFormError(null)
        setImageError(undefined)

        try {
            const draft = {
                name: values.name,
                genericName: values.genericName,
                strength: values.strength,
                dosageForm: values.dosageForm,
                manufacturer: values.manufacturer,
                isActive: values.isActive,
            }

            if (isEdit && medicineId !== undefined) {
                const updated = await updateMutation.mutateAsync({ id: medicineId, draft, image: selectedImage })
                savedRef.current = true
                reset(catalogMedicineToFormValues(updated))
            } else {
                const created = await createMutation.mutateAsync({ draft, image: selectedImage })
                savedRef.current = true
                reset(catalogMedicineToFormValues(created))
            }

            navigate('/admin/catalog')
        } catch (error) {
            if (error instanceof ApiError && error.isUnauthenticated) {
                queryClient.setQueryData(adminSessionQueryKey, null)

                return
            }

            if (error instanceof ApiError && error.isValidationError && error.errors) {
                if (applyServerFieldErrors(error.errors, setError, setImageError)) {
                    return
                }
            }

            setFormError(describeSubmitError(error))
        }
    })

    const handleRemoveImageConfirm = async () => {
        if (!isEdit || medicineId === undefined) {
            return
        }

        try {
            await removeImageMutation.mutateAsync(medicineId)
            setRemoveDialogOpen(false)
            setImageError(undefined)
        } catch (error) {
            setRemoveDialogOpen(false)

            if (error instanceof ApiError && error.isUnauthenticated) {
                queryClient.setQueryData(adminSessionQueryKey, null)

                return
            }

            setFormError(describeSubmitError(error))
        }
    }

    if (isEdit) {
        if (detail.isPending) {
            return (
                <div className="space-y-6">
                    <PageHeader title="Edit Medicine" description="Update a medicine in the global catalog." />
                    <PageLoader label="Loading medicine…" />
                </div>
            )
        }

        if (detail.error) {
            return (
                <div className="space-y-6">
                    <PageHeader title="Edit Medicine" description="Update a medicine in the global catalog." />
                    <CatalogErrorState error={detail.error as ApiError} onRetry={() => void detail.refetch()} />
                </div>
            )
        }
    }

    const currentImageUrl = isEdit ? (detail.data?.imageUrl ?? null) : null
    const medicineName = nameValue.trim() === '' ? null : nameValue

    return (
        <div className="space-y-6">
            <PageHeader
                title={isEdit ? 'Edit Medicine' : 'Add Medicine'}
                description={
                    isEdit
                        ? 'Update the details of this medicine in the global catalog. Changes apply to the catalog itself — never to existing user records, schedules or logs.'
                        : 'Add a medicine to the global catalog that MediTrack clients synchronise from.'
                }
                actions={
                    <Button variant="ghost" onClick={backToCatalog}>
                        Back to catalog
                    </Button>
                }
            />

            <div className="max-w-2xl space-y-4">
                {formError ? (
                    <Alert tone="error" title={formError.title}>
                        {formError.message}
                    </Alert>
                ) : null}

                <Card>
                    <form onSubmit={onSubmit} noValidate className="space-y-5 p-6">
                        <Field label="Medicine Name *" error={errors.name?.message}>
                            {({ id, describedBy, hasError }) => (
                                <Input
                                    id={id}
                                    placeholder="e.g. Paracetamol"
                                    hasError={hasError}
                                    aria-describedby={describedBy}
                                    {...register('name')}
                                />
                            )}
                        </Field>

                        <Field label="Generic name" hint="The active ingredient, e.g. Acetaminophen." error={errors.genericName?.message}>
                            {({ id, describedBy, hasError }) => (
                                <Input
                                    id={id}
                                    placeholder="e.g. Acetaminophen"
                                    hasError={hasError}
                                    aria-describedby={describedBy}
                                    {...register('genericName')}
                                />
                            )}
                        </Field>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <Field label="Strength" error={errors.strength?.message}>
                                {({ id, describedBy, hasError }) => (
                                    <Input
                                        id={id}
                                        placeholder="e.g. 500 mg"
                                        hasError={hasError}
                                        aria-describedby={describedBy}
                                        {...register('strength')}
                                    />
                                )}
                            </Field>

                            <Field label="Dosage form" error={errors.dosageForm?.message}>
                                {({ id, describedBy, hasError }) => (
                                    <Input
                                        id={id}
                                        placeholder="e.g. Tablet"
                                        hasError={hasError}
                                        aria-describedby={describedBy}
                                        {...register('dosageForm')}
                                    />
                                )}
                            </Field>
                        </div>

                        <Field label="Manufacturer" error={errors.manufacturer?.message}>
                            {({ id, describedBy, hasError }) => (
                                <Input
                                    id={id}
                                    placeholder="e.g. Sun Pharma"
                                    hasError={hasError}
                                    aria-describedby={describedBy}
                                    {...register('manufacturer')}
                                />
                            )}
                        </Field>

                        <div className="space-y-1.5">
                            <Label>Medicine image</Label>
                            <CatalogImagePicker
                                medicineName={medicineName}
                                currentImageUrl={currentImageUrl}
                                value={selectedImage}
                                onChange={setSelectedImage}
                                onErrorChange={setImageError}
                                onRemoveCurrent={() => setRemoveDialogOpen(true)}
                                error={imageError}
                                disabled={isSavePending}
                            />
                        </div>

                        <Field
                            label="Status"
                            hint="An inactive medicine never appears in active catalog selections for users."
                            error={errors.isActive?.message}
                        >
                            {({ id, describedBy, hasError }) => (
                                <label className="flex items-center gap-2.5">
                                    <input
                                        id={id}
                                        type="checkbox"
                                        aria-describedby={describedBy}
                                        aria-invalid={hasError || undefined}
                                        className="h-4 w-4 rounded border-line accent-brand-600"
                                        {...register('isActive')}
                                    />
                                    <span className="text-sm font-medium text-ink">
                                        {isActive ? 'Active in the catalog' : 'Inactive in the catalog'}
                                    </span>
                                </label>
                            )}
                        </Field>

                        <div className="flex justify-end gap-2 border-t border-line pt-5">
                            <Button variant="secondary" onClick={backToCatalog} disabled={isSavePending}>
                                Cancel
                            </Button>
                            <Button type="submit" isLoading={isSavePending} disabled={isSavePending}>
                                {isEdit ? 'Save medicine' : 'Create medicine'}
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>

            <RemoveCatalogImageDialog
                open={removeDialogOpen}
                medicineName={medicineName}
                onClose={() => setRemoveDialogOpen(false)}
                onConfirm={() => void handleRemoveImageConfirm()}
                isSubmitting={removeImageMutation.isPending}
            />

            <UnsavedChangesDialog
                open={blocker.state === 'blocked'}
                onStay={() => blocker.reset?.()}
                onLeave={() => blocker.proceed?.()}
            />
        </div>
    )
}