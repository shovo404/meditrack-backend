import { ImagePlus, Pill, Trash2, Upload, X } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ACCEPT_ATTRIBUTE = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'

export interface CatalogImagePickerProps {
    /** Fallback base for `alt` text while the name field is still being typed. */
    medicineName: string | null
    /** Currently stored image (edit only). */
    currentImageUrl: string | null
    /** Newly chosen file awaiting save. */
    value: File | null
    onChange: (file: File | null) => void
    /** Surfaces client- and server-side validation messages near the control. */
    onErrorChange: (error: string | undefined) => void
    /** Open the "remove stored image" confirmation dialog (edit mode, no pending file). */
    onRemoveCurrent?: () => void
    error?: string
    disabled?: boolean
}

export function imageValidationMessage(file: File): string | null {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
        return 'Please choose a JPG, PNG or WEBP image.'
    }

    if (file.size > MAX_IMAGE_BYTES) {
        return 'Image must be 5 MB or smaller.'
    }

    return null
}

function formatFileSize(bytes: number): string {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * Image field for the Add/Edit medicine forms.
 *
 * - Real `<button>` browse trigger + a hidden file input (never a clickable div).
 * - Client-side type/size checks mirror the Laravel `image` rule; the backend re-validates.
 * - Edit mode shows the stored image with Replace/Remove; choosing a file previews it and
 *   labels it as replacing the stored image on save (never deletes anything by itself).
 */
export function CatalogImagePicker({
    medicineName,
    currentImageUrl,
    value,
    onChange,
    onErrorChange,
    onRemoveCurrent,
    error,
    disabled,
}: CatalogImagePickerProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [dragOver, setDragOver] = useState(false)

    const hasNewFile = value !== null
    const altBase = (medicineName ?? '').trim() === '' ? 'this medicine' : medicineName
    const displayUrl = hasNewFile && value ? URL.createObjectURL(value) : currentImageUrl

    const chooseFile = (next: File | undefined) => {
        if (!next) {
            return
        }

        const validationError = imageValidationMessage(next)

        if (validationError) {
            // Reject the invalid file: keep the previous selection and report the reason.
            onErrorChange(validationError)
            return
        }

        onErrorChange(undefined)
        onChange(next)
    }

    const clearSelection = () => {
        if (inputRef.current) {
            inputRef.current.value = ''
        }

        onErrorChange(undefined)
        onChange(null)
    }

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        setDragOver(false)

        if (disabled) {
            return
        }

        chooseFile(event.dataTransfer.files[0])
    }

    const handleBrowse = () => {
        if (disabled) {
            return
        }

        inputRef.current?.click()
    }

    const altText = hasNewFile ? `Preview of ${altBase} medicine` : `Current image of ${altBase}`

    return (
        <div className="space-y-2">
            <div
                onDragOver={(event) => {
                    event.preventDefault()
                    setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={cn(
                    'rounded-lg border border-dashed p-4 transition-colors',
                    dragOver ? 'border-brand-500 bg-brand-50' : 'border-line',
                    disabled && 'opacity-60'
                )}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPT_ATTRIBUTE}
                    className="sr-only"
                    aria-hidden="true"
                    tabIndex={-1}
                    onChange={(event) => chooseFile(event.target.files?.[0])}
                    disabled={disabled}
                />

                <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
                    {displayUrl ? (
                        <img
                            src={displayUrl}
                            alt={altText}
                            className="h-20 w-20 shrink-0 rounded-lg border border-line object-cover"
                        />
                    ) : (
                        <span
                            aria-hidden="true"
                            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted"
                        >
                            <Pill className="h-8 w-8" />
                        </span>
                    )}

                    <div className="min-w-0 flex-1 space-y-1.5">
                        {hasNewFile ? (
                            <>
                                <p className="text-sm font-medium text-ink">{value.name}</p>
                                <p className="text-xs text-muted">{formatFileSize(value.size)} · JPG, PNG or WEBP</p>
                                <p className="text-xs font-medium text-brand-700">
                                    This image will replace the current one when you save.
                                </p>
                            </>
                        ) : displayUrl ? (
                            <>
                                <p className="text-sm font-medium text-ink">Current image</p>
                                <p className="text-xs text-muted">{altBase}</p>
                            </>
                        ) : (
                            <p className="text-sm font-medium text-ink">No image yet</p>
                        )}

                        <div className="flex flex-wrap gap-2 pt-1">
                            {hasNewFile ? (
                                <Button variant="secondary" size="sm" onClick={clearSelection} disabled={disabled}>
                                    <X aria-hidden="true" className="h-4 w-4" />
                                    Remove selected image
                                </Button>
                            ) : displayUrl ? (
                                <>
                                    <Button variant="secondary" size="sm" onClick={handleBrowse} disabled={disabled}>
                                        <Upload aria-hidden="true" className="h-4 w-4" />
                                        Replace image
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={onRemoveCurrent} disabled={disabled}>
                                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                                        Remove image
                                    </Button>
                                </>
                            ) : (
                                <Button size="sm" onClick={handleBrowse} disabled={disabled}>
                                    <ImagePlus aria-hidden="true" className="h-4 w-4" />
                                    Choose image
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <p className="text-xs text-muted">JPG, PNG or WEBP, up to 5 MB. Drag and drop also works.</p>

            {error ? (
                <p role="alert" className="text-xs font-medium text-red-600">
                    {error}
                </p>
            ) : null}
        </div>
    )
}