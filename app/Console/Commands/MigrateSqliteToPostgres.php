<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class MigrateSqliteToPostgres extends Command
{
    protected $signature = 'meditrack:migrate-to-postgres';
    protected $description = 'Migrate data from SQLite to PostgreSQL';

    public function handle()
    {
        $this->info('Starting data migration from SQLite to PostgreSQL...');

        // Order of tables is important to respect foreign keys
        $tables = [
            'users',
            'catalog_medicines',
            'medicines',
            'medicine_schedules',
            'prescriptions',
            'dose_logs',
            'personal_access_tokens'
        ];
        
        foreach ($tables as $table) {
            $this->info("Migrating table: {$table}");
            
            $rows = DB::connection('sqlite')->table($table)->get()->map(function($row) {
                return (array) $row;
            })->toArray();
            
            if (empty($rows)) {
                $this->line(" - No data to migrate for {$table}.");
                continue;
            }

            // Chunk inserts to avoid query size limits
            $chunks = array_chunk($rows, 100);
            $migrated = 0;
            
            foreach ($chunks as $chunk) {
                foreach ($chunk as &$row) {
                    if ($table === 'medicines') {
                        $row['is_active'] = (bool) $row['is_active'];
                    }
                    if ($table === 'medicine_schedules') {
                        $row['is_active'] = (bool) $row['is_active'];
                    }
                }
                
                DB::connection('pgsql')->table($table)->insert($chunk);
                $migrated += count($chunk);
            }
            
            $this->info(" - Migrated {$migrated} rows to {$table}.");
        }
        
        // Postgres sequences for auto-increment fields must be updated
        $this->info('Updating sequences for auto-increment columns...');
        $tablesWithAutoIncrement = ['users', 'catalog_medicines', 'personal_access_tokens'];
        foreach ($tablesWithAutoIncrement as $table) {
            $maxId = DB::connection('pgsql')->table($table)->max('id') ?: 0;
            $nextId = $maxId + 1;
            DB::connection('pgsql')->statement("ALTER SEQUENCE {$table}_id_seq RESTART WITH {$nextId}");
        }

        $this->info('Migration completed safely.');
    }
}
