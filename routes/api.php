<?php

use App\Http\Controllers\AdminAuthController;
use App\Http\Controllers\AdminCatalogMedicineController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CatalogMedicineController;
use App\Http\Middleware\AdminMiddleware;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);

    // Admin Panel authentication (first-party SPA: session cookie + CSRF, never a token).
    // Login is public but administrator-only and rate limited; the rest require a session.
    Route::post('/admin/auth/login', [AdminAuthController::class, 'login'])
        ->middleware('throttle:admin-login');

    Route::middleware(['auth:sanctum', 'throttle:admin-auth'])->group(function () {
        Route::post('/admin/auth/logout', [AdminAuthController::class, 'logout']);
        Route::get('/admin/auth/user', [AdminAuthController::class, 'user'])->middleware('admin');
    });

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
                    'message' => 'Admin access verified',
                ]);
            });

            Route::apiResource('admin/catalog/medicines', AdminCatalogMedicineController::class)
                ->parameters(['medicines' => 'medicine']);
            Route::patch('admin/catalog/medicines/{medicine}/status', [AdminCatalogMedicineController::class, 'status']);
            Route::patch('admin/catalog/medicines/{medicine}/image', [AdminCatalogMedicineController::class, 'removeImage']);
        });
    });
});
