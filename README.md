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
