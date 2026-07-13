'use client'
import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'

export function ProfileEditModal({ isOpen, onClose, user, onUpdate }) {
  const [name, setName] = useState(user?.name || '')
  const [loading, setLoading] = useState(false)
  const isGoogle = user?.app_metadata?.provider === 'google' // Lógica para bloquear edição de nome

  const handleSave = async () => {
    setLoading(true)
    // Atualiza nome no Supabase
    await supabase.auth.updateUser({ data: { name: name } })
    onUpdate() // Função para recarregar o dado na tela
    setLoading(false)
    onClose()
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95">
        <h2 className="text-xl font-bold mb-4 dark:text-white">Editar Perfil</h2>
        
        {/* Nome (Bloqueado se for Google) */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-500 mb-1 block">Nome</label>
          <input 
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isGoogle}
            className="w-full p-3 rounded-xl border dark:bg-slate-700 dark:border-slate-600"
          />
          {isGoogle && <p className="text-xs text-amber-500 mt-1">Conta Google: nome gerenciado pelo Google.</p>}
        </div>

        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold"
        >
          {loading ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>,
    document.body
  )
}
