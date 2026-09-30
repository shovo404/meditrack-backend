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
- **Phase 2B — Admin SPA frontend foundation** (COMPLETE) — `resources/admin` React 19 + TypeScript +
Vite 8 + Tailwind 4 app; `vite.admin.config.js` (dev port 5174, `/api`/`/sanctum`/`/storage` proxy,
build output `public/build-admin`); `GET /admin/{any?}` shell route; login page; session auth state +
`RequireAdmin` guard; API client with CSRF bootstrap, `419` retry and typed errors; responsive
sidebar/topbar shell with placeholder Dashboard/Catalog/Settings pages. 38 front-end tests, 80 PHP
tests, production build, and real-Chrome browser verification (built bundle + Vite dev server).
No medicines forms, image upload UI or dashboard statistics yet.
- **Phase 2C — Catalog list UI** (COMPLETE) — `/admin/catalog` responsive table (desktop/tablet) +
  mobile cards with server-side search (350ms debounce), Active/Inactive/All filter, pagination, status
  toggle and delete with confirmation dialogs, loading/empty/error states (401→login, 403, 429
  retry-after, 5xx retry, network), URL-driven `page/search/status` params, `features/catalog/*`.
  55 front-end tests + typecheck + production build green; backend untouched (existing
  `GET/PATCH/DELETE /api/v1/admin/catalog/medicines*` endpoints reused).
- **Phase 2D — Catalog create/edit + images** (NEXT) — validated forms, image upload/replace/remove with
  client-side validation and previews.
- **Phase 2E — Dashboard + polish** — catalog statistics endpoint and cards, dark mode,
accessibility pass, responsive QA.
- **Phase 2F — Hardening + docs** — CI gates (PHPUnit, typecheck, admin build), production
checklist, `ADMIN_PANEL_ARCHITECTURE.md`.