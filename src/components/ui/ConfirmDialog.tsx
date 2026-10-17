'use client'

import { useEffect, useId, useRef } from 'react'
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
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const priorOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()
    return () => {
      document.body.style.overflow = priorOverflow
      previouslyFocused?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!busy) { event.preventDefault(); onCancelRef.current() }
        return
      }
      if (event.key !== 'Tab') return
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? [])
        .filter(el => el.getClientRects().length > 0)
      if (!controls.length) { event.preventDefault(); return }
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, busy])

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
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="app-sheet-panel max-w-md p-5 sm:rounded-[22px] sm:border-b"
      >
        <div className="app-sheet-handle sm:hidden" />
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] ${danger ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' : 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400'}`}>
            {danger ? <AlertTriangle size={21} /> : <CheckCircle2 size={21} />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-slate-800" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="min-h-12 rounded-2xl bg-gray-100 px-4 font-semibold text-gray-700 transition active:scale-[0.98] disabled:opacity-50 dark:bg-slate-800 dark:text-gray-200">
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
