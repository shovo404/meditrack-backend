<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Unify `medicines.catalog_medicine_id` with the canonical catalog identifier.
 *
 * The canonical identifier of a catalogue entry is the existing
 * `catalog_medicines.id`, which is an auto-incrementing integer. The original
 * `create_medicines_table` migration declared this column as a `uuid`, which
 * cannot ever hold a real catalogue id and made the Laravel `uuid` validation
 * rule reject every legitimate client value with a 422.
 *
 * This migration:
 *   1. Detaches any link that could never have resolved (non-numeric values, or
 *      numeric values with no matching catalogue row). Only the *link* is
 *      cleared -- the medicine row itself, its schedules and its dose history
 *      are never touched, so no user data is destroyed.
 *   2. Re-types the column to an unsigned big integer.
 *   3. Adds the foreign key that the original migration declared but which was
 *      never present in the live SQLite schema.
 *
 * Non-destructive: the `medicines` table is altered in place and is not dropped.
 * `catalog_medicines` itself is left completely untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('medicines', 'catalog_medicine_id')) {
            return;
        }

        $this->detachUnresolvableCatalogLinks();

                if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE medicines DROP COLUMN catalog_medicine_id');
            DB::statement('ALTER TABLE medicines ADD COLUMN catalog_medicine_id bigint NULL');
        } else {
            Schema::table('medicines', function (Blueprint $table) {
                $table->unsignedBigInteger('catalog_medicine_id')
                    ->nullable()
                    ->change();
            });
        }

        Schema::table('medicines', function (Blueprint $table) {
            $table->foreign('catalog_medicine_id')
                ->references('id')
                ->on('catalog_medicines')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('medicines', 'catalog_medicine_id')) {
            return;
        }

        Schema::table('medicines', function (Blueprint $table) {
            $table->dropForeign(['catalog_medicine_id']);
        });

        Schema::table('medicines', function (Blueprint $table) {
            $table->string('catalog_medicine_id')->nullable()->change();
        });
    }

    /**
     * Null out catalogue links that could never resolve.
     *
     * Two cases are handled:
     *   - non-numeric values (legacy uuid-shaped values written before this fix)
     *   - numeric values with no matching row in `catalog_medicines`
     *
     * Either way the link was already unusable: it could not match a catalogue
     * row and could not be resolved by the client. Clearing it restores a valid
     * foreign-key state without discarding any medicine, schedule or dose log.
     */
    private function detachUnresolvableCatalogLinks(): void
    {
        $catalogIds = DB::table('catalog_medicines')->pluck('id')->map(
            fn ($id): string => (string) $id
        );

        DB::table('medicines')
            ->whereNotNull('catalog_medicine_id')
            ->get(['id', 'catalog_medicine_id'])
            ->each(function ($medicine) use ($catalogIds): void {
                $value = (string) $medicine->catalog_medicine_id;

                $isNumeric = preg_match('/^\d+$/', $value) === 1;
                $isKnown = $catalogIds->contains($value);

                if (! $isNumeric || ! $isKnown) {
                    DB::table('medicines')
                        ->where('id', $medicine->id)
                        ->update(['catalog_medicine_id' => null]);
                }
            });
    }
};
