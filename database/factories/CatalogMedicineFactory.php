<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class CatalogMedicineFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => $this->faker->words(2, true),
            'generic_name' => $this->faker->word(),
            'strength' => $this->faker->randomElement(['500mg', '100mg', '250mg']),
            'dosage_form' => $this->faker->randomElement(['Tablet', 'Capsule', 'Syrup']),
            'manufacturer' => $this->faker->company(),
            'image_url' => null,
            'is_active' => true,
        ];
    }
}
