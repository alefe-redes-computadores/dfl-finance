'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, busy, onCancel])

  if (!open || typeof document === 'undefined') return null

  const danger = tone === 'danger'

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <button
        type="button"
        aria-label="Fechar confirmação"
        className="app-overlay absolute bg-black/60"
        onClick={() => !busy && onCancel()}
      />
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="app-sheet-panel max-w-md p-5 sm:rounded-[28px] sm:border-b"
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700 sm:hidden" />
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${danger ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' : 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400'}`}>
            {danger ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
            <p id="confirm-dialog-description" className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-slate-800" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-12 rounded-2xl bg-gray-100 px-4 font-semibold text-gray-700 transition active:scale-[0.98] disabled:opacity-50 dark:bg-slate-800 dark:text-gray-200">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`min-h-12 rounded-2xl px-4 font-semibold text-white transition active:scale-[0.98] disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-700 hover:bg-teal-800 dark:bg-teal-600'}`}>
            {busy ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body
  )
}
