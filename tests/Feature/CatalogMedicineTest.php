<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use App\Models\CatalogMedicine;

class CatalogMedicineTest extends TestCase
{
    use RefreshDatabase;

    protected function getAdmin()
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN]);
    }

    protected function getUser()
    {
        return User::factory()->create(['role' => User::ROLE_USER]);
    }

    public function test_admin_can_list_catalog_medicines()
    {
        CatalogMedicine::factory()->create();
        $response = $this->actingAs($this->getAdmin())->getJson('/api/v1/admin/catalog/medicines');
        $response->assertStatus(200);
        $response->assertJsonStructure(['data', 'meta', 'links']);
    }

    public function test_admin_can_create_medicine()
    {
        $response = $this->actingAs($this->getAdmin())->postJson('/api/v1/admin/catalog/medicines', [
            'name' => 'Test Med',
            'strength' => '100mg'
        ]);
        $response->assertStatus(201);
        $this->assertDatabaseHas('catalog_medicines', ['name' => 'Test Med']);
    }

    public function test_admin_can_view_medicine()
    {
        $medicine = CatalogMedicine::factory()->create(['name' => 'Test Med View']);
        $response = $this->actingAs($this->getAdmin())->getJson("/api/v1/admin/catalog/medicines/{$medicine->id}");
        $response->assertStatus(200);
        $response->assertJsonPath('data.name', 'Test Med View');
    }

    public function test_admin_can_update_medicine()
    {
        $medicine = CatalogMedicine::factory()->create(['name' => 'Old Name']);
        $response = $this->actingAs($this->getAdmin())->putJson("/api/v1/admin/catalog/medicines/{$medicine->id}", [
            'name' => 'New Name'
        ]);
        $response->assertStatus(200);
        $this->assertDatabaseHas('catalog_medicines', ['name' => 'New Name']);
    }

    public function test_admin_can_deactivate_and_activate_medicine()
    {
        $medicine = CatalogMedicine::factory()->create(['is_active' => true]);
        
        $response = $this->actingAs($this->getAdmin())->patchJson("/api/v1/admin/catalog/medicines/{$medicine->id}/status", [
            'is_active' => false
        ]);
        $response->assertStatus(200);
        $this->assertDatabaseHas('catalog_medicines', ['id' => $medicine->id, 'is_active' => false]);
        
        $response = $this->actingAs($this->getAdmin())->patchJson("/api/v1/admin/catalog/medicines/{$medicine->id}/status", [
            'is_active' => true
        ]);
        $response->assertStatus(200);
        $this->assertDatabaseHas('catalog_medicines', ['id' => $medicine->id, 'is_active' => true]);
    }

    public function test_admin_can_soft_delete_medicine()
    {
        $medicine = CatalogMedicine::factory()->create();
        $response = $this->actingAs($this->getAdmin())->deleteJson("/api/v1/admin/catalog/medicines/{$medicine->id}");
        $response->assertStatus(200);
        $this->assertSoftDeleted('catalog_medicines', ['id' => $medicine->id]);
    }

    public function test_normal_user_cannot_create_catalog_medicine()
    {
        $response = $this->actingAs($this->getUser())->postJson('/api/v1/admin/catalog/medicines', [
            'name' => 'Test Med'
        ]);
        $response->assertStatus(403);
    }

    public function test_normal_user_cannot_update_catalog_medicine()
    {
        $medicine = CatalogMedicine::factory()->create();
        $response = $this->actingAs($this->getUser())->putJson("/api/v1/admin/catalog/medicines/{$medicine->id}", [
            'name' => 'New Name'
        ]);
        $response->assertStatus(403);
    }

    public function test_normal_user_cannot_delete_catalog_medicine()
    {
        $medicine = CatalogMedicine::factory()->create();
        $response = $this->actingAs($this->getUser())->deleteJson("/api/v1/admin/catalog/medicines/{$medicine->id}");
        $response->assertStatus(403);
    }

    public function test_unauthenticated_user_cannot_access_admin_apis()
    {
        $response = $this->getJson('/api/v1/admin/catalog/medicines');
        $response->assertStatus(401);
    }

    public function test_public_user_catalog_endpoint_returns_only_active_medicines()
    {
        CatalogMedicine::factory()->create(['name' => 'Active Med', 'is_active' => true]);
        CatalogMedicine::factory()->create(['name' => 'Inactive Med', 'is_active' => false]);
        
        $response = $this->actingAs($this->getUser())->getJson('/api/v1/catalog/medicines');
        $response->assertStatus(200);
        
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Active Med', $data[0]['name']);
    }

    public function test_user_catalog_endpoint_requires_authentication()
    {
        $response = $this->getJson('/api/v1/catalog/medicines');
        $response->assertStatus(401);
    }

    public function test_user_catalog_endpoint_uses_stable_ordering_across_pages()
    {
        CatalogMedicine::factory()->count(25)->create(['is_active' => true]);

        $page1 = $this->actingAs($this->getUser())->getJson('/api/v1/catalog/medicines?per_page=10&page=1')->json('data');
        $page2 = $this->actingAs($this->getUser())->getJson('/api/v1/catalog/medicines?per_page=10&page=2')->json('data');
        $page3 = $this->actingAs($this->getUser())->getJson('/api/v1/catalog/medicines?per_page=10&page=3')->json('data');

        $this->assertCount(10, $page1);
        $this->assertCount(10, $page2);
        $this->assertCount(5, $page3);

        $allIds = array_column(array_merge($page1, $page2, $page3), 'id');
        $sortedIds = $allIds;
        sort($sortedIds, SORT_NUMERIC);

        $this->assertEquals(
            $sortedIds,
            $allIds,
            'Concatenated pages are not in stable ascending id order.'
        );
        $this->assertSameSize(
            array_unique($allIds),
            $allIds,
            'Pages contain duplicate/overlapping ids.'
        );
    }

    public function test_user_catalog_endpoint_returns_correct_camelcase_data()
    {
        CatalogMedicine::factory()->create([
            'name' => 'Paracetamol',
            'generic_name' => 'Acetaminophen',
            'strength' => '500mg',
            'dosage_form' => 'Tablet',
            'manufacturer' => 'PharmaX',
            'image_url' => null,
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->getUser())->getJson('/api/v1/catalog/medicines');
        $response->assertStatus(200);

        $item = $response->json('data.0');
        $this->assertEquals('Paracetamol', $item['name']);
        $this->assertEquals('Acetaminophen', $item['genericName']);
        $this->assertEquals('500mg', $item['strength']);
        $this->assertEquals('Tablet', $item['dosageForm']);
        $this->assertEquals('PharmaX', $item['manufacturer']);
        $this->assertNull($item['imageUrl']);
        $this->assertTrue($item['isActive']);
        $this->assertArrayHasKey('id', $item);
        $this->assertArrayHasKey('createdAt', $item);
        $this->assertArrayHasKey('updatedAt', $item);
    }

    public function test_user_catalog_endpoint_excludes_soft_deleted_medicines()
    {
        $medicine = CatalogMedicine::factory()->create(['is_active' => true]);
        $medicine->delete();

        $response = $this->actingAs($this->getUser())->getJson('/api/v1/catalog/medicines');
        $response->assertStatus(200);
        $this->assertCount(0, $response->json('data'));
    }

    public function test_user_catalog_endpoint_caps_per_page()
    {
        CatalogMedicine::factory()->count(120)->create(['is_active' => true]);

        $response = $this->actingAs($this->getUser())->getJson('/api/v1/catalog/medicines?per_page=500');
        $response->assertStatus(200);
        $this->assertCount(100, $response->json('data'));
        $this->assertEquals(2, $response->json('meta.last_page'));
    }

    public function test_catalog_search_works()
    {
        CatalogMedicine::factory()->create(['name' => 'Paracetamol 500mg', 'manufacturer' => 'Pharma A']);
        CatalogMedicine::factory()->create(['name' => 'Ibuprofen 200mg', 'manufacturer' => 'Pharma B']);
        
        $response = $this->actingAs($this->getUser())->getJson('/api/v1/catalog/medicines?search=Para');
        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
        
        $response = $this->actingAs($this->getUser())->getJson('/api/v1/catalog/medicines?search=Pharma B');
        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
    }

    public function test_pagination_works()
    {
        CatalogMedicine::factory()->count(25)->create(['is_active' => true]);
        
        $response = $this->actingAs($this->getUser())->getJson('/api/v1/catalog/medicines?per_page=10');
        $response->assertStatus(200);
        
        $this->assertCount(10, $response->json('data'));
        $this->assertEquals(25, $response->json('meta.total'));
    }

    public function test_validation_rejects_missing_medicine_name()
    {
        $response = $this->actingAs($this->getAdmin())->postJson('/api/v1/admin/catalog/medicines', [
            'strength' => '100mg'
        ]);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['name']);
    }

    public function test_validation_rejects_invalid_data()
    {
        $response = $this->actingAs($this->getAdmin())->postJson('/api/v1/admin/catalog/medicines', [
            'name' => 'Valid Name',
            'image_url' => 'not-a-url'
        ]);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['image_url']);
    }

    public function test_api_resource_returns_camelcase_json()
    {
        $medicine = CatalogMedicine::factory()->create([
            'generic_name' => 'Test Generic',
            'image_url' => 'http://example.com/image.png'
        ]);
        
        $response = $this->actingAs($this->getAdmin())->getJson("/api/v1/admin/catalog/medicines/{$medicine->id}");
        $response->assertStatus(200);
        
        $response->assertJsonStructure([
            'data' => [
                'id',
                'name',
                'genericName',
                'strength',
                'dosageForm',
                'manufacturer',
                'imageUrl',
                'isActive',
                'createdAt',
                'updatedAt'
            ]
        ]);
    }
}
