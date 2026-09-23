<?php

/*
|--------------------------------------------------------------------------
| Cross-Origin Resource Sharing (CORS)
|--------------------------------------------------------------------------
|
| The Admin SPA is normally served from the same origin as the API, in which case
| CORS plays no part. These values matter for cross-origin setups (a separate Vite
| dev server, staging or preview hosts).
|
| `supports_credentials` is true because the Admin Panel authenticates with the
| Sanctum session cookie, so the browser must be allowed to send credentials.
| Browsers reject credentialed responses that use a wildcard origin, therefore
| `allowed_origins` must always be an explicit list — never `*`.
|
| Origins are environment driven so production hosts are never hard-coded here.
|
*/

$allowedOrigins = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('CORS_ALLOWED_ORIGINS', ''))
)));

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    /*
     * Defaults to the local Vite dev origins when CORS_ALLOWED_ORIGINS is unset.
     */
    'allowed_origins' => $allowedOrigins !== [] ? $allowedOrigins : [
        'http://localhost:5174',
        'http://127.0.0.1:5174',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
