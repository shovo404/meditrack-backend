/// <reference types="vite/client" />

interface ImportMetaEnv {
    /**
     * Base path (or absolute URL) of the Laravel API.
     * Defaults to the same-origin `/api/v1`, which is what both the Vite dev proxy
     * and the production deployment use.
     */
    readonly VITE_ADMIN_API_BASE_URL?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
