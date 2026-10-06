<?php

namespace App\Models\Concerns;

use MongoDB\Operation\FindOneAndUpdate;

/**
 * Supplies auto-increment integer IDs for MongoDB documents.
 *
 * MongoDB has no server-side auto-increment, so IDs for `users`,
 * `catalog_medicines` and `personal_access_tokens` are allocated from a
 * `counters` collection that mirrors the integer auto-increment semantics
 * the clients (Android + Admin SPA) already depend on.
 */
trait AutoIncrementsId
{
    protected static function bootAutoIncrementsId(): void
    {
        static::creating(function ($model): void {
            file_put_contents('/tmp/cb2.log', static::class . " creating: " . get_class($model) . "\n", FILE_APPEND);
            if (empty($model->id)) {
                $model->id = static::nextSequence($model->getTable()); file_put_contents("/tmp/cb3.log", "set to ".var_export($model->id, true)."\n", FILE_APPEND);
            }
        });
    }

    protected static function nextSequence(string $name): int
    {
        $result = \Illuminate\Support\Facades\DB::connection(static::make()->getConnectionName())
            ->getDatabase()
            ->selectCollection('counters')
            ->findOneAndUpdate(
                ['_id' => $name],
                ['$inc' => ['seq' => 1]],
                ['upsert' => true, 'returnDocument' => FindOneAndUpdate::RETURN_DOCUMENT_AFTER]
            );

        return (int) $result['seq'];
    }
}
