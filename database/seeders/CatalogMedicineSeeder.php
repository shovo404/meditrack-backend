<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\CatalogMedicine;

class CatalogMedicineSeeder extends Seeder
{
    public function run(): void
    {
        CatalogMedicine::create([
            'name' => 'Paracetamol 500mg',
            'generic_name' => 'Paracetamol',
            'strength' => '500mg',
            'dosage_form' => 'Tablet',
            'manufacturer' => 'Generic Pharma',
            'is_active' => true,
        ]);

        CatalogMedicine::create([
            'name' => 'Paracetamol 650mg',
            'generic_name' => 'Paracetamol',
            'strength' => '650mg',
            'dosage_form' => 'Tablet',
            'manufacturer' => 'Generic Pharma',
            'is_active' => true,
        ]);

        CatalogMedicine::create([
            'name' => 'Omeprazole 20mg',
            'generic_name' => 'Omeprazole',
            'strength' => '20mg',
            'dosage_form' => 'Capsule',
            'manufacturer' => 'GastroCare',
            'is_active' => true,
        ]);
        
        CatalogMedicine::create([
            'name' => 'Inactive Med 10mg',
            'generic_name' => 'Inactive',
            'strength' => '10mg',
            'is_active' => false,
        ]);
    }
}
