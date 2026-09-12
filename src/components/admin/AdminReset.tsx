// src/components/admin/AdminReset.tsx
'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { db } from '@/lib/db'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

export function AdminReset() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  const handleReset = async () => {
    if (resetting) return
    setResetting(true)
    try {
      await db.delete()
      window.location.reload()
    } finally {
      setResetting(false)
    }
  }

  return (
    <>
    <button 
      onClick={() => setConfirmOpen(true)}
      className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-200 dark:border-red-900/50"
    >
      <span className="font-semibold">Resetar Banco Local</span>
      <Trash2 size={18} />
    </button>
    <ConfirmDialog
      open={confirmOpen}
      title="Resetar banco local?"
      description="Isso apaga os dados locais deste dispositivo. Dados já sincronizados poderão ser baixados novamente, mas alterações locais ainda não sincronizadas podem ser perdidas."
      confirmLabel="Resetar banco"
      tone="danger"
      busy={resetting}
      onCancel={() => !resetting && setConfirmOpen(false)}
      onConfirm={handleReset}
    />
    </>
  )
}
