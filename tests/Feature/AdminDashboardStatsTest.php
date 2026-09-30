<?php

namespace Tests\Feature;

use App\Models\CatalogMedicine;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Dashboard statistics endpoint (`GET /api/v1/admin/dashboard/stats`).
 *
 * The counts must describe the live catalog exactly as the admin list reports it:
 * totals across the whole table (never a page) with soft-deleted rows excluded.
 */
class AdminDashboardStatsTest extends TestCase
{
    use RefreshDatabase;

    protected function getAdmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN]);
    }

    protected function getUser(): User
    {
        return User::factory()->create(['role' => User::ROLE_USER]);
    }

    public function test_admin_can_view_dashboard_stats()
    {
        CatalogMedicine::factory()->create(['name' => 'Active Med', 'is_active' => true]);
        CatalogMedicine::factory()->count(2)->create(['name' => 'Inactive Med', 'is_active' => false]);

        $response = $this->actingAs($this->getAdmin())->getJson('/api/v1/admin/dashboard/stats');

        $response->assertStatus(200)
            ->assertJsonPath('totalMedicines', 3)
            ->assertJsonPath('activeMedicines', 1)
            ->assertJsonPath('inactiveMedicines', 2)
            ->assertJsonStructure([
                'totalMedicines',
                'activeMedicines',
                'inactiveMedicines',
                'recentlyUpdated' => [['id', 'name', 'isActive', 'updatedAt']],
            ]);
    }

    public function test_dashboard_stats_exclude_soft_deleted_medicines()
    {
        $trashed = CatalogMedicine::factory()->create(['name' => 'To Delete', 'is_active' => true]);
        $trashed->delete();

        CatalogMedicine::factory()->count(2)->create(['name' => 'Kept', 'is_active' => true]);
        CatalogMedicine::factory()->count(2)->create(['name' => 'Kept', 'is_active' => false]);

        $response = $this->actingAs($this->getAdmin())->getJson('/api/v1/admin/dashboard/stats');

        $response->assertStatus(200)
            ->assertJsonPath('totalMedicines', 4)
            ->assertJsonPath('activeMedicines', 2)
            ->assertJsonPath('inactiveMedicines', 2);
    }

    public function test_recently_updated_medicines_are_ordered_most_recent_first()
    {
        CatalogMedicine::factory()->create(['name' => 'Older', 'updated_at' => '2026-01-01 10:00:00']);
        $newer = CatalogMedicine::factory()->create(['name' => 'Newer', 'updated_at' => '2026-03-01 10:00:00']);
        CatalogMedicine::factory()->create(['name' => 'Middle', 'updated_at' => '2026-02-01 10:00:00']);

        $response = $this->actingAs($this->getAdmin())->getJson('/api/v1/admin/dashboard/stats');

        $response->assertStatus(200)
            ->assertJsonPath('recentlyUpdated.0.name', 'Newer')
            ->assertJsonPath('recentlyUpdated.1.name', 'Middle')
            ->assertJsonPath('recentlyUpdated.2.name', 'Older')
            ->assertJsonCount(3, 'recentlyUpdated');
    }

    public function test_non_admin_user_is_forbidden_from_dashboard_stats()
    {
        $response = $this->actingAs($this->getUser())->getJson('/api/v1/admin/dashboard/stats');

        $response->assertStatus(403);
    }

    public function test_unauthenticated_request_is_rejected_from_dashboard_stats()
    {
        $this->getJson('/api/v1/admin/dashboard/stats')->assertStatus(401);

        $this->withHeaders([
            'Origin' => 'http://localhost:5174',
            'Referer' => 'http://localhost:5174/admin',
        ])->getJson('/api/v1/admin/dashboard/stats')->assertStatus(401);
    }
}
