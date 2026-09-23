import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'

/**
 * Phase 2B placeholder. The catalog list, search, pagination, forms and image upload
 * UI are intentionally not implemented yet.
 */
export function CatalogPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Medicine Catalog"
                description="The global medicine catalog that MediTrack clients synchronise from."
            />

            <Card>
                <CardHeader
                    title="Catalog management"
                    description="Catalog management arrives in the next phase."
                />
                <CardBody>
                    <p className="text-sm text-muted">
                        Listing, searching, activating/deactivating and editing catalog medicines will be implemented
                        in a later phase. No catalog data is loaded on this page yet.
                    </p>
                </CardBody>
            </Card>
        </div>
    )
}
