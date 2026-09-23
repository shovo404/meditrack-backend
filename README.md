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
Run the PHPUnit test suite to verify authentication boundaries:
```bash
php artisan test
```

## Implementation Status
Currently in **Phase 2: Authentication + User/Admin Foundation**.
- Laravel installed and database configured.
- Authentication architecture built using Laravel Sanctum.
- Roles system (`ADMIN` vs `USER`) implemented.
- `MakeAdminCommand` established for development seeding.
- Test suite successfully passing all bounds.

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
