// src/components/SyncStatusModal.tsx
'use client'

import { useLocalSync } from '@/hooks/useLocalSync'
import { X, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'

export function SyncStatusModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { pendingCount, isSyncing, forceSync } = useLocalSync()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      {/* Overlay translúcido */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-white/10 animate-in slide-in-from-bottom-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold dark:text-white">Status de Sincronização</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full hover:bg-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Resumo */}
        <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 mb-6 flex items-center gap-4">
          <div className={`p-3 rounded-full ${isSyncing ? 'bg-blue-500/20 text-blue-500' : pendingCount > 0 ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
            {isSyncing ? <RefreshCw className="animate-spin" /> : pendingCount > 0 ? <AlertCircle /> : <CheckCircle2 />}
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Itens pendentes</p>
            <p className="text-lg font-semibold dark:text-white">{pendingCount} transações na fila</p>
          </div>
        </div>

        {/* Ação Principal */}
        <button
          onClick={() => { forceSync(); onClose(); }}
          disabled={isSyncing || pendingCount === 0}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-2xl font-semibold transition-all active:scale-[0.98]"
        >
          {isSyncing ? 'Sincronizando...' : 'Forçar Sincronização Agora'}
        </button>
        
        <p className="text-center text-xs text-gray-400 mt-4">
          Local-First System v3.0 | Status: {isSyncing ? 'Ativo' : 'Aguardando'}
        </p>
      </div>
    </div>
  )
}
