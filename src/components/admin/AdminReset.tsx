// src/components/admin/AdminReset.tsx
'use client'

import { Trash2 } from 'lucide-react'
import { db } from '@/lib/db'

export function AdminReset() {
  const handleReset = async () => {
    if (confirm('Você tem certeza? Isso apagará TODO o banco local (Dexie).')) {
      await db.delete() // Deleta o banco IndexedDB
      window.location.reload() // Recarrega para reconstruir tudo
    }
  }

  return (
    <button 
      onClick={handleReset}
      className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-200 dark:border-red-900/50"
    >
      <span className="font-semibold">Resetar Banco Local</span>
      <Trash2 size={18} />
    </button>
  )
}
