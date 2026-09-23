# MediTrack Backend

## Purpose
The MediTrack Backend serves as the robust API, catalog manager, and admin panel for the MediTrack Android Application. It manages global medicine catalogs, user authentication, and secure data storage, completely decoupled from the Android client.

## Environment Stack
- **Laravel Version**: 13.33.0
- **PHP Version**: 8.4.22
- **Composer Version**: 2.10.1
- **Node Version**: v26.7.0
- **npm Version**: 11.19.0
- **Local Database**: SQLite

## Setup & Starting the Server
1. Clone the repository.
2. Ensure you have the required PHP and Composer versions.
3. Run `composer install`
4. Copy `.env.example` to `.env` and set `APP_NAME`, `APP_ENV=local`.
5. Run `php artisan key:generate`
6. Run `php artisan migrate` to construct the database.
7. Start the local server by running:
   ```bash
   php artisan serve
   ```
   The backend will be available at `http://127.0.0.1:8000`.

## Admin Creation
For development environments, you can interactively create or update an admin user:
```bash
php artisan make:admin
```
This user will be granted the `ADMIN` role. Regular registrations via the API default to `USER`.

## API Endpoints (Phase 2)
### Authentication
- `POST /api/v1/auth/register` - Create a new user account.
- `POST /api/v1/auth/login` - Authenticate and retrieve a Sanctum token.
- `POST /api/v1/auth/logout` - Revoke the current access token.
- `GET /api/v1/auth/user` - Retrieve the currently authenticated user profile.

### Admin
- `GET /api/v1/admin/test` - Test endpoint requiring both Sanctum auth and Admin privileges.

## Running Tests
Run the PHPUnit test suite to verify authentication boundaries and the catalog API:
```bash
php artisan test
```

## Implementation Status
Currently in **Phase 2B: Admin SPA Frontend Foundation** — the React admin panel shell, login page and
API client exist; the catalog UI, dashboard statistics and catalog forms do **not** yet.
- Authentication architecture built using Laravel Sanctum: personal access tokens for Android, session cookies for the Admin SPA.
- Roles system (`ADMIN` vs `USER`) implemented.
- `MakeAdminCommand` established for development seeding.
- Medicine catalog CRUD + image management (Admin) and read-only catalog API (User) implemented.
- Admin SPA authentication endpoints, stateful Sanctum configuration, CSRF and login throttling in place.
- Admin SPA foundation (`resources/admin`) built with React 19 + TypeScript + Vite + Tailwind 4: admin login page, session auth state, admin route guard, responsive sidebar/topbar shell, and placeholder Dashboard/Catalog/Settings pages.
- Test suite successfully passing all bounds (PHP: 80 tests; admin SPA: 38 tests).

## Phase 3: Admin Medicine Catalog Management
- **Models**: `CatalogMedicine` implemented with soft deletes.
- **Admin Endpoints** (Requires `auth:sanctum` + `admin` middleware):
  - `GET /api/v1/admin/catalog/medicines` (Paginated, Searchable)
  - `POST /api/v1/admin/catalog/medicines` (Create)
  - `GET /api/v1/admin/catalog/medicines/{id}` (View)
  - `PUT /api/v1/admin/catalog/medicines/{id}` (Update)
  - `DELETE /api/v1/admin/catalog/medicines/{id}` (Soft Delete)
  - `PATCH /api/v1/admin/catalog/medicines/{id}/status` (Activate/Deactivate)
- **User Endpoint** (Requires `auth:sanctum`):
  - `GET /api/v1/catalog/medicines` (Paginated, Searchable, only returns active and non-deleted medicines)
- **Search capabilities**: Both index endpoints allow `?search=query` to search by name, generic name, or manufacturer.
- **Pagination**: Supports `?per_page=N` (defaults to 20, max 100).
- **Image URL**: Members of the catalog are returned with an `imageUrl` field. When an image exists it is the usable public URL; when no image exists it is `null`.

## Phase 4: Medicine Catalog Image Upload & Storage
### Image Upload Endpoints (Admin only — `auth:sanctum` + `admin` middleware)
- `POST /api/v1/admin/catalog/medicines` — Create a medicine. Accepts `multipart/form-data` with an optional `image` file plus: `name`, `generic_name`, `strength`, `dosage_form`, `manufacturer`, `is_active`. The image is optional and a medicine without an image is valid.
- `PUT|PATCH /api/v1/admin/catalog/medicines/{id}` — Update a medicine. Supports:
  - Replacing the image: send a new `image` file.
  - Keeping the existing image: omit `image` entirely.
  - Removing the image: send `remove_image=true`.
  - `remove_image` and `image` cannot be sent together (422).
- `PATCH /api/v1/admin/catalog/medicines/{id}/image` — Admin-only way to remove the image from a medicine without deleting it. Send `{"remove_image": true}`.

### Accepted Formats
- JPG / JPEG
- PNG
- WEBP

SVG is rejected. Files are validated by content/MIME type via Laravel validation (`image`, `mimes:jpg,jpeg,png,webp`) and the client-provided filename is never trusted as a storage filename.

### Maximum File Size
- **5 MB** (`max:5120` in kilobytes).

### Storage Location
- Images are stored on the `public` disk (default `local` driver) in the dedicated directory:
  - `storage/app/public/catalog-medicines/`
- Each file receives a generated unique filename; the original user-provided filename is not used.
- The database `catalog_medicines.image_url` column stores the internal storage path. The API never exposes the internal path directly.

### Image URL Behavior
- `CatalogMedicineResource` returns `imageUrl`:
  - Present image → usable public URL (`{APP_URL}/storage/catalog-medicines/<file>`).
  - No image → `imageUrl` is `null`.
- Legacy data containing an absolute URL in `image_url` is returned as-is for backward compatibility.

### Local Storage Setup
```bash
php artisan storage:link
```
This creates the `public/storage` symlink pointing to `storage/app/public` so images are publicly reachable. Required once after setup. For local development the disk is configured via `FILESYSTEM_DISK=local` with the `public` disk in `config/filesystems.php`.

### Future Cloud-Storage Migration Considerations
- All storage access is isolated behind two points: the controller helpers (`storeImage` / `deleteImage`) which write to the `public` disk, and the `CatalogMedicineResource` which generates the public URL.
- To migrate to S3/cloud storage: configure an S3 disk in `config/filesystems.php`, switch `FILESYSTEM_DISK` (or the disk used for catalog images), and ensure the disk exposes a public URL. The resource already resolves `imageUrl` through `Storage::disk('public')->url(...)`, so no API contract change is needed.
- For these three formats (JPG, PNG, WEBP) no image-processing or OCR/AI dependency is used.

## Phase 5: User Catalog API for Android Synchronization
The Android client synchronizes the global medicine catalog from this endpoint:

- `GET /api/v1/catalog/medicines` (requires `auth:sanctum`).
- Returns **only active, non-soft-deleted** catalog medicines.
- Paginated via `?page=N`; default 20 per page, capped at 100 (`?per_page=`).
- Ordered by `id` ascending — **stable ordering** suitable for multi-page synchronization.
- Optional `?search=` by name/generic name/manufacturer (used standalone; the Android sync does not search).
- Response shape (through `CatalogMedicineResource`): Laravel paginator `data` + `meta` (`current_page`, `last_page`, `total`); item fields are **camelCase**: `id`, `name`, `genericName`, `strength`, `dosageForm`, `manufacturer`, `imageUrl` (nullable), `isActive`, `createdAt`, `updatedAt` (ISO-8601 with offset).

### Synchronization Contract (Android)
- The Android app pages through every page sequentially until `last_page`.
- A single successful full-pagination pass is applied to Room via transactional bulk upsert, then locally cached catalog rows missing from the server's active catalog are marked inactive (`deactivateMissing` — `catalog_medicines` table only).
- If any page fails, the Android app performs **no** database writes and keeps the existing local catalog (offline-first); autocomplete remains local to Room.

## Phase 2A: Admin Panel Backend Foundation (Admin SPA Authentication)

The Admin Panel is a first-party SPA served by this application. It authenticates with Laravel
Sanctum's **stateful (session cookie)** mode. The Android client keeps using bearer tokens. There is
no React/SPA code yet — this phase prepares and secures the backend only.

### Sanctum stateful configuration
- `bootstrap/app.php` calls `$middleware->statefulApi()`, which adds
  `Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful` to the `api` middleware group.
- A request is treated as first-party (and receives the session + CSRF middleware stack) when its
  `Referer` or `Origin` host matches `SANCTUM_STATEFUL_DOMAINS`.
- Requests without those headers — e.g. the Android app's OkHttp/Retrofit calls — are **not** stateful
  and keep authenticating with their bearer token. Token requests never receive a session cookie.
- `GET /sanctum/csrf-cookie` starts the session and returns the `XSRF-TOKEN` cookie. The SPA must echo
  that cookie's value in the `X-XSRF-TOKEN` header on every mutating request; missing or invalid token
  results in `419`.
- Session cookies are `httpOnly` with `sameSite=lax`. Set `SESSION_SECURE_COOKIE=true` in production.
- CORS is configured in `config/cors.php` with `supports_credentials = true` and an explicit,
  environment-provided origin list (never `*`, never hard-coded production hosts).

### Admin auth endpoints
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/admin/auth/login` | none (admin-only, throttled) | Start an admin session from email + password. Returns the admin user; **never** an access token. |
| POST | `/api/v1/admin/auth/logout` | `auth:sanctum` | End the session. A personal access token is revoked only if the request actually carried one. |
| GET | `/api/v1/admin/auth/user` | `auth:sanctum` + `admin` | Return the authenticated administrator. |

Behaviour:
- Login success ⇒ `200 {"message":"Logged in successfully.","user":{…}}` plus a session cookie.
- Wrong password **or** unknown email ⇒ `401 {"message":"Invalid credentials."}` — the same response for
  both, so the endpoint does not disclose which email addresses exist.
- A valid **non-admin** account ⇒ `403 {"message":"This account does not have administrator access."}` and
  no usable session is left behind.
- Too many attempts ⇒ `429` (default: 10 attempts per minute, per email + IP).
- A first-party request from an origin that is not configured as stateful ⇒ `400`, because no session
  could be established for a non-first-party caller.
- `GET /api/v1/admin/auth/user` ⇒ `401` unauthenticated, `403` for a signed-in non-admin, `200` for an admin.

### Admin authorization
Reuses the existing role model (`User::ROLE_ADMIN` / `User::isAdmin()`) and the existing
`AdminMiddleware`, now also registered as the `admin` route middleware alias. No second role system
exists. The backend remains the only security boundary; any future SPA route guard is UX only.

### Android authentication is unchanged
`POST /api/v1/auth/register|login|logout` and `GET /api/v1/auth/user` still issue and consume Sanctum
personal access tokens, and `GET /api/v1/catalog/medicines` is untouched. `AuthController::logout()`
now revokes the token only when a real one exists — previously it called `currentAccessToken()->delete()`
unconditionally, which fails for requests that have no personal access token.

### Local development environment
Add to `.env` (see `.env.example` for placeholders — never commit real values):
```
SANCTUM_STATEFUL_DOMAINS=localhost,localhost:5174,127.0.0.1,127.0.0.1:5174,localhost:8000,127.0.0.1:8000
CORS_ALLOWED_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
```
- Port `5174` is the planned Vite admin dev server. Use the same host consistently (`localhost` vs
  `127.0.0.1`) or the browser will not send the session cookie.
- Create an administrator with `php artisan make:admin`.

### Security model (Admin Panel)
1. Defence in depth: `auth:sanctum`, `AdminMiddleware` and each FormRequest's `authorize()` all verify admin rights.
2. The SPA stores no credential in browser storage — the session lives in an `httpOnly` cookie, so XSS cannot lift a long-lived token.
3. CSRF token required on every state-changing request; the session is regenerated on login and invalidated on logout (session-fixation and hijacking mitigation).
4. Login is rate limited per email + IP; the remaining admin auth endpoints are rate limited as well.
5. Cross-site requests are blocked twice over: `SameSite=lax` cookies are not attached to cross-site
   POSTs, and such requests are not stateful, so they arrive unauthenticated.
6. Admin API responses are JSON only, and catalog writes keep the existing FormRequest validation
   (mime/size limits, generated filenames, SVG rejected).

### Tests for Phase 2A
`tests/Feature/AdminAuthenticationTest.php` covers the stateful configuration, admin login (success,
non-admin rejection, invalid credentials, no email enumeration, validation, throttling), the auth/user
endpoint (`401`/`403`/`200`), session cookie round-trips, logout safety (no personal access token
deletion), Android bearer compatibility, and continued protection of the catalog API.
Laravel skips CSRF validation while running unit tests, so the `419` behaviour is verified through the
configuration plus a manual HTTP check rather than by PHPUnit.

## Phase 2B: Admin SPA Frontend Foundation

The Admin Panel single-page application lives in `resources/admin` and is served by Laravel under
**`/admin`**. Phase 2B delivers the application shell, the login screen and the client-side plumbing
only — no catalog list, search, pagination, medicine forms, image upload UI or dashboard statistics.

### Commands
| Command | Purpose |
|---|---|
| `npm run dev:admin` | Vite dev server for the admin SPA on **`http://localhost:5174`** (HMR) |
| `npm run build:admin` | Production build into `public/build-admin/` (git-ignored) |
| `npm run test:admin` | Vitest suite for the admin SPA (jsdom) |
| `npm run typecheck:admin` | `tsc --noEmit` for the admin SPA |

The existing `npm run dev` / `npm run build` scripts and `vite.config.js` are untouched: the admin SPA
has its own config (`vite.admin.config.js`), its own root (`resources/admin`) and its own build output.

### URLs
- **`/admin/login`** — the login screen (public, renders the form).
- **`/admin`** — the verified Admin Dashboard shell (requires an authenticated admin).
- **`/admin/catalog`**, **`/admin/settings`** — placeholders inside the shell.
- **`/admin/*`** — any other path renders an in-shell 404 page.
- **`/`** — redirects to `/admin`.

### Laravel shell route
The `admin.shell` route (`GET /admin/{any?}` → `resources/views/admin/app.blade.php`) returns HTML
only: an empty `#admin-root` element plus the Vite tags. It never renders catalog or account data. The
Blade view uses `@viteReactRefresh` + `@vite('main.tsx', 'build-admin')`, and the route sets
`Vite::useHotFile(public_path('build-admin/hot'))` so that dev-server URLs are picked up for this route
only — the marketing `welcome` view keeps using the default `public/hot` path.

### Local development workflow
1. `php artisan serve` (default `http://127.0.0.1:8000`) — serves the SPA shell **and** the API.
2. `npm run dev:admin` — serves the React modules and HMR.
3. Open **`http://127.0.0.1:8000/admin`**.

The API is called same-origin (`/api/v1`), so the Sanctum session cookie is sent normally. Keep the host
consistent (`localhost` *or* `127.0.0.1`) or the cookie will not be sent. Two footguns worth knowing:
- Binding `php artisan serve --host=localhost` on macOS can listen on IPv6 `::1` only, while the Vite
  proxy targets `http://127.0.0.1:8000`; that combination makes proxied requests fail with `502`.
  Use the default host (`127.0.0.1`).
- `laravel-vite-plugin` deliberately answers `/index.html` on the **dev server port** with a 404
  "Laravel Vite" page, so the dev-server port serves assets only — open the app on `APP_URL`, not on
  `:5174`. The dev proxy below is still configured for tooling that talks to the dev server directly.

### Development proxy
`vite.admin.config.js` proxies `/api`, `/sanctum` and `/storage` to `http://127.0.0.1:8000`, so the
admin SPA runs on a single origin during development and no cross-origin credentialed request is ever
needed. No production URL is hard-coded; the optional `VITE_ADMIN_API_BASE_URL` (see `.env.example`)
overrides the API base path, which otherwise defaults to the same-origin `/api/v1`.

### Sanctum session authentication & CSRF flow (front end)
1. On startup the app calls `GET /api/v1/admin/auth/user` once (TanStack Query, `retry: false`):
   `200` ⇒ authenticated admin, `401` ⇒ unauthenticated, `403` ⇒ signed-in non-admin.
2. Signing in calls `GET /sanctum/csrf-cookie` first, reads the `XSRF-TOKEN` cookie (URL-decoded) and
   echoes it as `X-XSRF-TOKEN` on the `POST /api/v1/admin/auth/login`.
3. Every request uses `credentials: 'include'`; the browser owns the session cookie, which is
   `httpOnly` and therefore unreadable from JavaScript.
4. `419` responses trigger exactly one CSRF-cookie refresh and one retry.
5. No access token is ever created, and nothing is written to `localStorage`/`sessionStorage`.
6. `RequireAdmin` is UX only; `auth:sanctum` + `AdminMiddleware` on `/api/v1/admin/*` remain the
   authorization boundary.

### Admin SPA tests
`npm run test:admin` runs 38 Vitest tests in jsdom covering the API transport (`lib/api/client.test.ts`:
CSRF bootstrap, retry-once on `419`, all typed error states), the auth provider
(`features/auth/AdminAuthProvider.test.tsx`), the route guard (`features/auth/RequireAdmin.test.tsx`) and
the login form (`features/auth/LoginPage.test.tsx`: validation, field errors, 401/403/429/network/server
messages, redirect safety).

### Browser verification status (Phase 2B)
Verified in **real Chrome** (headless, driven over the DevTools Protocol via a temporary script) against
a temporary SQLite database seeded with one `ADMIN` and one `USER` account — **47 checks, all passing**:
- **Built bundle, core flow (12 checks)** — `/admin/login` renders the form; admin login redirects to
  `/admin` and the shell loads; `/api/v1/admin/auth/user` returns `200` in the browser; identity shown;
  session survives a full page refresh; `/admin/catalog` placeholder renders; logout returns to
  `/admin/login`; the session is `401` afterwards; visiting `/admin` while signed out redirects to the
  login page; a `USER` login is denied with no admin content; no uncaught JS errors.
- **Built bundle, supplementary (23 checks)** — Tailwind tokens actually applied (computed colours),
  labelled/autofilled fields, password show/hide, client validation announced via `role="alert"`,
  sidebar/topbar contents, `/admin/settings`, no `localStorage`/`sessionStorage` entries, session cookie
  `httpOnly`, `XSRF-TOKEN` readable and sent as `X-XSRF-TOKEN` on the POST, no `Authorization` header on
  any admin API call, 390 px layout hides the sidebar and opens the mobile drawer, Escape closes it, and
  sign-out works from the keyboard.
- **Vite dev server workflow (12 checks)** — the same core flow repeated against `php artisan serve` +
  `npm run dev:admin`, confirming the hot-file path, the React Fast Refresh preamble and HMR-loaded
  modules work end to end.
