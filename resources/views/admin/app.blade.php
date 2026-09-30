@php
    // Built assets (public/build-admin) or a running Vite admin dev server (build-admin/hot).
    $adminAssetsAreAvailable = file_exists(public_path('build-admin/hot'))
        || file_exists(public_path('build-admin/manifest.json'));
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="h-full">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="robots" content="noindex, nofollow">
        <meta name="color-scheme" content="light dark">
        <title>MediTrack Admin</title>

        {{--
            Apply the saved theme before first paint so a dark-mode user never sees a flash
            of the light theme. Mirrors `lib/theme/themeProvider.tsx`: storage key, 'system'
            default, and OS-preference resolution. Storage exceptions (private mode) fall
            back to the default preference.
        --}}
        <script>
            (function () {
                try {
                    var stored = localStorage.getItem('meditrack-admin-theme');
                    var mode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
                    var dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                    document.documentElement.classList.toggle('dark', dark);
                } catch (e) {
                    /* theme preference unavailable: stay with the default */
                }
            })();
        </script>

        @if ($adminAssetsAreAvailable)
            {{--
                React Fast Refresh preamble: only emitted while the admin Vite dev server is
                running (it reads public/build-admin/hot, set per-route in routes/web.php).
            --}}
            @viteReactRefresh

            {{--
                The entry point is root-relative to the admin Vite root (resources/admin),
                which is how vite.admin.config.js writes the manifest: public/build-admin/manifest.json
                keys the bundle as "main.tsx".
            --}}
            @vite('main.tsx', 'build-admin')
        @endif
    </head>
    <body class="h-full">
        {{--
            This page is only the SPA shell: it renders no catalog or account data.
            Authorization happens on every /api/v1/admin/* request through
            `auth:sanctum` + AdminMiddleware on the Laravel side.
        --}}
        <div id="admin-root"></div>

        @unless ($adminAssetsAreAvailable)
            <div style="font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 34rem; margin: 4rem auto; padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 0.875rem; background: #ffffff; color: #0f172a;">
                <h1 style="font-size: 1.125rem; font-weight: 600; margin: 0 0 0.5rem;">Admin panel assets are not built</h1>
                <p style="font-size: 0.875rem; color: #64748b; margin: 0 0 1rem;">
                    Run <code>npm run build:admin</code> to build the admin SPA, or
                    <code>npm run dev:admin</code> to start the Vite dev server on port 5174.
                </p>
                <p style="font-size: 0.75rem; color: #94a3b8; margin: 0;">
                    The admin API remains protected regardless; this message only means the user interface bundle is missing.
                </p>
            </div>
        @endunless

        <noscript>
            <div style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 34rem; margin: 4rem auto; padding: 1.5rem;">
                The MediTrack admin panel requires JavaScript.
            </div>
        </noscript>
    </body>
</html>
