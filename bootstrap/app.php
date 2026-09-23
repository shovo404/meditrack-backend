<?php

use App\Http\Middleware\AdminMiddleware;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // First-party SPA support for the Admin Panel: requests whose Origin/Referer host
        // is listed in SANCTUM_STATEFUL_DOMAINS receive the session + CSRF middleware
        // stack on the `api` group.
        //
        // Bearer-token clients (the Android app) send no Origin/Referer header, so
        // EnsureFrontendRequestsAreStateful::fromFrontend() returns false and their
        // token authentication flow is untouched.
        $middleware->statefulApi();

        $middleware->alias([
            'admin' => AdminMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
