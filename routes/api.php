<?php

use App\Http\Controllers\AdminAuthController;
use App\Http\Controllers\AdminCatalogMedicineController;
use App\Http\Controllers\AdminDashboardController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CatalogMedicineController;
use App\Http\Controllers\DoseLogController;
use App\Http\Controllers\PrescriptionController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\UserMedicineController;
use App\Http\Middleware\AdminMiddleware;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
    // Unauthenticated by design. Deliberately not inside the auth:sanctum group:
    // a signed-in user still needs to be able to recover the account.
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])
        ->middleware('throttle:password-reset');

    Route::post('/admin/auth/login', [AdminAuthController::class, 'login'])
        ->middleware('throttle:admin-login');

    Route::middleware(['auth:sanctum', 'throttle:admin-auth'])->group(function () {
        Route::post('/admin/auth/logout', [AdminAuthController::class, 'logout']);
        Route::get('/admin/auth/user', [AdminAuthController::class, 'user'])->middleware('admin');
    });

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/user', [AuthController::class, 'user']);

        // Profile. Updates only the authenticated user; no identifier is taken from input.
        Route::put('/profile', [ProfileController::class, 'update']);

        Route::get('/catalog/medicines', [CatalogMedicineController::class, 'index']);

        // User Medicine API
        Route::apiResource('medicines', UserMedicineController::class);
        Route::apiResource('prescriptions', PrescriptionController::class);

        // User DoseLog (medication history) API
        Route::post('dose_logs/bulk', [DoseLogController::class, 'bulk']);
        Route::apiResource('dose_logs', DoseLogController::class);

        Route::middleware(AdminMiddleware::class)->group(function () {
            Route::get('/admin/test', function () {
                return response()->json(['success' => true, 'message' => 'Admin access verified']);
            });

            Route::get('/admin/dashboard/stats', [AdminDashboardController::class, 'stats']);

            Route::apiResource('admin/catalog/medicines', AdminCatalogMedicineController::class)
                ->parameters(['medicines' => 'medicine'])->names('admin.catalog.medicines');
            Route::patch('admin/catalog/medicines/{medicine}/status', [AdminCatalogMedicineController::class, 'status']);
            Route::patch('admin/catalog/medicines/{medicine}/image', [AdminCatalogMedicineController::class, 'removeImage']);
        });
    });
});
