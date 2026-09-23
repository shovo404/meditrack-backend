import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'

/**
 * Phase 2B placeholder. Catalog statistics arrive in a later phase.
 */
export function DashboardPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Admin Dashboard"
                description="Overview of the MediTrack global medicine catalog."
            />

            <Card>
                <CardHeader
                    title="Welcome to the admin panel"
                    description="Dashboard statistics are not part of this phase."
                />
                <CardBody>
                    <p className="text-sm text-muted">
                        You are signed in as an administrator. Catalog statistics, recent activity and quick actions
                        will be added in a later phase.
                    </p>
                </CardBody>
            </Card>
        </div>
    )
}
