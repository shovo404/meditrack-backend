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

## Implementation Status
Currently in **Phase 1: Backend Foundation**.
- Laravel successfully installed.
- Database configured (SQLite).
- Git version control initialized.
- Ready for authentication phases.
