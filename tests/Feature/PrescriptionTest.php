<?php

namespace Tests\Feature;

use App\Models\Prescription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PrescriptionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    public function test_user_can_create_prescription()
    {
        $user = User::factory()->create();
        $file = UploadedFile::fake()->image('prescription.jpg');

        $response = $this->actingAs($user)->postJson('/api/v1/prescriptions', [
            'id' => '029a1d47-66c8-4720-bbd4-28bbf1ba0dd0',
            'title' => 'Test Prescription',
            'image' => $file,
            'doctorName' => 'Dr. Smith',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.title', 'Test Prescription');

        $this->assertDatabaseHas('prescriptions', [
            'user_id' => $user->id,
            'title' => 'Test Prescription',
        ]);

        $prescription = Prescription::first();
        Storage::disk('public')->assertExists($prescription->image_path);
    }

    public function test_user_can_list_own_prescriptions()
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();

        $prescription = $user->prescriptions()->create([
            'id' => '029a1d47-66c8-4720-bbd4-28bbf1ba0dd0',
            'title' => 'Own',
            'image_path' => 'fake_path.jpg',
        ]);

        $otherUser->prescriptions()->create([
            'id' => '129a1d47-66c8-4720-bbd4-28bbf1ba0dd0',
            'title' => 'Other',
            'image_path' => 'fake_path2.jpg',
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/prescriptions');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $prescription->id);
    }

    public function test_user_cannot_access_other_users_prescription()
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();

        $prescription = $otherUser->prescriptions()->create([
            'id' => '129a1d47-66c8-4720-bbd4-28bbf1ba0dd0',
            'title' => 'Other',
            'image_path' => 'fake_path2.jpg',
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/prescriptions/'.$prescription->id);
        $response->assertStatus(404);

        $responsePut = $this->actingAs($user)->putJson('/api/v1/prescriptions/'.$prescription->id, [
            'title' => 'Stolen',
        ]);
        $responsePut->assertStatus(404);

        $responseDelete = $this->actingAs($user)->deleteJson('/api/v1/prescriptions/'.$prescription->id);
        $responseDelete->assertStatus(404);
    }

    public function test_user_can_update_prescription()
    {
        $user = User::factory()->create();
        $prescription = $user->prescriptions()->create([
            'id' => '029a1d47-66c8-4720-bbd4-28bbf1ba0dd0',
            'title' => 'Own',
            'image_path' => 'fake_path.jpg',
        ]);

        $response = $this->actingAs($user)->putJson('/api/v1/prescriptions/'.$prescription->id, [
            'title' => 'Updated Title',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('prescriptions', [
            'id' => $prescription->id,
            'title' => 'Updated Title',
        ]);
    }

    public function test_user_can_replace_prescription_image()
    {
        $user = User::factory()->create();

        $oldFile = UploadedFile::fake()->image('old.jpg');
        $oldPath = $oldFile->store('prescriptions/'.$user->id, 'public');

        $prescription = $user->prescriptions()->create([
            'id' => '029a1d47-66c8-4720-bbd4-28bbf1ba0dd0',
            'title' => 'Image Test',
            'image_path' => $oldPath,
        ]);

        Storage::disk('public')->assertExists($oldPath);

        $newFile = UploadedFile::fake()->image('new.jpg');
        $response = $this->actingAs($user)->putJson('/api/v1/prescriptions/'.$prescription->id, [
            'title' => 'Image Test',
            'image' => $newFile,
        ]);

        $response->assertStatus(200);

        $prescription->refresh();

        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists($prescription->image_path);
        $this->assertNotEquals($oldPath, $prescription->image_path);
    }

    public function test_user_can_delete_prescription()
    {
        $user = User::factory()->create();

        $file = UploadedFile::fake()->image('test.jpg');
        $path = $file->store('prescriptions/'.$user->id, 'public');

        $prescription = $user->prescriptions()->create([
            'id' => '029a1d47-66c8-4720-bbd4-28bbf1ba0dd0',
            'title' => 'To Delete',
            'image_path' => $path,
        ]);

        Storage::disk('public')->assertExists($path);

        $response = $this->actingAs($user)->deleteJson('/api/v1/prescriptions/'.$prescription->id);

        $response->assertStatus(204);
        $this->assertDatabaseMissing('prescriptions', ['id' => $prescription->id]);
        Storage::disk('public')->assertMissing($path);
    }

    public function test_unauthenticated_user_cannot_access()
    {
        $response = $this->getJson('/api/v1/prescriptions');
        $response->assertStatus(401);
    }
}
