import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const ADMIN_ROOT = 'resources/admin'

export default defineConfig({
    root: ADMIN_ROOT,
    base: '/',
    plugins: [
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL(`./${ADMIN_ROOT}`, import.meta.url)),
        },
    },
    build: {
        outDir: '../../dist-admin-netlify',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: fileURLToPath(new URL(`./${ADMIN_ROOT}/index.html`, import.meta.url))
            }
        }
    },
})
