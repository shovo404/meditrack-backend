<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Middleware\AdminMiddleware;
use App\Http\Controllers\AdminCatalogMedicineController;
use App\Http\Controllers\CatalogMedicineController;

Route::prefix('v1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/user', [AuthController::class, 'user']);

        // User Catalog API
        Route::get('/catalog/medicines', [CatalogMedicineController::class, 'index']);

        // Admin API
        Route::middleware(AdminMiddleware::class)->group(function () {
            Route::get('/admin/test', function () {
                return response()->json([
                    'success' => true,
                    'message' => 'Admin access verified'
                ]);
            });

            Route::apiResource('admin/catalog/medicines', AdminCatalogMedicineController::class)
                 ->parameters(['medicines' => 'medicine']);
            Route::patch('admin/catalog/medicines/{medicine}/status', [AdminCatalogMedicineController::class, 'status']);
        });
    });
});
