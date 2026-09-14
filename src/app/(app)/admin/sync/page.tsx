'use client'

import { SyncQueueTable } from '@/components/admin/SyncQueueTable'
import { AdminLogger } from '@/components/admin/AdminLogger'
import { ErudaToggler } from '@/components/admin/ErudaToggler'
import { AdminReset } from '@/components/admin/AdminReset'
import { AdminDataViewer } from '@/components/admin/AdminDataViewer'
import { AdminStatus } from '@/components/admin/AdminStatus'
import { AdminSyncDiagnostics } from '@/components/admin/AdminSyncDiagnostics'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useIsAdmin } from '@/hooks/useAdmin'

export default function AdminSyncPage() {
  const router = useRouter()
  const { isAdmin, loading } = useIsAdmin()

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f8f9fa] px-4 dark:bg-slate-900">
        <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
          Verificando acesso…
        </p>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f8f9fa] px-4 dark:bg-slate-900">
        <div className="w-full max-w-sm rounded-[24px] border border-gray-200/70 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Área administrativa
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Este painel está disponível somente para administradores autorizados.
          </p>
          <button
            type="button"
            onClick={() => router.replace('/more')}
            className="mt-5 min-h-11 w-full rounded-2xl bg-teal-700 px-4 text-sm font-semibold text-white active:scale-[0.98] dark:bg-teal-600"
          >
            Voltar
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900 px-4 pt-6 pb-24">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-5 flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-[22px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              Painel do Administrador
            </h1>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1">
              Acesso administrativo verificado
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <AdminStatus />
          <AdminSyncDiagnostics />
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
