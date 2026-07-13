'use client'

import { useIsAdmin } from '@/hooks/useAdmin'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AdminSyncPage() {
  const { isAdmin, loading } = useIsAdmin()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/') // Expulsa usuários comuns para a Home
    }
  }, [isAdmin, loading, router])

  if (loading) return <div className="p-4 text-center">Verificando permissões...</div>
  if (!isAdmin) return null

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold dark:text-white">Painel do Desenvolvedor</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Gerenciamento de fila e logs</p>
      </header>

      {/* Aqui virão os próximos blocos que vamos criar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700">
        <p className="text-gray-400 text-sm">O painel está ativo. Aguardando componentes de Log e Fila...</p>
      </div>
    </div>
  )
}
