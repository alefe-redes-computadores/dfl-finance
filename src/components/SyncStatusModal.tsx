'use client'

import React from 'react'
import Link from 'next/link'
import { useIsAdmin } from '@/hooks/useAdmin'
import { useLocalSync } from '@/hooks/useLocalSync'

export function SyncStatusModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // 🔥 FALLBACK: Garantia de que os hooks retornem objetos válidos
  const syncData = useLocalSync() || {}
  const { pendingCount = 0, isSyncing = false, forceSync = () => {} } = syncData

  const adminData = useIsAdmin() || {}
  const { isAdmin = false } = adminData

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
        <h2 className="text-lg font-bold mb-4 dark:text-white">Status de Sincronização</h2>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Itens pendentes: <strong>{pendingCount}</strong>
          </p>
          
          <button 
            onClick={forceSync}
            disabled={isSyncing}
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