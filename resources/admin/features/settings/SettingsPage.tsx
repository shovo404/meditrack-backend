import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'

/** Placeholder for future admin/account settings. */
export function SettingsPage() {
    return (
        <div className="space-y-6">
            <PageHeader title="Settings" description="Admin panel and account preferences." />

            <Card>
                <CardHeader title="Admin preferences" description="Settings will be added in a later phase." />
                <CardBody>
                    <p className="text-sm text-muted">
                        Settings will be added in a later phase.
                    </p>
                </CardBody>
            </Card>
        </div>
    )
}
