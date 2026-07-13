// src/app/(app)/admin/sync/page.tsx
'use client'

import { useIsAdmin } from '@/hooks/useAdmin'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Importando todos os componentes da pasta admin
import { SyncQueueTable } from '@/components/admin/SyncQueueTable'
import { AdminLogger } from '@/components/admin/AdminLogger'
import { ErudaToggler } from '@/components/admin/ErudaToggler'
import { AdminReset } from '@/components/admin/AdminReset'
import { AdminDataViewer } from '@/components/admin/AdminDataViewer'
import { AdminStatus } from '@/components/admin/AdminStatus'

export default function AdminSyncPage() {
  const { isAdmin, loading } = useIsAdmin()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/')
    }
  }, [isAdmin, loading, router])

  if (loading || !isAdmin) return <div className="p-4">Carregando...</div>

  return (
    <main className="p-4 pb-24 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold dark:text-white mb-6">Painel do Administrador</h1>
      
      <AdminStatus />
      <SyncQueueTable />
      <AdminLogger />
      <ErudaToggler />
      <AdminDataViewer />
      <AdminReset />
    </main>
  )
}
