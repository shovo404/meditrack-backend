<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medicines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->uuid('catalog_medicine_id')->nullable()->constrained('catalog_medicines')->nullOnDelete();
            $table->string('name');
            $table->string('generic_name');
            $table->string('type');
            $table->string('strength');
            $table->double('dosage_amount');
            $table->string('dosage_unit');
            $table->string('frequency');
            $table->string('instructions')->nullable();
            $table->string('meal_instruction');
            $table->text('notes')->nullable();
            $table->string('image_url')->nullable();
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medicines');
    }
};
