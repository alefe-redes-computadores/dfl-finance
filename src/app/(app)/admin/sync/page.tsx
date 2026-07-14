'use client'

import { useIsAdmin } from '@/hooks/useAdmin'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { SyncQueueTable } from '@/components/admin/SyncQueueTable'
import { AdminLogger } from '@/components/admin/AdminLogger'
import { ErudaToggler } from '@/components/admin/ErudaToggler'
import { AdminReset } from '@/components/admin/AdminReset'
import { AdminDataViewer } from '@/components/admin/AdminDataViewer'
import { AdminStatus } from '@/components/admin/AdminStatus'

export default function AdminSyncPage() {
  const { isAdmin, loading } = useIsAdmin()
  const router = useRouter()
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    // Detecta se estamos offline
    setIsOffline(!navigator.onLine)
  }, [])

  // Só redireciona se estiver online e não for admin.
  // Se estiver offline, permitimos o acesso ("modo desenvolvedor local")
  useEffect(() => {
    if (!loading && !isAdmin && !isOffline) {
      router.replace('/')
    }
  }, [isAdmin, loading, isOffline, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900 px-4 pt-6">
        <div className="max-w-2xl mx-auto rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-5">
          <p className="text-[14px] font-semibold text-gray-500 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    )
  }

  // Feedback claro caso o acesso seja negado online
  if (!isAdmin && !isOffline) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900 px-4 pt-6 flex items-center justify-center">
        <div className="max-w-sm w-full rounded-[24px] bg-white dark:bg-slate-800 p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Acesso Negado</h2>
          <p className="text-sm text-gray-500 mb-6">Você não tem permissão de administrador.</p>
          <button 
            onClick={() => router.replace('/')}
            className="w-full py-3 bg-teal-600 text-white rounded-[16px] font-bold"
          >
            Voltar para o App
          </button>
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
            Painel do Administrador {isOffline && <span className="text-amber-500 text-[12px]">(Modo Offline/Local)</span>}
          </h1>
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
