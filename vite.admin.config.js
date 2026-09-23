import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import laravel from 'laravel-vite-plugin'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Vite configuration for the Admin Panel SPA.
 *
 * Kept separate from the root `vite.config.js` so the existing Laravel/Tailwind
 * entry points (marketing `welcome` view) keep building exactly as before.
 *
 * - Source root:  resources/admin
 * - Dev server:   http://localhost:5174 with /api, /sanctum and /storage proxied to Laravel
 * - Build output: public/build-admin (served by Laravel under /build-admin/*)
 */
const ADMIN_ROOT = 'resources/admin'
const isTest = Boolean(process.env.VITEST)

export default defineConfig(({ command }) => ({
    root: ADMIN_ROOT,

    // Dev server serves the SPA from the site root; the built bundle is served by
    // Laravel from /build-admin/* so asset URLs can never collide with the SPA routes.
    base: command === 'serve' ? '/' : '/build-admin/',

    plugins: isTest
        ? []
        : [
              laravel({
                  // `input` is resolved against the Vite root above, so it stays root-relative —
                  // the same shape the manifest uses ("main.tsx").
                  input: ['main.tsx'],
                  buildDirectory: 'build-admin',
                  // Paths the plugin does not run through Vite are resolved from the Laravel
                  // project root instead, so the hot file is written inside public/.
                  hotFile: 'public/build-admin/hot',
                  refresh: false,
              }),
              react(),
              tailwindcss(),
          ],

    resolve: {
        alias: {
            '@': fileURLToPath(new URL(`./${ADMIN_ROOT}`, import.meta.url)),
        },
    },

    build: {
        outDir: '../../public/build-admin',
        emptyOutDir: true,
    },

    server: {
        port: 5174,
        strictPort: true,
        proxy: {
            // Development proxy: keeps the admin SPA on a single origin so the browser
            // sends the Sanctum session cookie without any cross-origin configuration.
            '/api': { target: 'http://127.0.0.1:8000' },
            '/sanctum': { target: 'http://127.0.0.1:8000' },
            '/storage': { target: 'http://127.0.0.1:8000' },
        },
    },

    test: {
        environment: 'jsdom',
        globals: true,
        css: false,
        restoreMocks: true,
        // The API client talks to `fetch`, which every test stubs.
        unstubGlobals: true,
        setupFiles: ['./test/setup.ts'],
        include: ['**/*.test.{ts,tsx}'],
    },
}))
