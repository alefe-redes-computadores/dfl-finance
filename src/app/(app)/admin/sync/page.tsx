'use client'

import { useIsAdmin } from '@/hooks/useAdmin'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { SyncQueueTable } from '@/components/admin/SyncQueueTable'
import { AdminLogger } from '@/components/admin/AdminLogger'
import { ErudaToggler } from '@/components/admin/ErudaToggler'
import { AdminReset } from '@/components/admin/AdminReset'
import { AdminDataViewer } from '@/components/admin/AdminDataViewer'
import { AdminStatus } from '@/components/admin/AdminStatus'

export default function AdminSyncPage() {
  const { isAdmin, loading } = useIsAdmin()
  const router = useRouter()

  // ✅ CORRIGIDO: usa router.replace para evitar redirecionamento em loop
  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace('/')
    }
  }, [isAdmin, loading, router])

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900 px-4 pt-6">
        <div className="max-w-2xl mx-auto rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-5">
          <p className="text-[14px] font-semibold text-gray-500 dark:text-gray-400">
            Carregando...
          </p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900 px-4 pt-6 pb-24">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* HEADER */}
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-5">
          <h1 className="text-[22px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            Painel do Administrador
          </h1>
          <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1">
            Monitoramento e ferramentas internas de sincronização
          </p>
        </div>

        {/* COMPONENTES ADMIN */}
        <div className="space-y-4">
          <AdminStatus />
          <SyncQueueTable />
          <AdminLogger />
          <ErudaToggler />
          <AdminDataViewer />
          <AdminReset />
        </div>
      </div>
    </main>
  )
}