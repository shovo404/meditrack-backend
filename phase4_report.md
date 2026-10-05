# Phase 4 — API Contract & Data-Integrity Foundation

**Status:** Complete. All required verification passes.
**Date:** 2026-10-06
**Baseline commit:** `d84c42b3916eb6f9f902d776faa569e807fa753d`
**Commit:** `Phase 4: API contracts and data integrity foundation`

## Scope

Only the P0 and P1 findings from `meditrack_feature_gap_audit.md` were addressed. No Phase 5
work was started, and no Appointments, Family/Guardian, Health, Notification Center or Settings
feature was introduced. No UI was redesigned; the only new UI-visible behaviour is the Android 13
notification permission prompt, which is required for the reminder feature to work at all.

## Verification

| Command | Result |
| --- | --- |
| `php artisan test` | **157 passed**, 581 assertions, 0 failures (was 124 before Phase 4) |
| `./gradlew testDebugUnitTest` | **144 passed**, 0 failures (was 77 before Phase 4) |
| `./gradlew clean assembleDebug` | BUILD SUCCESSFUL |
| `./gradlew assembleDebugAndroidTest` | BUILD SUCCESSFUL |

**No emulator/physical-device E2E verification was performed.** Neither `adb` nor the Android
emulator CLI is available in this environment, so `assembleDebugAndroidTest` proves the
instrumented test suite *compiles and packages*, not that it passes on a device. Every behavioural
claim below is backed by JVM unit tests (plain JUnit and Robolectric with in-memory Room) and by
PHPUnit feature tests.

## Backend changes

### 1. Forgot-password endpoint (P0 — route was entirely missing)

The Android app called `POST /api/v1/auth/forgot-password` and the route did not exist, so every
password reset returned 404 and no user could recover an account.

- `app/Http/Requests/ForgotPasswordRequest.php` (new) — validates `email` as `required|string|email`
  with **no** `exists:users,email` rule. Adding that rule would let an attacker distinguish
  registered from unregistered addresses through the validation error.
- `app/Notifications/PasswordResetNotification.php` (new) — sends the broker-minted token by mail.
- `AuthController::forgotPassword()` — returns one fixed message and identical status for known
  and unknown addresses, so the response is not an enumeration oracle. Delivery failures are
  logged and still return the generic message rather than leaking server state to the caller.
- `routes/api.php` — added the route with `throttle:password-reset`.
- `AppServiceProvider` — `password-reset` limiter: 3 requests/minute keyed by normalised
  email **and** IP, to slow address enumeration.

### 2. Registration returns a usable session (P0 — token was silently omitted)

`register()` returned `201` with only `{message, user}` and issued no token, so a newly
registered user was not authenticated despite the app treating registration as a successful sign-in.

- `AuthController::register()` now creates a Sanctum token and returns `access_token`,
  `token_type` and `user` through the same `authenticatedSessionPayload()` helper as `login()`, so
  the two flows cannot drift apart.
- Registration forces `User::ROLE_USER`, so a client-supplied `role` cannot escalate privileges.
- `AuthenticationTest` now asserts the shape, that the token actually authenticates
  `GET /api/v1/auth/user` on a protected endpoint, that a `personal_access_tokens` row exists, and
  that registration and login return identical key sets.

### 3. Medicine timestamps (P0 — `updatedAt` was never sent)

`formatMedicine()` omitted `updatedAt` while the Android DTO declares it, which permanently
disabled server→device reconciliation.

- `UserMedicineController::formatMedicine()` now emits `createdAt` and `updatedAt` via
  `toIso8601String()`, matching `PrescriptionResource`, `CatalogMedicineResource` and
  `DoseLogResource`.

### 4. Catalogue identifier type (P0 — integer/uuid mismatch)

`medicines.catalog_medicine_id` was a varchar validated as a uuid, but `catalog_medicines.id` is an
integer primary key with 56 existing rows. Any catalogue-linked medicine creation returned 422, and
a uuid could never match.

- Migration `2026_10_06_000001_align_catalog_medicine_id_type.php`:
  - nulls out only *unresolvable* links (non-numeric, or referencing a non-existent catalogue row);
  - changes the column to `unsignedBigInteger` and adds a foreign key to `catalog_medicines.id`
    with `ON DELETE SET NULL`, so deactivating a catalogue entry cannot cascade-delete a user's
    medicine history;
  - **all 56 catalogue rows are preserved** — verified before and after, and again in
    `MedicineContractTest`.
  - Verified reversible: `migrate:rollback --step=1` then `migrate` both succeed. A backup was
    taken at `/tmp/meditrack_db_backup_pre_phase4.sqlite` first.
- `UserMedicineController` validates `catalogMedicineId` as `nullable|integer|exists:catalog_medicines,id`.
  An inactive catalogue row stays valid input so that already-linked medicines remain editable.
- `Medicine` casts `catalog_medicine_id` as integer.
- `MedicineContractTest` (new, 15 tests) pins the wire contract, the integer round-trip, rejection
  of nonexistent/non-numeric/uuid ids, and that a catalogue read never mutates user dose or schedule data.

## Android changes

### 5. Registration no longer reports false success

`AuthRepositoryImpl.register()` returned `AuthResult.Success` **unconditionally**, even when the
response carried no token: the UI advanced, `authState` stayed `Loading`, no credential was stored,
and no error was shown. It now mirrors `login()` exactly — a missing token or user is an error.
`RegistrationSessionTest` (new, 10 tests) covers the missing-token case, the missing-user case,
preserving an existing token on failure, and transport/server/validation failures.

### 6. Offset-tolerant timestamp parsing (P1)

Laravel serialises every timestamp with `toIso8601String()`, which always carries a UTC offset
(`2026-10-06T14:30:00.123456+06:00`). `LocalDateTime.parse()` rejects that shape. Call sites used
it inside `runCatching { }.getOrNull()`, so the failure was silent:

- in the medicine reconcile loop the fallback was `LocalDateTime.MIN`, so **no server update was ever
  considered newer** and the device copy could never converge;
- `PrescriptionRepositoryImpl` used `it.replace("Z", "")`, which fixes `Z` but still fails for any
  real offset;
- `createdAt` used a bare `LocalDateTime.parse(...)` that would throw and abort the whole sync pass.

New `core/utils/TimestampParser.kt` is the single parsing point: it normalises offset-bearing input
into the device zone, then falls back to naive local parsing, and returns `null` rather than
throwing so one bad row cannot abort a sync. Wired into `MedicineRepositoryImpl`,
`PrescriptionRepositoryImpl`, `DoseLogRepositoryImpl` and `CatalogMedicineDto`.
`TimestampParserTest` (new, 25 tests) covers the exact `toIso8601String()` shape, zone
normalisation, date/time variants and malformed input.

### 7. Alarm recurrence (P1 — alarms fired exactly once)

`MedicineAlarmReceiver` showed a notification with hard-coded placeholder text
("Your Medicine" / "Check details") and **never scheduled another occurrence**, so every course
silently stopped reminding after a single dose. The exact-alarm, `AllowWhileIdle` path was already
correct.

- New `domain/alarm/NextDoseOccurrence.kt` holds the recurrence rule as a pure function of
  `(medicine, schedule, after)` — no clock, no Android types, fully unit-testable.
  The next occurrence is **strictly after** `after`, which is what prevents a fired alarm from
  re-arming itself. It skips inactive medicines/schedules, `AS_NEEDED` (a dose taken by hand has no
  scheduled time), courses not yet started, courses already ended, and schedules belonging to a
  different medicine.
- `MedicineAlarmSchedulerImpl` delegates to it, posts the real medicine name and dose, and takes an
  explicit `after` so a late-delivered alarm rolls to the genuinely next occurrence.
- `MedicineAlarmReceiver` is now `@AndroidEntryPoint` + `goAsync()`: it reads the medicine from the
  local database, notifies, then arms the next occurrence.
- `cancelMedicineAlarm` switched from `FLAG_UPDATE_CURRENT` to `FLAG_NO_CREATE` — the old flag
  overwrote the extras of a live alarm while cancelling it.
- Request codes hash `medicineId + "|" + scheduleId`; the old concatenation without a separator let
  `("ab","c")` and `("a","bc")` collide and one schedule's alarm overwrite another's.
- `scheduleAllMedicineAlarms` and `cancelAllMedicineAlarms` were empty placeholders and now work.
- `NextDoseOccurrenceTest` (new, 20 tests) covers daily rollover, multiple schedules, midnight,
  end/start boundaries and every skip condition.

### 8. Boot and timezone restoration (P1 — reminders died after reboot)

Two independent defects:

- `BootCompletedReceiver` called `context.startService()`, which throws `IllegalStateException` when
  started from the background on Android 8+, and the exception was swallowed by a `catch` — so
  restoration silently never happened.
- `RescheduleAlarmsService` then read `authState`, which is still `Loading` at boot because no
  session has been restored, so even a successful start would have scheduled nothing.
  `MedicineRepositoryImpl.getSchedulesForMedicine()` also returned `emptyList()` outright.

Fixes: the boot receiver now works inline via `goAsync()`; restoration reads the **local database**
via the new `MedicineRepository.getMedicinesForAlarmRestoration()` / `MedicineDao.getActiveMedicinesAnyUser()`,
which is correct because reminders are offline-first. `getSchedulesForMedicine()` now performs a
real lookup. `RescheduleAlarmsService` is kept for foreground callers and uses the same offline-safe
path.

### 9. Sync no longer destroys data on a malformed response (P1)

Both sync paths read the server list as `response.body()?.data ?: emptyList()`. A **successful HTTP
response whose body failed to deserialise became an empty list**, and the following
"delete every synced row missing from the server" step then erased the user's entire local
medicines (cancelling every alarm) or prescriptions (also deleting cached images). Absence is only
meaningful when a real, complete, non-paginated list was received; both list endpoints were
confirmed non-paginated on the backend. Both paths now fail the sync and skip reconciliation when
the body is absent. `SyncDeleteOnAbsenceTest` (new) verifies both directions — a null body preserves
local data *and* cached image files, while a genuinely empty list still deletes.

### 10. Android 13+ notification permission (P1 — reminders were never delivered)

`POST_NOTIFICATIONS` was declared in the manifest but never requested at runtime. On Android 13+ it
is denied by default and posting is a silent no-op, so alarms fired and rescheduled correctly while
the user received nothing.

- `NotificationPermission` (new) isolates the version check and `checkSelfPermission`.
- `core/ui/NotificationPermissionRequest.kt` (new) requests the permission **once**, only after the
  user is authenticated, recorded in `SharedPreferences` so a denial never becomes a prompt on every
  launch. Nothing blocks on the result: dose logging and the offline-first model are untouched.
- Wired into `AppNavigation` where `authState` is already observed.
- `NotificationHelper.showAlarmNotification` now logs and returns instead of silently building a
  notification that can never be shown.

### 11. DoseLog delete ownership scoping (P1)

`DoseLogDao.deleteDoseLogById` ran `DELETE FROM dose_logs WHERE id = :id` with no `userId`
predicate — the only mutating statement in the app not scoped by owner, while
`PrescriptionDao.deletePrescription`, `updateDoseLogSyncState` and the medicine queries all are. It
now takes `userId` and returns the affected row count. `DoseLogOwnershipTest` (new, 7 tests) covers
ownership, cross-account refusal, and the queued-delete path.

## Test summary

Added **67 tests** (33 Laravel, 34 Android) and **1 pre-existing flaky test repaired**.

New files:
- `tests/Feature/ForgotPasswordTest.php` (13)
- `tests/Feature/MedicineContractTest.php` (15)
- 5 added to `tests/Feature/AuthenticationTest.php`
- `RegistrationSessionTest.kt` (10)
- `TimestampParserTest.kt` (25)
- `NextDoseOccurrenceTest.kt` (20)
- `SyncDeleteOnAbsenceTest.kt` (4)
- `DoseLogOwnershipTest.kt` (7)

Regression tests were verified to be **load-bearing**: temporarily reverting the null-body guard
made both `SyncDeleteOnAbsenceTest` null-body cases fail, and the guard was then restored.

### One pre-existing test was changed

`MainViewModelSyncTest.logout resets the once guards so the next session syncs again` was flaky —
**2 failures in 8 isolated runs**, reproduced before any Phase 4 alarm work. It awaited
`medicines.syncCalls == 2` and then asserted `prescriptions.syncCalls == 2` unconditionally, racing
against an independent prescription-sync coroutine. It now awaits both, matching the pattern the
same file already uses elsewhere. The Android suite was then run **6 consecutive times with zero
failures**.

`CatalogMedicineDtoTest.parsesOffsetTimestampsIntoLocalDateTime` was also updated: it asserted the
old offset-*discarding* behaviour (`10:20:30+06:00` → `10:20:30`). Discarding the offset made two
timestamps written in different zones look hours apart when they are the same ordering in time,
which is precisely what broke reconciliation. The test now pins the device zone and asserts
normalisation, plus a new case for a non-UTC zone. This is a deliberate, documented behaviour
change, not a weakened assertion.

## Known limitations and deliberate decisions

- **`MedicineFrequency.SPECIFIC_DAYS` is treated as daily.** `MedicineSchedule` has no weekday
  field, so per-weekday recurrence is not representable. Adding a field plus backend validation
  would exceed Phase 4 scope. Documented in `NextDoseOccurrence`.
- **Catalogue ids remain `String` in the Android Room/DTO layer.** The canonical database type is
  the existing integer `catalog_medicines.id` (56 rows preserved). Gson coerces the JSON integer to
  `String` at the boundary, and the backend accepts both integer and numeric-string input, verified
  by test. Converting the Android column to `Long` would require a Room schema migration for no
  behavioural gain, so it was left alone deliberately.
- **Email lookup remains case-sensitive**, matching existing login/register behaviour. Laravel's
  SQLite `email` column is not `COLLATE NOCASE`. A test asserting case-insensitive reset was removed
  rather than weakening the contract; changing lookup semantics is a behaviour change outside Phase 4.
- **`scheduleAllMedicineAlarms` is not user-scoped.** Correct for reminders: they must survive
  reboot offline, before any session exists. It only ever reads the local database.
- **No commit was made for the Android workspace**, which is not a Git repository.

## Files changed

Backend (`MediTrack-Backend`):
- `app/Http/Controllers/AuthController.php` (modified)
- `app/Http/Controllers/UserMedicineController.php` (modified)
- `app/Http/Requests/ForgotPasswordRequest.php` (new)
- `app/Notifications/PasswordResetNotification.php` (new)
- `app/Models/Medicine.php` (modified)
- `app/Providers/AppServiceProvider.php` (modified)
- `database/migrations/2026_10_06_000001_align_catalog_medicine_id_type.php` (new)
- `routes/api.php` (modified)
- `tests/Feature/AuthenticationTest.php` (modified)
- `tests/Feature/ForgotPasswordTest.php` (new)
- `tests/Feature/MedicineContractTest.php` (new)

Android (`MediTrack`, not version-controlled):
- `core/utils/TimestampParser.kt` (new)
- `core/ui/NotificationPermissionRequest.kt` (new)
- `domain/alarm/MedicineAlarmScheduler.kt`, `domain/alarm/NextDoseOccurrence.kt` (new)
- `domain/repository/MedicineRepository.kt` (modified)
- `data/alarm/MedicineAlarmSchedulerImpl.kt`, `MedicineAlarmReceiver.kt`,
  `BootCompletedReceiver.kt`, `RescheduleAlarmsService.kt`,
  `NotificationPermission.kt` (new), `NotificationHelper.kt`
- `data/local/dao/MedicineDao.kt`, `data/local/dao/DoseLogDao.kt` (modified)
- `data/repository/AuthRepositoryImpl.kt`, `MedicineRepositoryImpl.kt`,
  `PrescriptionRepositoryImpl.kt`, `DoseLogRepositoryImpl.kt` (modified)
- `data/remote/dto/CatalogMedicineDto.kt` (modified)
- `core/navigation/AppNavigation.kt` (modified)
- tests: `RegistrationSessionTest`, `TimestampParserTest`, `NextDoseOccurrenceTest`,
  `SyncDeleteOnAbsenceTest`, `DoseLogOwnershipTest` (new);
  `ProfileUpdateTest` (extended fake), `MainViewModelSyncTest`, `CatalogMedicineDtoTest`,
  `MedicineCatalogIntegrationTest` (modified)
