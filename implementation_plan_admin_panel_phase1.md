# MediTrack Admin Web Panel — Phase 1 Implementation Plan

**Status: PLANNING ONLY. No code was modified, no files created/modified in `app/`, `routes/`, `config/`, `resources/`, `database/`, or `public/`. The only artifact produced by this phase is this document.**

- Target repository: `/Users/shovo/Downloads/MediTrack-Backend`
- Android client (unchanged by this plan): `/Users/shovo/Downloads/MediTrack`
- Baseline verified during inspection: **`php artisan test` → 58 passed (183 assertions), 0.82s**
- Laravel Framework **13.33.0**, PHP **8.4.22**, Laravel Sanctum **4.x**, Node **v26.7.0**, npm **11.19.0**

---

## 0. Scope, Non-Goals, Guardrails

**In scope for the Admin Panel (final product):** admin-only login, dashboard, global medicine catalog management (list/search/filter/paginate/create/edit/detail/soft-delete), image upload/replace/remove, activate/deactivate, catalog statistics, logout, secure admin-only access, responsive premium medical SaaS UI.

**Hard non-goals (explicit):**
- No OCR. No AI. No external image-analysis API. No vision/ML dependency of any kind.
- Do not rebuild the existing backend catalog API. The existing `AdminCatalogMedicineController` + `CatalogMedicineResource` + `*Request` classes + `AdminMiddleware` + routes are the contract.
- Never touch user personal medicine data. In this backend those tables do not even exist (`users`, `sessions`, `personal_access_tokens`, `cache`, `jobs`, `catalog_medicines`, `password_reset_tokens` are the only tables). The admin panel writes to exactly one domain table: `catalog_medicines`.
- Do not create a second role system. Reuse `User::ROLE_ADMIN` / `User::isAdmin()` / `AdminMiddleware`.
- The Android contract is frozen: `POST /api/v1/auth/{register,login,logout}`, `GET /api/v1/auth/user`, `GET /api/v1/catalog/medicines` (camelCase, active-only, stable `id` ordering, `data`+`meta` paginator shape) must not change shape or behavior.

**Phase 1 deliverables (this document):** repository inspection, architecture decision, frontend stack decision, authentication approach, route/page/component structure, API integration + image upload strategy, state management, validation, error/loading handling, responsive approach, security model, testing strategy, build/dev strategy, documentation plan, and a prioritized list of pre-existing backend issues that must be fixed before implementation.

---

## 1. Inspection Summary (what was actually read)

| Area | Files inspected |
|---|---|
| Project meta | `composer.json`, `composer.lock` (presence), `package.json`, `vite.config.js`, `.npmrc`, `.env`, `.env.example`, `phpunit.xml`, `README.md`, `BACKEND_ROADMAP.md`, `AGENTS.md`, `CLAUDE.md`, `git log`, `git status` |
| Routing / bootstrap | `routes/api.php`, `routes/web.php`, `routes/console.php`, `bootstrap/app.php`, `php artisan route:list` |
| Auth | `app/Http/Controllers/AuthController.php`, `config/auth.php`, `config/sanctum.php`, `config/session.php`, `app/Console/Commands/MakeAdminCommand.php` |
| Authorization | `app/Http/Middleware/AdminMiddleware.php`, `app/Models/User.php` |
| Catalog domain | `app/Models/CatalogMedicine.php`, `app/Http/Controllers/AdminCatalogMedicineController.php`, `app/Http/Controllers/CatalogMedicineController.php`, `app/Http/Resources/CatalogMedicineResource.php`, all 4 `app/Http/Requests/*` |
| Database | all 7 migrations, `database/factories/*`, `database/seeders/*`, `database/database.sqlite` (existence) |
| Storage / images | `config/filesystems.php`, `storage/app/public/`, `public/storage` symlink, `AdminCatalogMedicineController::storeImage/deleteImage` |
| Tests | `tests/Feature/AuthenticationTest.php`, `tests/Feature/CatalogMedicineTest.php`, `tests/Feature/CatalogMedicineImageTest.php`, `tests/TestCase.php`, `phpunit.xml`, live `php artisan test` run |
| Frontend assets | `resources/views/welcome.blade.php`, `resources/js/app.js` (contents: `//`), `resources/css/app.css`, `public/` (no `build/`, no `node_modules/`, no `package-lock.json`) |
| Vendor internals (to validate assumptions) | `Illuminate\Foundation\Configuration\Middleware` (api group + `statefulApi()`/`apiLimiter` defaults), `Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful`, `SanctumServiceProvider` (`sanctum/csrf-cookie` route registration), `Illuminate\Http\Middleware\HandleCors` |
| Working-tree state | `git status`: modified `app/Http/Controllers/AdminCatalogMedicineController.php`, `app/Http/Controllers/CatalogMedicineController.php`, `bootstrap/app.php`, `composer.json`, `composer.lock`; untracked `config/sanctum.php`, `update_controllers.py`, `update_docs.py`, `update_factory.py`, `update_files.py`, `update_files_phase3.py` |

---

## 2. Current Backend Architecture (as-is)

### 2.1 Runtime & stack
- Laravel **13.33.0** skeleton, PHP `^8.3` (running 8.4.22), SQLite (`DB_CONNECTION=sqlite`, `database/database.sqlite`), `SESSION_DRIVER=database`, `QUEUE_CONNECTION=database`, `CACHE_STORE=database`, `FILESYSTEM_DISK=local`.
- `laravel/sanctum ^4.0` installed; `config/sanctum.php` was published and is **untracked** in git.
- Dev tooling: `laravel/pint`, `phpunit ^12.5`, `laravel/pail`, `laravel/pao`, `nunomaduro/collision`. No Boost/Inertia/Livewire/Alpine.
- `bootstrap/app.php` is the modern slim skeleton: `withRouting(...)`, an **empty** `withMiddleware()` closure, and `shouldRenderJsonWhen(api/* or expectsJson)`.

### 2.2 Authentication (as-is)
- `AuthController`: `register` (forces `ROLE_USER`, ignores any client-supplied `role`), `login` (email+password → `createToken('auth_token')->plainTextToken`, returns `access_token` + `user`), `logout` (`$request->user()->currentAccessToken()->delete()`), `user`.
- **Token-based (bearer) auth only.** There is no session/cookie login path, no `Auth::attempt()`, no `session()->regenerate()`.
- `config/sanctum.php`: `stateful` = `SANCTUM_STATEFUL_DOMAINS` or default `localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1` + app URL; `guard => ['web']`; `expiration => null`.
- `EnsureFrontendRequestsAreStateful` is **not** applied to `api/*`: `Middleware::$statefulApi = false` and `bootstrap/app.php` never calls `statefulApi()`. Framework evidence: `Middleware.php:496` only prepends it when `statefulApi()` is called.
- `sanctum/csrf-cookie` **is** registered (by `SanctumServiceProvider`, with `web` middleware) and appears in `route:list`, but without the stateful api middleware the API requests never carry that session, so SPA cookie auth is non-functional today.
- No `throttle` anywhere: `Middleware::$apiLimiter` is null and no route declares `->middleware('throttle:...')`. Login is unthrottled.
- No `config/cors.php`. CORS falls back to `HandleCors` + framework defaults (`allowed_origins: *`, `supports_credentials: false`), which cannot be used with credentialed cross-origin cookie requests.

### 2.3 Authorization (as-is)
- `User`: `ROLE_USER`/`ROLE_ADMIN` constants, `role` column (default `'USER'`), `isAdmin()`.
- `AdminMiddleware`: returns `403 {"message":"Forbidden."}` unless `$request->user()?->isAdmin()`. Referenced by class in `routes/api.php`; not registered as an alias.
- Defense in depth already present: each `*Request::authorize()` independently checks `$this->user() && $this->user()->isAdmin()`.
- `php artisan make:admin` creates/promotes an admin interactively (`updateOrCreate` by email).

### 2.4 Catalog API (as-is — to be reused, not rebuilt)
| Method | URI | Handler | Middleware |
|---|---|---|---|
| GET | `/api/v1/admin/catalog/medicines` | `index` | `auth:sanctum` + `AdminMiddleware` |
| POST | `/api/v1/admin/catalog/medicines` | `store` | same |
| GET | `/api/v1/admin/catalog/medicines/{medicine}` | `show` | same |
| PUT/PATCH | `/api/v1/admin/catalog/medicines/{medicine}` | `update` | same |
| DELETE | `/api/v1/admin/catalog/medicines/{medicine}` | `destroy` (soft delete) | same |
| PATCH | `/api/v1/admin/catalog/medicines/{medicine}/status` | `status` | same |
| PATCH | `/api/v1/admin/catalog/medicines/{medicine}/image` | `removeImage` | same |
| GET | `/api/v1/admin/test` | closure | same |
| GET | `/api/v1/catalog/medicines` | `CatalogMedicineController@index` (active-only) | `auth:sanctum` |

- `CatalogMedicine`: `SoftDeletes`, fillable `name, generic_name, strength, dosage_form, manufacturer, image_url, is_active`, `is_active` cast to bool, `scopeSearch` on name/generic_name/manufacturer.
- `AdminCatalogMedicineController::index` supports `?search=`, `?is_active=`, `?per_page=` (default 20, capped 100), ordered by `id`.
- `CatalogMedicineResource` returns **camelCase**: `id, name, genericName, strength, dosageForm, manufacturer, imageUrl, isActive, createdAt, updatedAt`; `imageUrl` is the public URL when set (legacy absolute URLs passed through), else `null`. Paginated collections return Laravel's `data` + `meta` + `links`.
- Image pipeline: `store('catalog-medicines','public')` (generated filenames), validation `image, mimes:jpg,jpeg,png,webp, max:5120` (5 MB), `remove_image` and `image` are mutually exclusive (`prohibits:image`), replace/remove deletes the previous file, soft delete keeps the file, SVG rejected, storage on the `public` disk (`storage/app/public/catalog-medicines/`) with `public/storage` symlink already created.
- Image URL building is centralized in `CatalogMedicineResource::imageUrl()` via `Storage::disk('public')->url()` → cloud migration is a config-only change.

### 2.5 Tests (as-is)
- 58 passing / 183 assertions. `AuthenticationTest` (10), `CatalogMedicineTest` (19), `CatalogMedicineImageTest` (21, incl. traversal-filename and soft-delete-keeps-file cases), plus examples.
- Boundary coverage already exists for: USER → 403 on admin routes, anonymous → 401, public registration cannot self-assign ADMIN, public catalog hides inactive/soft-deleted, per-page cap, stable ordering, camelCase contract.
- No coverage for: session/cookie (SPA) auth, login throttling, logout under session auth, admin statistics.

### 2.6 Frontend state (as-is)
- **No application frontend exists.** `resources/js/app.js` is a single comment (`//`); `resources/css/app.css` is the stock Tailwind v4 entry with `@theme` fonts only; the only view is the stock Laravel `welcome.blade.php` (223 lines, Tailwind CDN-style inline fallback).
- Build tooling **is** already scaffolded and consistent with a modern SPA: `vite ^8`, `laravel-vite-plugin ^3.1`, `@tailwindcss/vite ^4`, `tailwindcss ^4`, `concurrently`, `.npmrc` (`ignore-scripts=true`, `audit=true`).
- `node_modules/`, `package-lock.json`, and `public/build/` do **not** exist → no npm install has been run yet.
- No React/Vue/Svelte/Inertia/Livewire/Alpine dependency. No admin views, no `/admin` route, no admin assets.

---

## 3. Architecture Decision

**Decision: build the Admin Panel as a first-party SPA that lives inside the Laravel repo and is served same-origin, talking to the existing `/api/v1/*` JSON API.**

Reasons, grounded in the repository:
1. The backend is already a pure JSON API with a frozen DTO contract (camelCase + paginator `meta`) — a typed SPA can mirror it directly. No Blade server-rendering is needed, so Inertia/Livewire buy nothing here.
2. Same-origin serving (`/admin` shell + `/build-admin/*` assets in `public/`) makes Sanctum's **httpOnly cookie session + CSRF** auth possible with zero CORS/credential exposure. No JWT in `localStorage` (XSS-exfiltratable) is required.
3. Single repository → one deploy, one CI, one `.env`, the PHPUnit suite and the SPA build versioned together.
4. Vite 8 + Tailwind 4 are already installed and wired in `vite.config.js`, so the chosen stack adds a framework, not a new build philosophy.
5. A separate repository/host would force credentialed cross-origin CORS plus duplicated deploy/CI for a single-admin tool — rejected.

**Rejected options (recorded, with reason):**
- *Inertia.js + React/Vue* — requires new backend conventions (`HandleInertiaRequests`, shared props, asset versioning) and couples pages to server routing; the product explicitly wants a decoupled admin SPA against the existing API.
- *Livewire* — not installed; server round-trip model conflicts with the requested premium SPA UX (drawers, optimistic toasts, client-side image previews); would add Tailwind/Mary/Livewire stacks on top of a Tailwind 4 setup.
- *Blade + Alpine only* — no type-safety for the growing catalog/statistics surface; weakest story for reusable table/modal/form components, tests, and dark mode.
- *Separate SPA repo/deployment* — cross-origin cookie auth, CORS allow-list maintenance, duplicated release process for one consumer.

---

## 4. Where Frontend Files Live

Everything stays inside `/Users/shovo/Downloads/MediTrack-Backend`:

```
MediTrack-Backend/
├─ resources/
│  ├─ css/app.css                     # existing (marketing/welcome) — untouched
│  ├─ js/app.js                       # existing empty entry — untouched
│  ├─ views/
│  │  ├─ welcome.blade.php            # existing — untouched
│  │  └─ admin/app.blade.php          # NEW: SPA shell (@vite(..., 'build-admin'))
│  └─ admin/                          # NEW: admin SPA source root (Vite root)
│     ├─ index.html                   # dev entry (dev server only)
│     ├─ main.tsx                     # React bootstrap
│     ├─ styles/admin.css             # Tailwind v4 entry + @theme design tokens
│     ├─ app/
│     │  ├─ AdminApp.tsx              # providers + error boundary
│     │  ├─ router.tsx                # route table
│     │  └─ queryClient.ts            # TanStack Query defaults
│     ├─ features/
│     │  ├─ auth/                     # LoginPage, RequireAdmin, AuthProvider, useSession
│     │  ├─ dashboard/                # DashboardPage, StatCard, useStatistics
│     │  └─ catalog/                  # list / detail / form / image / mutations / zod schemas
│     ├─ components/
│     │  ├─ layout/                   # AdminShell, Sidebar, Topbar, MobileNavDrawer, UserMenu
│     │  └─ ui/                       # Button, IconButton, Input, Textarea, Select, Field,
│     │                               # Switch, Badge, Table, Card, Pagination, SearchInput,
│     │                               # Modal, Drawer, ConfirmDialog, Toast, EmptyState,
│     │                               # ErrorState, Skeleton, Spinner, PageHeader
│     ├─ lib/
│     │  ├─ api/client.ts             # fetch transport: credentials, CSRF, error normalization
│     │  ├─ api/types.ts              # CatalogMedicine, Paginated<T>, ApiError, SessionUser
│     │  ├─ api/adminApi.ts           # typed endpoint functions
│     │  ├─ api/queryKeys.ts          # query key factory
│     │  └─ utils/                    # cn(), formatDate(), formatBytes(), isImageFile()
│     └─ test/                        # Vitest setup + MSW server + test utils
├─ vite.admin.config.js               # NEW: second Vite config (separate build dir/hot file)
├─ package.json                       # MODIFY (planned): add deps + dev:admin/build:admin/test:admin scripts
├─ .gitignore                         # MODIFY (planned): ignore public/hot-admin, coverage
└─ .env / .env.example                # MODIFY (planned): SANCTUM_STATEFUL_DOMAINS
```

Serving model:
- Production: SPA shell route `GET /admin/{any?}` → `resources/views/admin/app.blade.php`, which loads the built entry via `@vite('resources/admin/main.tsx', 'build-admin')` → hashed assets under `public/build-admin/assets/*` served as static files at `/build-admin/*` (deliberately not `/admin/*`, so asset paths can never collide with the SPA shell route).
- Dev: two Vite servers (the existing one, plus the admin one on **port 5174**) with a `/api`, `/sanctum`, `/storage` proxy to `http://127.0.0.1:8000`. The proxy keeps browser requests same-origin, which is the simplest correct way to exercise cookie auth locally.

---

## 5. Authentication Approach (Sanctum SPA, cookie-based)

**Recommendation: Sanctum first-party SPA authentication (httpOnly session cookie + CSRF), used only by the admin panel. The Android app continues using bearer tokens unchanged.**

Flow:
1. `GET /sanctum/csrf-cookie` (204, sets `XSRF-TOKEN` + session cookie) — called once at app boot and again after any `419`.
2. `POST /api/v1/admin/auth/login` (new, stateful, throttled, admin-only): `Auth::guard('web')->attempt(['email','password'])` → verify `isAdmin()` (otherwise `Auth::logout()` + `422/403` with a generic message) → `$request->session()->regenerate()` → return the admin user payload.
3. All admin API calls send `credentials: 'include'`, `Accept: application/json`, `X-Requested-With: XMLHttpRequest`, and `X-XSRF-TOKEN` (read from the `XSRF-TOKEN` cookie) on mutating verbs.
4. `GET /api/v1/admin/auth/user` (or the existing `/api/v1/auth/user`) restores the session on hard refresh; `403` ⇒ clear client session and redirect to login.
5. `POST /api/v1/admin/auth/logout`: `Auth::guard('web')->logout()`, `session()->invalidate()`, `session()->regenerateToken()`, and a null-safe `currentAccessToken()?->delete()` so the same endpoint is safe under both session and token auth.

Backend enablement this requires (all in the fix-list, §21):
- `bootstrap/app.php`: `->withMiddleware(fn (Middleware $m) => $m->statefulApi())` so `EnsureFrontendRequestsAreStateful` joins the `api` group (`Middleware.php:496`).
- `SANCTUM_STATEFUL_DOMAINS` must include `localhost:5174` (dev SPA) and the production admin host; `SESSION_DOMAIN`, `SESSION_SAME_SITE=lax`, `SESSION_SECURE_COOKIE=true` (prod).
- `config/cors.php` with `supports_credentials => true` and an explicit origin allow-list — required whenever the SPA is not same-origin (staging/preview hosts).
- Null-safe `AuthController::logout` fix (see B3).

**Why not bearer tokens in `localStorage` for the admin panel:** any XSS becomes full admin takeover; long-lived tokens cannot be revoked cheaply. The existing token flow stays for the mobile client, which has no cookie jar and cannot do CSRF.

**Why not a separate admin guard/provider:** one `users` table, one `role` column, one `web` guard. Adding a parallel guard would violate "do not create a second incompatible role system".

**Session hardening:** `SESSION_LIFETIME=120` already set; on login `session()->regenerate()` (fixation), on logout `invalidate()` + `regenerateToken()`; admin login throttled (e.g. named limiter `admin-login`: 5/min per email+IP, on top of a broader `throttle:api`); generic "Invalid credentials." for both wrong-password and non-admin so the endpoint does not confirm account roles.

---

## 6. Admin Authorization Model

Layers (all must hold; the SPA guard is the *last*, never the only, line):

1. **Route middleware** — every admin API route stays inside `Route::middleware('auth:sanctum')` + `AdminMiddleware` (reused unchanged).
2. **FormRequest `authorize()`** — already returns `isAdmin()`; kept on all four request classes.
3. **Model/domain** — `User::isAdmin()`/`ROLE_ADMIN` is the single source of truth; no new roles, no new table.
4. **Client guard** — `RequireAdmin` redirects anonymous users to `/admin/login` and shows a 403 screen for authenticated non-admins; purely UX.
5. **Shell route** — `GET /admin/{any?}` renders the SPA shell publicly (so the login page is reachable) and contains **no** data. All data comes from guarded API calls, so the HTML being reachable leaks nothing.
6. **Planned hardening** — the `/api/v1/admin/test` closure route is a debug endpoint that stays behind the same middleware but should be disabled when `APP_ENV=production`; consider an `abort(404)`/feature flag rather than removal (three existing tests depend on it).

Optional developer convenience (documented, not a security boundary): `AdminMiddleware` registration as an alias (`$middleware->alias(['admin' => AdminMiddleware::class])`) so future `web`-group admin routes read `->middleware('admin')`; behavior unchanged.

---

## 7. Route Structure

### 7.1 Backend (planned)

```php
// routes/web.php  — SPA shell (public, data-free)
Route::get('/admin/{any?}', fn () => view('admin.app'))->where('any', '.*')->name('admin.shell');

// routes/api.php
Route::prefix('v1')->group(function () {
    // FROZEN — Android contract, do not modify
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login',    [AuthController::class, 'login']);

    // NEW — admin web session auth (stateful api group, throttled, admin-only)
    Route::post('/admin/auth/login',  [AdminAuthController::class, 'login'])->middleware('throttle:admin-login');
    Route::post('/admin/auth/logout', [AdminAuthController::class, 'logout'])->middleware('auth:sanctum');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);   // FROZEN (null-safe fix only)
        Route::get('/auth/user',    [AuthController::class, 'user']);     // FROZEN
        Route::get('/catalog/medicines', [CatalogMedicineController::class, 'index']); // FROZEN (Android)

        Route::middleware(AdminMiddleware::class)->group(function () {
            // NEW (Phase 2E) — dashboard statistics
            Route::get('/admin/catalog/statistics', [AdminCatalogStatisticsController::class, 'index']);

            // EXISTING — reused verbatim
            Route::apiResource('admin/catalog/medicines', AdminCatalogMedicineController::class)
                ->parameters(['medicines' => 'medicine']);
            Route::patch('admin/catalog/medicines/{medicine}/status', [AdminCatalogMedicineController::class, 'status']);
            Route::patch('admin/catalog/medicines/{medicine}/image',  [AdminCatalogMedicineController::class, 'removeImage']);
        });
    });
});
```

No existing route is renamed, moved, or removed. The only structural addition to `routes/api.php` is the `admin/auth/*` pair plus the statistics route.

### 7.2 Frontend (planned)

| Path | Screen | Guard |
|---|---|---|
| `/admin/login` | Admin login | redirect to dashboard if already admin |
| `/admin` | Dashboard (statistics cards + recent catalog activity) | `RequireAdmin` |
| `/admin/catalog` | Catalog list (search, status filter, pagination, row actions) | `RequireAdmin` |
| `/admin/catalog/new` | Add medicine (full page on desktop, drawer on mobile) | `RequireAdmin` |
| `/admin/catalog/:id` | Medicine detail | `RequireAdmin` |
| `/admin/catalog/:id/edit` | Edit medicine + image management | `RequireAdmin` |
| `/admin/settings` (later) | Placeholder/account info | `RequireAdmin` |
| `*` | 404 within the admin shell | — |

List state (`page`, `per_page`, `search`, `is_active`) lives in the URL query string so links are shareable, the back button works, and tests can drive the list without touching component internals.

---

## 8. Page Structure

- **LoginPage** — centered card, `MediTrack Admin` brand lockup, medical-blue gradient/soft-gray background, email + password fields, inline validation, submit spinner, generic error alert, `aria-live` error region, no "register" or "forgot password" links (admin accounts are provisioned by `php artisan make:admin`).
- **DashboardPage** — 3–4 stat cards (`total`, `active`, `inactive`, `with image`, `soft-deleted` if exposed), plus shortcuts to "Add medicine" and the catalog list. Data from the new statistics endpoint (Phase 2E); until then it renders the list-derived counts.
- **CatalogListPage** — page header with primary "Add medicine" action; toolbar (debounced search input, status filter segmented control, per-page select, refresh); responsive data table (desktop) / stacked cards (mobile) with columns *Image thumbnail, Name, Generic name, Strength, Form, Manufacturer, Status badge, Updated, Actions*; row actions *(View, Edit, Activate/Deactivate, Remove image when present, Delete)*; pagination footer with page count; skeleton/empty/error states.
- **MedicineDetailPage** — read-only summary card with image, all catalog fields, timestamps, status badge, inline actions.
- **MedicineFormPage (create/edit)** — sections: *Identity* (name, generic name), *Dosage* (strength, dosage form), *Manufacturer*, *Image* (upload / replace / remove + preview), *Status* (active switch). Sticky action bar (Cancel / Save), dirty-state guard on navigation.
- **NotAuthorizedPage / NotFoundPage** — explicit, non-leaky, with a "Back to dashboard"/"Sign out" action.

---

## 9. Component Architecture

Two tiers, both new:

- **`components/ui/` — primitives (dumb, accessible, no API knowledge):** `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Field` (label + hint + error wiring), `Switch`, `Badge`, `Card`, `Table` (`Table`, `Head`, `Body`, `Row`, `Cell`), `Pagination`, `SearchInput`, `Modal`, `Drawer`, `ConfirmDialog`, `Toast`/`toaster`, `EmptyState`, `ErrorState`, `Skeleton`, `Spinner`, `PageHeader`, `Avatar`. Built on Tailwind 4 tokens + Headless UI for dialogs/listbox/switch semantics (focus trap, `Esc`, `aria-modal`, roving focus).
- **`components/layout/` — `AdminShell`** = `Sidebar` (fixed, collapsible under `lg`, drawer under `md`) + `Topbar` (page title, admin menu, theme toggle, sign out) + skip-link + content slot.
- **`features/*` — screen-level composition** owning query/mutation hooks and forms; features never reach into each other, shared pieces are promoted to `components/`.

Conventions: named exports, one component per file, props typed with explicit interfaces, no default exports except route modules, `data-testid` only where an accessible query is impractical, all interactive elements keyboard-reachable, images use explicit `width`/`height`/`loading="lazy"` + placeholder fallback.

---

## 10. State Management Strategy

- **Server state → TanStack Query v5.** Query keys: `['admin','session']`, `['admin','medicines',{page,perPage,search,isActive}]`, `['admin','medicine',id]`, `['admin','statistics']`. Mutations invalidate the list prefix + the affected detail, and the list keeps the previous page data while refetching (`placeholderData: keepPreviousData`) so pagination does not flash.
- **Auth state → one small `AuthProvider`** holding the session user (a TanStack Query of `/admin/auth/user`) exposed via `useSession()`; no separate global store.
- **UI state → URL** for list filters/pagination (React Router search params), local `useState` for dialogs/drawers/forms.
- **No Redux/Zustand/MobX.** An external store would duplicate Query's cache for zero benefit at this surface size.
- Derived data (`hasImage`, `isFiltered`, status label/count) via plain functions/memos; no derived state stored.

---

## 11. API Service Structure

`lib/api/client.ts` — one transport, no component ever calls `fetch` directly:
- Base URL from `import.meta.env.VITE_ADMIN_API_BASE_URL` (default `/api/v1`).
- `credentials: 'include'`, `Accept: application/json`, `X-Requested-With: XMLHttpRequest`.
- `ensureCsrfCookie()` (memoized, re-run after `419`), attaches `X-XSRF-TOKEN` on non-GET.
- JSON and `FormData` bodies (never sets `Content-Type` manually for `FormData`).
- Throws a normalized `ApiError { status, message, errors?: Record<string,string[]> }`.
- `401 → signOutLocally() + redirect`, `403 → NotAuthorized`, `419 → single CSRF retry`, `422 → field errors`, `413 → "file too large"` message, `5xx → toast + retry`.

`lib/api/adminApi.ts` — typed functions over the existing contract:

| Function | Call |
|---|---|
| `getSession()` | `GET /auth/user` |
| `login(email,password)` | `POST /admin/auth/login` |
| `logout()` | `POST /admin/auth/logout` |
| `listMedicines({page,perPage,search,isActive})` | `GET /admin/catalog/medicines?...` |
| `getMedicine(id)` | `GET /admin/catalog/medicines/{id}` |
| `createMedicine(payload)` | `POST /admin/catalog/medicines` (JSON or multipart) |
| `updateMedicine(id,payload)` | `POST /admin/catalog/medicines/{id}` with `_method=PUT` when multipart, else `PUT` |
| `setMedicineStatus(id,isActive)` | `PATCH /admin/catalog/medicines/{id}/status` |
| `removeMedicineImage(id)` | `PATCH /admin/catalog/medicines/{id}/image` `{remove_image:true}` |
| `deleteMedicine(id)` | `DELETE /admin/catalog/medicines/{id}` |
| `getStatistics()` | `GET /admin/catalog/statistics` (new, Phase 2E) |

`lib/api/types.ts` — hand-written types mirroring `CatalogMedicineResource` exactly (`genericName`, `dosageForm`, `imageUrl`, `isActive`, `createdAt`, `updatedAt`) plus `Paginated<T>` = `{ data: T[]; meta: { current_page; last_page; per_page; total }; links }`, and `ValidationErrors` for 422 payloads. A single camelCase contract type shared by all features.

---

## 12. Catalog CRUD Flow

| Action | UI | Request | Response handling |
|---|---|---|---|
| List | toolbar + table | `GET /admin/catalog/medicines?page&per_page&search&is_active` | fill table; `meta.total/last_page` drive pagination |
| Search | 300 ms debounce → URL param (`replace:true`) → query | same + `search` | reset to `page=1` |
| Filter | segmented `All / Active / Inactive` → `is_active=true|false` | same + `is_active` | reset to `page=1` |
| Detail | row click / View | `GET .../{id}` | summary card |
| Create | form page/drawer | `POST .../medicines` (multipart if an image is attached) | 201 → toast, invalidate list, route to the new detail page |
| Edit | form pre-filled from detail | `PUT .../{id}` (multipart ⇒ `POST .../{id}` + `_method=PUT`) | 200 → toast, invalidate list + detail |
| Toggle status | row action (optimistic) | `PATCH .../{id}/status` `{is_active}` | 200 → reconcile cache; rollback + toast on error |
| Remove image | confirm dialog | `PATCH .../{id}/image` `{remove_image:true}` | 200 → `imageUrl = null` |
| Delete | `ConfirmDialog` naming the medicine | `DELETE .../{id}` | 200 → toast, invalidate list; note this is a **soft delete** and its image file is intentionally retained |

UX rules: destructive actions always confirm and state the consequence; the same mutation is never fired twice (button disabled while `isPending`); after any successful mutation the list is invalidated (never hand-patched except for the optimistic status toggle).

---

## 13. Image Upload Flow

Requirements already enforced server-side and re-checked client-side: **JPG/JPEG/PNG/WEBP, ≤ 5 MB, no OCR/AI/external analysis, existing `public` disk reused.**

1. **Pick** — drag-and-drop zone + file input (`accept="image/jpeg,image/png,image/webp"`), plus camera capture on mobile where the OS supports it.
2. **Validate client-side (UX only)** — extension/MIME allow-list, `size <= 5 * 1024 * 1024`, reject SVG explicitly with a clear message; oversized files are blocked *before* upload so users never hit a `413`.
3. **Preview** — `URL.createObjectURL()` for instant feedback (revoked on replace/unmount), with the server `imageUrl` shown when editing an existing medicine; placeholder tile when none.
4. **Upload** — `FormData { name, generic_name?, strength?, dosage_form?, manufacturer?, is_active, image? }`; on update: `POST /api/v1/admin/catalog/medicines/{id}` with `_method=PUT` (PHP only populates `$_FILES` for POST bodies, so multipart must be spoofed — this is the key implementation detail for image editing), or a plain JSON `PUT` when no file is attached.
5. **Replace** — send a new `image`; the server writes a new file and deletes the old one; the UI swaps to the returned `imageUrl`.
6. **Remove** — never send `image` together with `remove_image` (the backend returns 422 via `prohibits:image`); the "Remove image" action goes through `PATCH .../{id}/image` and asks for confirmation.
7. **Progress & errors** — `XMLHttpRequest`/`fetch` upload progress bar, submit disabled while uploading, per-field errors from a 422 rendered under the image field, `413` explained as "file exceeds the server limit", network failure keeps the form state so the user can retry without re-entering data.
8. **Never** store image binaries in the SPA state beyond the object URL; the canonical value is always the server-returned `imageUrl`.

---

## 14. Validation

- **Zod schemas mirroring the backend requests** (`catalogMedicineSchema`, `imageFileSchema`, `loginSchema`) as the single client-side source of truth, consumed by React Hook Form via `@hookform/resolvers/zod`.
- Field parity with `StoreCatalogMedicineRequest`/`UpdateCatalogMedicineRequest`: `name` required ≤255; `generic_name`/`manufacturer` nullable ≤255; `strength`/`dosage_form` nullable ≤100; `image` mimes+size; `is_active` boolean; `remove_image` mutually exclusive with `image`.
- **The backend remains authoritative.** Client validation is UX only; every `422` payload is mapped back with `setError(field, …)` so server-only rules (uniqueness, mime sniffing, size) surface in the same place as client rules.
- Trim whitespace, treat empty strings as `null` for optional fields, and normalize `is_active` to a real boolean before sending.

---

## 15. Error & Loading Handling

| Condition | Behavior |
|---|---|
| Initial load | skeleton rows (list), skeleton cards (dashboard), inline spinners for mutations |
| Empty (no rows) | `EmptyState` with "Add your first medicine" CTA |
| Empty (filters applied) | `EmptyState` with "Clear filters" |
| 401 | clear session query → redirect `/admin/login` with a "session expired" notice |
| 403 | `NotAuthorizedPage` in the shell + session cleared (never silently ignored) |
| 404 | not-found screen (deleted/soft-deleted medicine) |
| 419 CSRF | transparent single retry after re-fetching `/sanctum/csrf-cookie`; second failure → sign out |
| 422 | inline field errors + focus moved to the first invalid field |
| 413 | dedicated "file too large" message on the image field |
| 429 | "Too many attempts, try again shortly" with the retry hint |
| 5xx | toast with a Retry action; the list keeps previous data |
| network/offline | non-blocking banner + retry; forms keep their input |
| unexpected render error | app-level error boundary with a reload action |

Toasts (success/error) via one `Toast` primitive with `role="status"`/`aria-live`; every async surface has an explicit loading/empty/error triple — no bare spinners over stale content.

---

## 16. Responsive & Visual Design Approach

- **Tailwind 4 mobile-first** with a small design-token layer in `resources/admin/styles/admin.css` using `@theme`: medical navy/blue ramp (`--color-brand-50…900`, primary `#1D4ED8`-class blue + deep navy `#0B1B3A`-class surface), semantic tokens for surface/border/muted/danger/success/warning, radii, and shadows. No ad-hoc hex in components.
- **Breakpoints:** `< md` (mobile) — single column, table becomes card list, sidebar becomes a full-height drawer, forms become full-screen sheets; `md–lg` (tablet) — collapsed icon rail sidebar, two-column form sections; `≥ lg` (desktop) — fixed sidebar, data table, modal dialogs.
- **Dark mode:** class-based `dark` on `<html>`, initialized from `prefers-color-scheme` and persisted in `localStorage`, respecting `color-scheme` for native controls and re-checking contrast on all tokens.
- **Accessibility:** WCAG AA contrast, visible `focus-visible` rings, full keyboard operation (including dialog focus trap and `Esc`), labels tied to inputs, `aria-live` for toasts/validation summaries, ≥44px touch targets, `prefers-reduced-motion` honored, semantic table markup with scope'd headers, images with meaningful `alt` (medicine name) or `alt=""` when decorative.
- **Perceived quality:** stable layout during load (skeletons matching final row height), no layout shift from images (fixed aspect box), toasts that stack and auto-dismiss, optimistic status toggles, `keepPreviousData` on page changes.

---

## 17. Security Model

1. **Backend is the boundary.** Three independent server-side checks on every admin operation (route `auth:sanctum`, `AdminMiddleware`, FormRequest `authorize()`); the SPA route guard is cosmetic and never trusted.
2. **No admin API exposure:** `admin/*` routes stay nested inside the authenticated + admin middleware groups; no new public route returns catalog mutation data.
3. **Session cookies only for web:** `httpOnly`, `sameSite=lax`, `secure` in production, `SESSION_DOMAIN` set, `session()->regenerate()` on login (fixation), `invalidate()` + `regenerateToken()` on logout. No tokens in `localStorage`/`sessionStorage`.
4. **CSRF:** `XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header on every mutating request; `419` handled explicitly.
5. **Admin-only login:** non-admin credentials are rejected and the session is destroyed; the error is generic so the endpoint does not disclose which accounts are admins.
6. **Brute force:** named rate limiter on `admin/auth/login` (email+IP keyed, 5/min) plus a broader API limiter once `apiLimiter` is configured; existing unthrottled `auth/login` gets a limiter too (see B4).
7. **CORS:** explicit origin allow-list with `supports_credentials => true`; never `*` + credentials. Same-origin serving is preferred so CORS is a non-issue in the primary deployment.
8. **Uploads:** server-side `image` + `mimes:jpg,jpeg,png,webp` + `max:5120`, server-generated filenames (verified in `test_stored_files_use_generated_unique_filenames`), SVG rejected, `is_url`-style passthrough limited to read-only rendering. In production, deny PHP execution under `storage/` and prefer `APP_DEBUG=false`.
9. **Least privilege / no RBAC creep:** only `ROLE_ADMIN` gates the panel; a future editor role is out of scope and must not be invented ad hoc.
10. **Blast-radius containment:** the panel only ever issues requests against `/admin/*` catalog endpoints; it has no access path to user/schedule/dose data (which the backend does not store).
11. **Auditability (future phase):** log admin catalog mutations (actor, action, subject, diff) via a Laravel event listener; recorded here as a known gap, not implemented now.
12. **XSS hygiene:** no `dangerouslySetInnerHTML`, render server strings as text, and only render `imageUrl` values through `<img src>` (no `javascript:`/`data:` URLs — validated by the backend `url` rule for the legacy column).

---

## 18. Testing Strategy

**Backend (PHPUnit — extends the existing 58-test suite):**
- `AdminSessionAuthenticationTest` (new): admin session login succeeds; USER credentials rejected and no session established; inactive/nonexistent admin rejected generically; login throttling returns `429` after N attempts; `GET /sanctum/csrf-cookie` sets the token cookie; `admin/auth/user` returns the admin; logout invalidates the session (subsequent admin call → `401`); anonymous admin API access still `401`; USER still `403` on every admin route (regression guard).
- `CatalogStatisticsTest` (new, Phase 2E): counts for total/active/inactive/with-image, excludes soft-deleted, `403` for USER, `401` anonymous.
- Existing `AuthenticationTest`, `CatalogMedicineTest`, `CatalogMedicineImageTest` must stay green — proof that the stateful change and the logout fix did not break the mobile token contract. **Gate: full `php artisan test` green after every backend step.**

**Frontend (Vitest + React Testing Library + MSW):**
- `client.ts`: CSRF bootstrap happens once and is retried on `419`; `credentials`/headers set; `422` → typed field errors; `401`/`403` trigger the right side effects.
- `adminApi.ts`: request shape per endpoint, including `_method=PUT` for multipart updates and `remove_image` exclusivity.
- Forms: zod schema parity (name required, max lengths, size/type rejection for images), server-422 mapping into field errors.
- `CatalogListPage`: renders skeleton → rows; search debounce updates the URL and issues one request; pagination increments `page`; empty and error states render; status toggle mutation invalidates the list.
- `RequireAdmin`: anonymous → redirect to `/admin/login`; non-admin → `NotAuthorizedPage`; admin → renders shell.
- Image component: rejects SVG and >5 MB locally and shows a preview for accepted files (object-URL mock).
- `tsc --noEmit` typecheck + `npm run build:admin` as CI gates.

**End-to-end (optional, later phase):** Playwright against a seeded SQLite DB (`php artisan migrate:fresh --seed` + `make:admin` via a non-interactive flag) covering login → create medicine with image → edit → deactivate → delete → logout; plus a keyboard-only pass and an axe scan.

---

## 19. Build / Dev / Run Commands

```bash
# ---------- backend ----------
cd /Users/shovo/Downloads/MediTrack-Backend
composer install
php artisan migrate                 # SQLite already present
php artisan db:seed                 # optional demo catalog rows
php artisan storage:link            # already created locally
php artisan make:admin              # creates/promotes an ADMIN user
php artisan serve                   # http://127.0.0.1:8000
php artisan test                    # baseline: 58 passed / 183 assertions

# ---------- admin frontend ----------
npm install                         # node_modules/ does not exist yet
npm run dev:admin                   # vite --config vite.admin.config.js  → http://localhost:5174/admin
npm run build:admin                 # vite build --config vite.admin.config.js → public/build-admin
npm run typecheck:admin             # tsc --noEmit
npm run test:admin                  # vitest run
```

Planned `package.json` script additions and their behavior:
- `"dev:admin": "vite --config vite.admin.config.js"`
- `"build:admin": "vite build --config vite.admin.config.js"`
- `"typecheck:admin": "tsc --noEmit -p resources/admin/tsconfig.json"`
- `"test:admin": "vitest run --config vite.admin.config.js"`
- `"lint:admin": "eslint resources/admin"`
- existing `"dev"`/`"build"` (marketing/welcome build) remain unchanged.

`vite.admin.config.js` essentials: `root: 'resources/admin'`, `plugins: [laravel({ input: 'resources/admin/main.tsx', buildDirectory: 'build-admin', hotFile: 'build-admin/hot', refresh: false }), react(), tailwindcss()]`, mode-conditional `base: '/build-admin/'` (build) vs `/` (dev), `server: { port: 5174, proxy: { '/api': 'http://127.0.0.1:8000', '/sanctum': 'http://127.0.0.1:8000', '/storage': 'http://127.0.0.1:8000' } }`, `build.outDir: '../../public/build-admin'`, `resolve.alias { '@': resources/admin }`.

Local development gotcha to document: use `http://localhost:5174` and `http://127.0.0.1:8000` consistently (or add both to `SANCTUM_STATEFUL_DOMAINS`), otherwise the session cookie is scoped to a different host and login appears to silently fail.

---

## 20. Documentation Plan

| File | Change |
|---|---|
| `ADMIN_PANEL_ARCHITECTURE.md` (NEW, backend root) | SPA architecture, directory map, auth flow diagram, route tables, API contract table, image rules, state/validation strategy, security model, testing strategy |
| `README.md` (UPDATE) | Admin panel setup/run (`npm install`, `dev:admin`, `build:admin`), admin login flow, `SANCTUM_STATEFUL_DOMAINS`, new `admin/auth/*` endpoints, storage notes |
| `BACKEND_ROADMAP.md` (UPDATE) | Mark item 3 "Admin authentication" complete; add admin-panel phases; keep "Production security" in scope |
| `implementation_plan_admin_panel_phase1.md` (THIS FILE) | Phase 1 deliverable (planning only) |
| `.env.example` (UPDATE) | `SANCTUM_STATEFUL_DOMAINS`, `SESSION_DOMAIN`, `SESSION_SAME_SITE`, `SESSION_SECURE_COOKIE`, `VITE_ADMIN_API_BASE_URL` |
| `AGENTS.md` / `CLAUDE.md` | Keep Laravel Boost guidance (note: Boost is not installed — see B11) and add the admin-panel conventions once built |

Android-side docs (`/Users/shovo/Downloads/MediTrack/PROJECT_ARCHITECTURE.md`, `MEDICINE_CATALOG_ARCHITECTURE.md`) stay untouched: the mobile contract does not change.

---

## 21. Existing Backend Issues That MUST Be Fixed Before/During Admin Panel Implementation

Not fixed in Phase 1 — this is the ordered fix list with proposed (unimplemented) remedies.

| # | Issue | Evidence | Severity | Proposed fix |
|---|---|---|---|---|
| **B1** | Sanctum stateful SPA middleware is not applied to `api/*`, so cookie-session auth cannot work; `/sanctum/csrf-cookie` sets a cookie the API requests never use. | `bootstrap/app.php` has an empty `withMiddleware()`; `Middleware::$statefulApi = false` and `Middleware.php:496` only prepends `EnsureFrontendRequestsAreStateful` when `statefulApi()` is called. | **Blocker** | Call `$middleware->statefulApi()` in `bootstrap/app.php`; verify Android bearer flow is unaffected (no `Origin`/`Referer` header from OkHttp ⇒ not treated as frontend). |
| **B2** | No `SANCTUM_STATEFUL_DOMAINS` (and no Vite port) configured anywhere; default list lacks the admin dev origin. | `.env`/`.env.example` have no such key; `config/sanctum.php` default list is `localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1`. | **Blocker** | Add `SANCTUM_STATEFUL_DOMAINS` (+ `SESSION_DOMAIN`) to `.env` and `.env.example`, including `localhost:5174` for dev. |
| **B3** | `AuthController::logout()` calls `$request->user()->currentAccessToken()->delete()` → **`Call to a member function delete() on null` (500)** under session/cookie auth. | `app/Http/Controllers/AuthController.php` logout body; `currentAccessToken()` is null for `web` guard sessions. | **Blocker** | Null-safe: delete the token only when present, use `Auth::guard('web')->logout()` + `session()->invalidate()` + `regenerateToken()` when a session exists. Keep the token path intact for Android. |
| **B4** | No rate limiting on any authentication endpoint; the `api` group has no `throttle` (default `apiLimiter` is null) and no route declares one. | `Middleware.php:497`; `routes/api.php` has no `throttle` middleware. | **Blocker (security)** | Add a named limiter (`RateLimiter::for('admin-login', …)`, email+IP, 5/min) and apply it to `admin/auth/login`; add a broader limiter to `auth/login`/`auth/register` without changing their responses. |
| **B5** | There is no admin-only login path, and the existing `auth/login` issues a valid token to any USER. If the SPA reused it, a normal user could obtain an admin session token and then be bounced by `403` at best. | `AuthController::login` has no `isAdmin()` check and returns `access_token` for every role. | **Blocker (design)** | Add `AdminAuthController::login` (session-based, `isAdmin()` gate, generic error, throttled). Leave the mobile token endpoint untouched. |
| **B6** | `catalog_medicines.image_url` is `string` (→ `varchar(255)`) while validation allows `image_url` up to **1024** chars, and either request accepts a client-supplied `image_url`, bypassing the upload pipeline. | Migration `..._create_catalog_medicines_table.php` (`string('image_url')`) vs `Store/UpdateCatalogMedicineRequest` (`'image_url' => 'nullable|url|max:1024'`). | **High** | Decide one: (a) migrate the column to `text` (recommended for legacy external URLs), or (b) drop `image_url` from admin write payloads and tighten the rule to ≤255. The admin SPA will never send `image_url` (images only via multipart), which makes (b) viable without data migration risk. |
| **B7** | Working tree is dirty: Phase 3/4 edits to `AdminCatalogMedicineController`, `CatalogMedicineController`, `bootstrap/app.php`, `composer.json/lock` are uncommitted, and `config/sanctum.php` plus six one-off Python rewrite scripts are untracked. | `git status` output; `update_*.py` scripts hard-code absolute `/Users/shovo/Downloads/...` paths. | **Blocker (process)** | Commit the intended Phase 3/4/5 state (including the published `config/sanctum.php`) as a clean baseline and delete the throwaway `update_*.py` scripts before starting the admin panel, so admin changes are reviewable in isolation. |
| **B8** | `config/cors.php` does not exist, so CORS uses framework defaults (`allowed_origins: *`, `supports_credentials: false`). | `ls config` (no `cors.php`); `HandleCors` reads `config('cors', [])`. | **High** | Publish `config/cors.php` with an explicit origin allow-list, `paths: ['api/*','sanctum/csrf-cookie']`, `supports_credentials: true` — required for non-same-origin staging/preview/production hosts. |
| **B9** | `AdminMiddleware` is referenced by class only and is not registered as an alias. | `routes/api.php` uses `AdminMiddleware::class`; `bootstrap/app.php` has no `alias()`. | Low | Register the alias when the web-side shell/alias is introduced; behavior unchanged. |
| **B10** | No dashboard statistics endpoint exists (needed for the required "basic catalog statistics" dashboard). | `routes/api.php` has only the catalog CRUD + `admin/test`. | Medium (Phase 2E, not a blocker) | Add `GET /api/v1/admin/catalog/statistics` returning total/active/inactive/with-image/soft-deleted counts, inside the same middleware group, with tests. |
| **B11** | `AGENTS.md`/`CLAUDE.md` instruct installing Laravel Boost, which is not installed (duplicated file content). | `AGENTS.md` == `CLAUDE.md`; `composer.json` has no `laravel/boost`; `vendor/` has none. | Low (DX only) | Either install Boost (dev-only) or trim the bootstrap instructions so the guidance matches reality. |
| **B12** | `/api/v1/admin/test` is a debug endpoint that would ship to production. | `routes/api.php:22`. | Low | Keep (three tests depend on it) but gate it behind `APP_ENV !== 'production'`. |
| **B13** | Frontend deps/tooling for the chosen stack are not installed (`node_modules`, lockfile, test deps, React/Vitest all absent); `public/build` does not exist. | `ls node_modules` → missing; `package.json` has only Vite/Tailwind; no `package-lock.json`. | Expected, not a defect | Add the React/TS/Tailwind/test dependency set + scripts; commit the lockfile. |
| **B14** | Admin-side `.gitignore` gaps for the new artifacts. | `.gitignore` covers the stock Laravel set only. | Low | Ignore `public/hot-admin`, `public/build-admin`, `coverage/`. |
| **B15** | `make:admin` is interactive-only, which blocks scripted/E2E admin provisioning. | `MakeAdminCommand` uses `ask`/`secret` with no options. | Low (Phase 4/E2E) | Add `--name= --email= --password=` options while keeping the interactive path the tests use. |

**Nothing above is fixed in this phase.**

---

## 22. Phased Implementation Roadmap (proposed, not started)

**Phase 2A — Backend enablement (smallest safe changes first).**
B7 baseline commit → B1 `statefulApi()` → B2 env/stateful domains → B3 null-safe logout → B5 `AdminAuthController` → B4 throttling → B8 CORS → B6 `image_url` decision.
*Gate:* existing 58 tests still green + new `AdminSessionAuthenticationTest` green; manual `curl`/browser check that a second admin request is authenticated by cookie.

**Phase 2B — Frontend foundation.**
Dependencies + `vite.admin.config.js` + TS config → Tailwind token layer → `AdminShell` (sidebar/topbar/responsive drawer) → router + `RequireAdmin` → `api/client.ts` + session + LoginPage.
*Gate:* `npm run typecheck:admin`, `npm run build:admin`, and a real login/logout round-trip in the browser (cookie + CSRF verified in devtools).

**Phase 2C — Catalog list.**
Table/card list, debounced search, status filter, pagination (URL-driven), loading/empty/error states, status toggle (optimistic), delete confirmation.
*Gate:* RTL+MSW tests for list/search/pagination/empty/error; manual pass at 3 breakpoints.

**Phase 2D — Catalog create/edit + images.**
✅ DONE — Form pages (`/admin/catalog/new`, `/admin/catalog/:medicineId/edit`), zod validation mirroring
the server rules, 422 field mapping, image picker (browse + drag-and-drop, JPG/PNG/WEBP, 5 MB) with
live previews, replace-on-save, dedicated remove-image dialogue (`PATCH …/{id}/image`), dirty-state
guard via `useBlocker`, 401/403/429/500/network/submit error handling, mobile single-column layout.
*Gate:* 23 form tests + updated list tests (79 admin tests total), typecheck, production build, and a
real-Chrome pass covering all 25 checklist items (incl. over-5 MB/SVG-style rejection, image
replace/remove cancel+confirm, unsaved-changes Stay/Leave, mobile 390px, server 422 contract).

**Phase 2E — Dashboard + polish.**
✅ DONE — Real `/admin` dashboard driven by one new `GET /api/v1/admin/dashboard/stats`
(`AdminDashboardController`, inside the existing AdminMiddleware group): total/active/inactive
whole-catalog counts + top-5 recently updated; three `StatCard`s, quick actions (Add Medicine / View
Catalog), Recently-updated list reusing catalog UI atoms; skeleton grid + per-status scoped error
states (401 clears session → login, 403, 429 retry-after, 5xx, network); dashboard query auto-invalidated
on every catalog mutation. Dark mode (light/dark/system) via `ThemeProvider` (localStorage
`meditrack-admin-theme`, system default, matchMedia listener, FOUC inline guard in `app.blade.php`,
`color-scheme` in `admin.css`), Topbar theme menu, dark variants across alerts/inputs/fields/nav/
auth pages/dialogs/status badges/row actions/image picker (brand-900 fallbacks — no brand-950 token).
*Gate:* 98 admin tests (dashboard 12 + theme 7 new) + typecheck + production build, 85 PHP tests
(5 new stats tests, 25 assertions), Pint clean, and a real-Chrome 23-item checklist — real stats
54/36/18, create→55 then delete→54 invalidation, theme persistence over a dark OS, 390px mobile
drawer + no overflow, no user-data endpoints, no console errors — all PASS.

**Phase 2F — Documentation + hardening.**
`ADMIN_PANEL_ARCHITECTURE.md`, README/roadmap/env updates, full `php artisan test` + `vitest run` + `build:admin` in CI, production checklist (secure cookies, CORS allow-list, debug off, `storage` PHP-deny, `/admin/test` gating).

---

## 23. Open Decisions (need confirmation before Phase 2 starts)

1. **`image_url` column** — migrate to `text` (keeps legacy external URLs) or drop the field from admin writes (B6). Recommendation: drop it from admin writes now, migrate to `text` only if legacy data exists.
2. **Same-origin only, or cross-origin admin host?** Cross-origin needs B8 `config/cors.php`; same-origin (recommended, served at `/admin`) needs none.
3. **Delete semantics for the UI** — soft delete only (current backend), or expose restore/trashed list in the admin panel (needs a small backend addition; currently out of scope).
4. **Dark mode default** — follow OS (recommended) vs light-by-default with a manual toggle.
5. **Statistics definition** — exact card set (`total`, `active`, `inactive`, `with image`, `soft-deleted`, `added this week`).
6. **E2E tooling now or later** — Playwright in Phase 2F vs deferring to a later phase.

---

## 24. Confirmation

**NO CODE WAS MODIFIED in this phase.** No files were created, edited, or deleted in `MediTrack-Backend` (`app/`, `routes/`, `config/`, `resources/`, `database/`, `public/`, `tests/`, `composer.json`, `package.json`) or in the Android `MediTrack` project. Inspection was read-only (`cat`/`find`/`ls`/`git log`/`git status`/`php artisan route:list`/`php artisan test` — the test run uses the in-memory SQLite database configured in `phpunit.xml`). The only artifact produced is this plan document.
