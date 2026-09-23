<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Vite;

Route::get('/', function () {
    return view('welcome');
});

/*
|--------------------------------------------------------------------------
| Admin Panel (SPA shell)
|--------------------------------------------------------------------------
|
| Serves the React admin application for every /admin path. This route returns
| HTML only and exposes no admin data: every admin API request is independently
| authorised by `auth:sanctum` + AdminMiddleware on /api/v1/admin/*.
|
| Being publicly reachable is intentional — it is what allows the login screen to
| render for signed-out visitors.
|
*/
Route::get('/admin/{any?}', function () {
    // The admin SPA has its own Vite build (vite.admin.config.js) and therefore its own
    // dev-server hot file. Scoping the hot file to this route keeps the default
    // public/hot path — and the marketing welcome view — untouched.
    Vite::useHotFile(public_path('build-admin/hot'));

    return view('admin.app');
})->where('any', '.*')->name('admin.shell');
