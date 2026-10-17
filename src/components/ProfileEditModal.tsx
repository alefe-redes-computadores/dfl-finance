'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
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
  const titleId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const latestOnClose = useRef(onClose)
  const latestLoading = useRef(loading)
  latestOnClose.current = onClose
  latestLoading.current = loading
  // DFL_V160_R3_PROFILE_A11Y
  useEffect(() => {
    if (!isOpen) return
    const oldFocus = document.activeElement as HTMLElement | null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !latestLoading.current) { event.preventDefault(); latestOnClose.current() }
      if (event.key === 'Tab' && dialogRef.current) {
        const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])'))
        if (!items.length) return
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus() }
        else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = oldOverflow
      document.removeEventListener('keydown', onKeyDown)
      if (oldFocus?.isConnected) oldFocus.focus()
    }
  }, [isOpen])

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
        className="app-overlay absolute"
        onClick={loading ? undefined : onClose}
      />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="app-modal-panel max-w-sm p-6 animate-in zoom-in-95">
        <h2 id={titleId} className="text-xl font-bold mb-4 dark:text-white">Editar perfil</h2>

        <div className="mb-4">
          <label htmlFor="profile-edit-name" className="text-sm font-medium text-gray-500 mb-1 block">
            Nome
          </label>
          <input
            id="profile-edit-name"
            ref={inputRef}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
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
            <p id={errorId} role="alert" className="text-xs text-red-500 mt-1">
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