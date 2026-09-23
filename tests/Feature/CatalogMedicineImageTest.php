<?php

namespace Tests\Feature;

use App\Models\CatalogMedicine;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CatalogMedicineImageTest extends TestCase
{
    use RefreshDatabase;

    protected string $imageDirectory = 'catalog-medicines';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    protected function getAdmin()
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN]);
    }

    protected function getUser()
    {
        return User::factory()->create(['role' => User::ROLE_USER]);
    }

    private function createMedicineWithImage(string $filename = 'pill.png'): array
    {
        $admin = $this->getAdmin();

        $response = $this->actingAs($admin)->post('/api/v1/admin/catalog/medicines', [
            'name' => 'Image Medicine',
            'image' => UploadedFile::fake()->image($filename),
        ], ['Accept' => 'application/json']);

        $medicine = CatalogMedicine::latest('id')->first();

        return [$admin, $medicine, $response];
    }

    private function diskUrl(string $path): string
    {
        return Storage::disk('public')->url($path);
    }

    public function test_admin_can_create_medicine_without_image()
    {
        $response = $this->actingAs($this->getAdmin())->postJson('/api/v1/admin/catalog/medicines', [
            'name' => 'No Image Med',
            'strength' => '100mg',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.imageUrl', null);

        $this->assertDatabaseHas('catalog_medicines', [
            'name' => 'No Image Med',
            'image_url' => null,
        ]);

        $this->assertEmpty(Storage::disk('public')->allFiles($this->imageDirectory));
    }

    public function test_admin_can_create_medicine_with_valid_jpg()
    {
        $response = $this->actingAs($this->getAdmin())->post('/api/v1/admin/catalog/medicines', [
            'name' => 'Jpg Med',
            'image' => UploadedFile::fake()->image('pill.jpg'),
        ], ['Accept' => 'application/json']);

        $response->assertStatus(201);

        $storedPath = CatalogMedicine::where('name', 'Jpg Med')->value('image_url');
        $this->assertNotNull($storedPath);
        $this->assertStringStartsWith($this->imageDirectory.'/', $storedPath);
        $this->assertTrue(Storage::disk('public')->exists($storedPath));
        $this->assertSame($this->diskUrl($storedPath), $response->json('data.imageUrl'));
    }

    public function test_admin_can_create_medicine_with_valid_png()
    {
        $response = $this->actingAs($this->getAdmin())->post('/api/v1/admin/catalog/medicines', [
            'name' => 'Png Med',
            'image' => UploadedFile::fake()->image('pill.png'),
        ], ['Accept' => 'application/json']);

        $response->assertStatus(201);

        $storedPath = CatalogMedicine::where('name', 'Png Med')->value('image_url');
        $this->assertStringStartsWith($this->imageDirectory.'/', $storedPath);
        $this->assertTrue(Storage::disk('public')->exists($storedPath));
    }

    public function test_admin_can_create_medicine_with_valid_webp()
    {
        if (! function_exists('imagewebp')) {
            $this->markTestSkipped('WEBP is not supported by the local GD extension.');
        }

        $response = $this->actingAs($this->getAdmin())->post('/api/v1/admin/catalog/medicines', [
            'name' => 'Webp Med',
            'image' => UploadedFile::fake()->image('pill.webp'),
        ], ['Accept' => 'application/json']);

        $response->assertStatus(201);

        $storedPath = CatalogMedicine::where('name', 'Webp Med')->value('image_url');
        $this->assertStringStartsWith($this->imageDirectory.'/', $storedPath);
        $this->assertTrue(Storage::disk('public')->exists($storedPath));
        $this->assertSame($this->diskUrl($storedPath), $response->json('data.imageUrl'));
    }

    public function test_invalid_file_type_is_rejected()
    {
        $invalidFiles = [
            'plain.txt' => UploadedFile::fake()->create('notes.txt', 100),
            'app.exe' => UploadedFile::fake()->create('setup.exe', 200),
        ];

        foreach ($invalidFiles as $filename => $file) {
            $response = $this->actingAs($this->getAdmin())->post('/api/v1/admin/catalog/medicines', [
                'name' => 'Invalid '.$filename,
                'image' => $file,
            ], ['Accept' => 'application/json']);

            $response->assertStatus(422);
            $response->assertJsonValidationErrors(['image']);
        }

        $this->assertDatabaseCount('catalog_medicines', 0);
        $this->assertEmpty(Storage::disk('public')->allFiles($this->imageDirectory));
    }

    public function test_svg_is_rejected()
    {
        $response = $this->actingAs($this->getAdmin())->post('/api/v1/admin/catalog/medicines', [
            'name' => 'Svg Med',
            'image' => UploadedFile::fake()->createWithContent(
                'icon.svg',
                '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'
            ),
        ], ['Accept' => 'application/json']);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['image']);
    }

    public function test_oversized_file_is_rejected()
    {
        $response = $this->actingAs($this->getAdmin())->post('/api/v1/admin/catalog/medicines', [
            'name' => 'Big Med',
            'image' => UploadedFile::fake()->image('huge.jpg')->size(6000),
        ], ['Accept' => 'application/json']);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['image']);
    }

    public function test_normal_user_cannot_upload_catalog_image()
    {
        $response = $this->actingAs($this->getUser())->post('/api/v1/admin/catalog/medicines', [
            'name' => 'User Med',
            'image' => UploadedFile::fake()->image('pill.jpg'),
        ], ['Accept' => 'application/json']);

        $response->assertStatus(403);

        $this->assertDatabaseCount('catalog_medicines', 0);
        $this->assertEmpty(Storage::disk('public')->allFiles($this->imageDirectory));
    }

    public function test_unauthenticated_user_cannot_upload_image()
    {
        $response = $this->post('/api/v1/admin/catalog/medicines', [
            'name' => 'Anon Med',
            'image' => UploadedFile::fake()->image('pill.jpg'),
        ], ['Accept' => 'application/json']);

        $response->assertStatus(401);
        $this->assertDatabaseCount('catalog_medicines', 0);
    }

    public function test_admin_can_replace_existing_image()
    {
        [$admin, $medicine] = $this->createMedicineWithImage('first.png');
        $oldPath = $medicine->image_url;
        $this->assertTrue(Storage::disk('public')->exists($oldPath));

        $response = $this->actingAs($admin)->put("/api/v1/admin/catalog/medicines/{$medicine->id}", [
            'image' => UploadedFile::fake()->image('second.jpg'),
        ], ['Accept' => 'application/json']);

        $response->assertStatus(200);

        $newPath = $medicine->fresh()->image_url;
        $this->assertNotSame($oldPath, $newPath);
        $this->assertStringStartsWith($this->imageDirectory.'/', $newPath);
        $this->assertTrue(Storage::disk('public')->exists($newPath));
        $this->assertSame($this->diskUrl($newPath), $response->json('data.imageUrl'));
    }

    public function test_old_image_is_cleaned_up_after_successful_replacement()
    {
        [$admin, $medicine] = $this->createMedicineWithImage('old.png');
        $oldPath = $medicine->image_url;

        $this->actingAs($admin)->put("/api/v1/admin/catalog/medicines/{$medicine->id}", [
            'image' => UploadedFile::fake()->image('new.jpg'),
        ], ['Accept' => 'application/json']);

        $this->assertFalse(Storage::disk('public')->exists($oldPath));

        $files = Storage::disk('public')->allFiles($this->imageDirectory);
        $this->assertCount(1, $files);
    }

    public function test_admin_can_remove_image()
    {
        [$admin, $medicine] = $this->createMedicineWithImage('remove.png');
        $oldPath = $medicine->image_url;

        $response = $this->actingAs($admin)->patchJson("/api/v1/admin/catalog/medicines/{$medicine->id}/image", [
            'remove_image' => true,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.imageUrl', null);

        $this->assertDatabaseHas('catalog_medicines', ['id' => $medicine->id, 'image_url' => null]);
        $this->assertFalse(Storage::disk('public')->exists($oldPath));
    }

    public function test_removing_image_sets_image_url_to_null()
    {
        [$admin, $medicine] = $this->createMedicineWithImage('null.png');

        $this->actingAs($admin)->patchJson("/api/v1/admin/catalog/medicines/{$medicine->id}/image", [
            'remove_image' => true,
        ]);

        $this->assertNull($medicine->fresh()->image_url);
        $this->assertEmpty(Storage::disk('public')->allFiles($this->imageDirectory));
    }

    public function test_remove_image_via_update_endpoint()
    {
        [$admin, $medicine] = $this->createMedicineWithImage('via-update.png');
        $oldPath = $medicine->image_url;

        $response = $this->actingAs($admin)->patchJson("/api/v1/admin/catalog/medicines/{$medicine->id}", [
            'name' => 'Updated Name',
            'remove_image' => true,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.imageUrl', null);
        $this->assertNull($medicine->fresh()->image_url);
        $this->assertFalse(Storage::disk('public')->exists($oldPath));
        $this->assertDatabaseHas('catalog_medicines', ['id' => $medicine->id, 'name' => 'Updated Name']);
    }

    public function test_update_without_image_keeps_existing_image()
    {
        [$admin, $medicine] = $this->createMedicineWithImage('keep.png');
        $originalPath = $medicine->image_url;

        $this->actingAs($admin)->patchJson("/api/v1/admin/catalog/medicines/{$medicine->id}", [
            'name' => 'Kept Image Med',
        ]);

        $response = $this->actingAs($admin)->getJson("/api/v1/admin/catalog/medicines/{$medicine->id}");
        $response->assertJsonPath('data.imageUrl', $this->diskUrl($originalPath));

        $this->assertSame($originalPath, $medicine->fresh()->image_url);
        $this->assertTrue(Storage::disk('public')->exists($originalPath));
    }

    public function test_replace_and_remove_image_together_is_rejected()
    {
        [$admin, $medicine] = $this->createMedicineWithImage('conflict.png');

        $response = $this->actingAs($admin)->patchJson("/api/v1/admin/catalog/medicines/{$medicine->id}", [
            'image' => UploadedFile::fake()->image('other.jpg'),
            'remove_image' => true,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['remove_image']);

        $this->assertSame($medicine->image_url, $medicine->fresh()->image_url);
    }

    public function test_remove_image_endpoint_requires_remove_image_true()
    {
        [$admin, $medicine] = $this->createMedicineWithImage('require.png');

        $response = $this->actingAs($admin)->patchJson("/api/v1/admin/catalog/medicines/{$medicine->id}/image", []);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['remove_image']);
    }

    public function test_api_resource_returns_public_image_url()
    {
        [$admin, $medicine] = $this->createMedicineWithImage('public-url.png');
        $storedPath = $medicine->fresh()->image_url;

        $response = $this->actingAs($admin)->getJson("/api/v1/admin/catalog/medicines/{$medicine->id}");

        $response->assertStatus(200);
        $imageUrl = $response->json('data.imageUrl');

        $this->assertSame($this->diskUrl($storedPath), $imageUrl);
        $this->assertNotSame($storedPath, $imageUrl);
        $this->assertStringContainsString('/storage/'.$this->imageDirectory.'/', $imageUrl);
    }

    public function test_medicine_without_image_returns_null_image_url()
    {
        $medicine = CatalogMedicine::factory()->create(['image_url' => null]);

        $response = $this->actingAs($this->getAdmin())->getJson("/api/v1/admin/catalog/medicines/{$medicine->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('data.imageUrl', null);
    }

    public function test_soft_deleting_medicine_keeps_its_image_file()
    {
        [$admin, $medicine] = $this->createMedicineWithImage('soft-delete.png');
        $storedPath = $medicine->fresh()->image_url;

        $response = $this->actingAs($admin)->deleteJson("/api/v1/admin/catalog/medicines/{$medicine->id}");

        $response->assertStatus(200);
        $this->assertSoftDeleted('catalog_medicines', ['id' => $medicine->id]);
        $this->assertTrue(Storage::disk('public')->exists($storedPath));
        $this->assertCount(1, Storage::disk('public')->allFiles($this->imageDirectory));
    }

    public function test_normal_user_cannot_remove_image()
    {
        [$admin, $medicine] = $this->createMedicineWithImage('user-remove.png');

        $response = $this->actingAs($this->getUser())->patchJson("/api/v1/admin/catalog/medicines/{$medicine->id}/image", [
            'remove_image' => true,
        ]);

        $response->assertStatus(403);
        $this->assertTrue(Storage::disk('public')->exists($medicine->fresh()->image_url));
    }

    public function test_unauthenticated_user_cannot_remove_image()
    {
        $medicine = CatalogMedicine::factory()->create();

        $response = $this->patchJson("/api/v1/admin/catalog/medicines/{$medicine->id}/image", [
            'remove_image' => true,
        ]);

        $response->assertStatus(401);
    }

    public function test_legacy_external_image_url_is_still_returned_as_is()
    {
        $medicine = CatalogMedicine::factory()->create([
            'image_url' => 'https://example.com/legacy/medicine.png',
        ]);

        $response = $this->actingAs($this->getAdmin())->getJson("/api/v1/admin/catalog/medicines/{$medicine->id}");

        $response->assertJsonPath('data.imageUrl', 'https://example.com/legacy/medicine.png');
    }

    public function test_stored_files_use_generated_unique_filenames()
    {
        [$admin, $medicine] = $this->createMedicineWithImage('evil-../../traversal.png');
        $storedPath = $medicine->fresh()->image_url;

        $this->assertStringStartsWith($this->imageDirectory.'/', $storedPath);
        $this->assertStringNotContainsString('traversal', $storedPath);

        $filename = basename($storedPath);
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9]{40}\.png$/', $filename);
        $this->assertTrue(Storage::disk('public')->exists($storedPath));
    }
}
