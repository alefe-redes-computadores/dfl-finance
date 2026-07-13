'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { useIsAdmin } from '@/hooks/useAdmin'
import { useLocalSync } from '@/hooks/useLocalSync'

export function SyncStatusModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { pendingCount, isSyncing, forceSync } = useLocalSync() || {}
  const { isAdmin } = useIsAdmin() || { isAdmin: false }

  // Garante que, se o modal fechar, o scroll da página seja restaurado e não bloqueie toques
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  // Se não estiver aberto, não renderiza ABSOLUTAMENTE NADA no DOM
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop: Adicionamos pointer-events-auto para garantir que cliques sejam capturados apenas aqui */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* Container do Modal */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200 relative z-10">
        <h2 className="text-lg font-bold mb-4 dark:text-white">Status de Sincronização</h2>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Itens pendentes: <strong>{pendingCount ?? 0}</strong>
          </p>
          
          <button 
            onClick={forceSync}
            disabled={!!isSyncing}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isSyncing ? 'Sincronizando...' : 'Forçar Sincronização'}
          </button>
          
          <button 
            onClick={onClose}
            className="w-full py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 font-medium"
          >
            Fechar
          </button>
        </div>

        {isAdmin && (
          <Link 
            href="/admin/sync" 
            className="block text-center text-xs text-purple-500 hover:text-purple-600 mt-4 underline font-medium"
            onClick={onClose}
          >
            Acessar Painel de Admin
          </Link>
        )}
      </div>
    </div>
  )
}
