<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dose_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('medicine_id')->nullable();
            $table->foreign('medicine_id')->references('id')->on('medicines')->nullOnDelete();
            // Deliberately not a foreign key: schedules are deleted and recreated
            // whenever a medicine is edited, so a constraint here would either block
            // that edit or erase the historical reference to the dose that was due.
            $table->uuid('schedule_id')->nullable();
            $table->string('medicine_name')->nullable();
            $table->timestamp('scheduled_at');
            $table->string('action', 32);
            $table->timestamp('recorded_at');
            $table->timestamps();

            $table->index(['user_id', 'recorded_at']);
            $table->index('medicine_id');
            $table->index('schedule_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dose_logs');
    }
};
