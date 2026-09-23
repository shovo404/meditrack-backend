import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AdminApp } from '@/app/AdminApp'
import '@/styles/admin.css'

const container = document.getElementById('admin-root')

if (!container) {
    throw new Error('Admin Panel mount point "#admin-root" was not found.')
}

createRoot(container).render(
    <StrictMode>
        <AdminApp />
    </StrictMode>
)
