import { CheckCircle2, ListPlus, PauseCircle, Pill } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ApiError } from '@/lib/api/client'
import { useDashboardStats } from '@/features/dashboard/hooks/useDashboardStats'
import { DashboardErrorState } from '@/features/dashboard/components/DashboardErrorState'
import { DashboardStatsSkeleton } from '@/features/dashboard/components/DashboardStatsSkeleton'
import { RecentlyUpdated } from '@/features/dashboard/components/RecentlyUpdated'
import { StatCard } from '@/features/dashboard/components/StatCard'

/**
 * Phase 2E — Admin Dashboard.
 *
 * One request (`GET /admin/dashboard/stats`) drives the three whole-catalog counts and
 * the "Recently updated" list. Loading shows skeleton cards in the real grid; failures
 * map to scoped messages with Retry (or bounce to login on a dead session).
 */
export function DashboardPage() {
    const navigate = useNavigate()
    const query = useDashboardStats()

    return (
        <div className="space-y-6" aria-busy={query.isPending || undefined}>
            <PageHeader title="Dashboard" description="Overview of your medicine catalog." />

            {query.isPending ? (
                <DashboardStatsSkeleton />
            ) : query.error ? (
                <DashboardErrorState error={query.error as ApiError} onRetry={() => void query.refetch()} />
            ) : (
                <>
                    <section aria-label="Catalog statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <StatCard
                            icon={Pill}
                            label="Total medicines"
                            value={query.data.totalMedicines}
                            hint="Medicines in the global catalog"
                        />
                        <StatCard
                            icon={CheckCircle2}
                            label="Active medicines"
                            value={query.data.activeMedicines}
                            hint="Available in active selections"
                        />
                        <StatCard
                            icon={PauseCircle}
                            label="Inactive medicines"
                            value={query.data.inactiveMedicines}
                            hint="Hidden from active selections"
                        />
                    </section>

                    <Card>
                        <CardHeader
                            title="Quick actions"
                            description="Everyday tasks on the medicine catalog."
                        />
                        <CardBody className="grid gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => navigate('/admin/catalog/new')}
                                className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-muted"
                            >
                                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
                                    <ListPlus className="h-5 w-5" />
                                </span>
                                <span>
                                    <span className="block text-sm font-medium text-ink">Add Medicine</span>
                                    <span className="block text-xs text-muted">Create a new catalogue entry.</span>
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate('/admin/catalog')}
                                className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-muted"
                            >
                                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
                                    <Pill className="h-5 w-5" />
                                </span>
                                <span>
                                    <span className="block text-sm font-medium text-ink">View Catalog</span>
                                    <span className="block text-xs text-muted">Browse and manage all medicines.</span>
                                </span>
                            </button>
                        </CardBody>
                    </Card>

                    <RecentlyUpdated
                        medicines={query.data.recentlyUpdated}
                        onViewAll={() => navigate('/admin/catalog')}
                    />
                </>
            )}
        </div>
    )
}