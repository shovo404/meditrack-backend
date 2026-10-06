<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../vendor/autoload.php';

// Fix for FrankenPHP: alias fastcgi_finish_request to prevent Symfony Response from calling flush()
// and causing "headers already sent" fatal errors when terminating the request.
if (! function_exists('fastcgi_finish_request') && function_exists('frankenphp_finish_request')) {
    function fastcgi_finish_request()
    {
        return frankenphp_finish_request();
    }
}

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once __DIR__.'/../bootstrap/app.php';

$app->handleRequest(Request::capture());
