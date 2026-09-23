import type { AdminUser } from '@/lib/api/types'

export const adminUserFixture: AdminUser = {
    id: 1,
    name: 'Smoke Admin',
    email: 'smoke-admin@example.com',
    role: 'ADMIN',
}

export const regularUserFixture: AdminUser = {
    id: 2,
    name: 'Smoke User',
    email: 'smoke-user@example.com',
    role: 'USER',
}
