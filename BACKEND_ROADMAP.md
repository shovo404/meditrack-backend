# MediTrack Backend Roadmap

This document defines the structured development phases for the Laravel Backend.

1. **Backend foundation** (COMPLETE)
2. **Authentication + User/Admin Foundation** (COMPLETE)
3. **Admin authentication** (COMPLETE) — dedicated Admin SPA session/cookie authentication at `/api/v1/admin/auth/login|logout|user`, Sanctum stateful SPA mode, CSRF, login throttling, reuse of `AdminMiddleware`; the Android bearer-token flow is unchanged.
4. **Medicine catalog** (COMPLETE)
5. **Medicine image storage** (COMPLETE)
6. **Catalog API** (COMPLETE) — `GET /api/v1/catalog/medicines`, active-only, paginated, searchable, stable `id` ordering, camelCase contract
7. **User medicine API**
8. **Prescription API**
9. **Android synchronization** (COMPLETE) — sequential page-by-page sync, transactional Room upsert, `deactivateMissing`, offline-first 10. **Production security** — HTTPS-only session cookies, environment-provided stateful/CORS origins, `/api/v1/admin/test` gating, mutation auditing.
11. **Testing** (see `php artisan test`)
12. **Deployment**

## Admin Panel (Web) Phases

The Admin Panel is a first-party SPA served by this Laravel application. It authenticates with
Sanctum's stateful (session cookie) mode; the Android app keeps using personal access tokens.

- **Phase 1 — Planning** (COMPLETE) — see `implementation_plan_admin_panel_phase1.md`.
- **Phase 2A — Admin backend foundation** (COMPLETE) — Sanctum stateful configuration, admin session
auth endpoints, rate limiting, credentialed CORS, logout hardening, feature tests and docs.
**No frontend work in this phase.**
- **Phase 2B — Admin SPA frontend foundation** (NEXT) — Vite admin config, React + TypeScript +
Tailwind app shell (sidebar/topbar/responsive), admin route guard, API client with CSRF handling,
admin login page.
- **Phase 2C — Catalog list UI** — responsive table, search, filters, pagination, status toggle,
delete confirmation, loading/empty/error states.
- **Phase 2D — Catalog create/edit + images** — validated forms, image upload/replace/remove with
client-side validation and previews.
- **Phase 2E — Dashboard + polish** — catalog statistics endpoint and cards, dark mode,
accessibility pass, responsive QA.
- **Phase 2F — Hardening + docs** — CI gates (PHPUnit, typecheck, admin build), production
checklist, `ADMIN_PANEL_ARCHITECTURE.md`.