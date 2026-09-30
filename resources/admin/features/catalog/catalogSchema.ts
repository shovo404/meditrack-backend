import { z } from 'zod'

/**
 * Client-side mirror of the Laravel `StoreCatalogMedicine` / `UpdateCatalogMedicine`
 * rules. Client validation is UX only — the backend re-validates and stays authoritative.
 * Optional text fields are plain strings so the form never binds `null`; empty strings
 * are dropped when the payload is built.
 */
export const catalogMedicineFormSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Medicine name is required.')
        .max(255, 'Medicine name must be 255 characters or fewer.'),
    genericName: z.string().trim().max(255, 'Generic name must be 255 characters or fewer.'),
    strength: z.string().trim().max(100, 'Strength must be 100 characters or fewer.'),
    dosageForm: z.string().trim().max(100, 'Dosage form must be 100 characters or fewer.'),
    manufacturer: z.string().trim().max(255, 'Manufacturer must be 255 characters or fewer.'),
    isActive: z.boolean(),
})

export type CatalogMedicineFormValues = z.infer<typeof catalogMedicineFormSchema>

export function emptyCatalogMedicineForm(): CatalogMedicineFormValues {
    return {
        name: '',
        genericName: '',
        strength: '',
        dosageForm: '',
        manufacturer: '',
        isActive: true,
    }
}

/** Maps the persisted resource shape back onto the form's string fields. */
export function catalogMedicineToFormValues(medicine: {
    name: string
    genericName: string | null
    strength: string | null
    dosageForm: string | null
    manufacturer: string | null
    isActive: boolean
}): CatalogMedicineFormValues {
    return {
        name: medicine.name,
        genericName: medicine.genericName ?? '',
        strength: medicine.strength ?? '',
        dosageForm: medicine.dosageForm ?? '',
        manufacturer: medicine.manufacturer ?? '',
        isActive: medicine.isActive,
    }
}