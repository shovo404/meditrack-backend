# MediTrack Backend Roadmap

This document defines the structured development phases for the Laravel Backend.

1. **Backend foundation** (COMPLETE)
2. **Authentication + User/Admin Foundation** (COMPLETE)
3. **Admin authentication**
4. **Medicine catalog** (COMPLETE)
5. **Medicine image storage** (COMPLETE)
6. **Catalog API** (COMPLETE) — `GET /api/v1/catalog/medicines`, active-only, paginated, searchable, stable `id` ordering, camelCase contract
7. **User medicine API**
8. **Prescription API**
9. **Android synchronization** (COMPLETE) — sequential page-by-page sync, transactional Room upsert, `deactivateMissing`, offline-first
10. **Production security**
11. **Testing** (see `php artisan test`)
12. **Deployment**