# Admin Panel Production Readiness (Phase 2F)

## 1. Architecture
The Admin Panel is a Single Page Application (SPA) built with React, TypeScript, and Vite. It serves as a dedicated interface for administrators to manage the MediTrack backend. The frontend communicates via an authenticated REST API with the Laravel backend.

## 2. Authentication
Authentication is strictly handled by Laravel Sanctum using stateful, cookie-based sessions. The SPA retrieves a CSRF cookie on load and then sends subsequent requests containing the session cookie. This ensures no authentication tokens (like Bearer JWTs) are exposed to localStorage or JavaScript scope.

## 3. Authorization
Authorization is protected both on the client and server. Client-side routes are guarded by RequireAdmin, but all sensitive backend operations enforce authorization using the AdminMiddleware, guaranteeing that standard users or unauthenticated entities cannot manipulate or access administrative data.

## 4. API Security
- Validates all input thoroughly.
- Endpoints return standard HTTP status codes (e.g., 401, 403, 422).
- Stack traces or internal error details are gracefully masked from users.

## 5. File Upload Security
- Enforces strict image validation (JPG, JPEG, PNG, WEBP).
- Hard limits on file size (maximum 5MB).
- Verifies content types to prevent executable scripts from being uploaded.
- Does not expose physical disk paths in API output.

## 6. Rate Limiting
- Login and Authentication routes are protected by robust rate limiting (e.g., 5-6 attempts per minute depending on route) to mitigate brute-force and credential stuffing attacks.

## 7. CSRF
- Full reliance on Sanctum’s built-in CSRF handling (GET /sanctum/csrf-cookie), mitigating Cross-Site Request Forgery.
- Proper handling of 419 token mismatch errors.

## 8. CORS
- CORS is configured safely without wildcards (*) for credentialed requests. The config/cors.php and config/sanctum.php definitions secure the domain boundary.

## 9. Error Handling
- The frontend apiFetch client catches network errors and non-2xx responses securely, presenting readable, sanitized errors to the user instead of raw stack traces.
- Handles 401 unauthenticated and 419 CSRF errors safely, seamlessly returning the user to the login screen.

## 10. Accessibility
- Adheres to semantic HTML principles.
- Elements maintain strong contrast against both light and dark themes.
- Dialogs and menus feature proper focus handling and keyboard navigability (Esc to close, tab cycling).

## 11. Responsive Support
- Verified to support mobile (390×844), tablet (768×1024), and desktop (1366×900).
- Tables and forms do not cause horizontal overflow on mobile screens.

## 12. Testing
- Frontend is verified with a robust testing suite yielding 98/98 tests passing across components.
- Backend is verified with 85/85 tests (310 assertions) confirming rate limiting, authentication, and CRUD security boundaries.

## 13. Browser Verification
- Verified extensively under Google Chrome across light, dark, and system themes. Tested edge cases such as debounced typing and image uploading constraints.

## 14. Environment Configuration
- .env.example remains clean and does not expose real API keys or sensitive production certificates.

## 15. Deployment Prerequisites
- Ensure domain configuration explicitly maps to stateful CORS properties.
- Needs the SQLite development database to eventually be replaced with a robust, scalable backend store (e.g., PostgreSQL/MySQL) in later deployment stages.

## 16. Known Limitations
- The system is currently in a pre-production testing stage.
- Advanced analytics and deep integrations with the Android MediTrack system are pending for future phases.

## 17. Database
- **SQLite remains the development database.**

## 18. Database Migration
- **Explicitly, production database migration is not part of Phase 2F.**
