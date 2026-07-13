'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'

interface ProfileUser {
  name?: string | null
  app_metadata?: {
    provider?: string
  }
}

interface ProfileEditModalProps {
  isOpen: boolean
  onClose: () => void
  user: ProfileUser | null
  onUpdate?: () => void | Promise<void>
}

export function ProfileEditModal({
  isOpen,
  onClose,
  user,
  onUpdate,
}: ProfileEditModalProps) {
  const [mounted, setMounted] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isGoogle = useMemo(
    () => user?.app_metadata?.provider === 'google',
    [user]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setName(user?.name || '')
      setError('')
    }
  }, [isOpen, user?.name])

  const handleSave = async () => {
    if (isGoogle) {
      onClose()
      return
    }

    const trimmedName = name.trim()

    if (!trimmedName) {
      setError('Digite um nome válido.')
      return
    }

    try {
      setLoading(true)
      setError('')

      const { error } = await supabase.auth.updateUser({
        data: { name: trimmedName },
      })

      if (error) {
        setError('Não foi possível salvar seu nome agora.')
        return
      }

      await onUpdate?.()
      onClose()
    } catch {
      setError('Ocorreu um erro ao atualizar o perfil.')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted || !isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
      />
      <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95">
        <h2 className="text-xl font-bold mb-4 dark:text-white">Editar perfil</h2>

        <div className="mb-4">
          <label className="text-sm font-medium text-gray-500 mb-1 block">
            Nome
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isGoogle || loading}
            className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white disabled:opacity-60"
          />
          {isGoogle && (
            <p className="text-xs text-amber-500 mt-1">
              Conta Google: nome gerenciado pelo Google.
            </p>
          )}
          {!!error && (
            <p className="text-xs text-red-500 mt-1">
              {error}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={loading || isGoogle}
          className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold disabled:opacity-50"
        >
          {loading ? 'Salvando...' : isGoogle ? 'Edição indisponível' : 'Salvar alterações'}
        </button>
      </div>
    </div>,
    document.body
  )
}