'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  WifiOff
} from 'lucide-react'

import { useLocalSync } from '@/hooks/useLocalSync'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { getSyncBadgePresentation } from '@/lib/syncBadgePresentation'
import SyncStatusModal from './SyncStatusModal'

const icons = {
  offline: WifiOff,
  syncing: Loader2,
  error: AlertTriangle,
  pending: RefreshCw,
  verified: ShieldCheck,
  unverified: Clock3
}

export function SyncStatusIndicator() {
  const sync = useLocalSync()
  const { light } = useHapticFeedback()
  const [open, setOpen] = useState(false)

  const status = getSyncBadgePresentation({
    isOnline: sync.isOnline,
    isSyncing: sync.isSyncing,
    pendingCount: sync.pendingCount,
    hasFinancialOutbox: sync.hasFinancialOutbox,
    lastSuccessfulSyncAt: sync.lastSuccessfulSyncAt,
    lastSyncError: sync.lastSyncError
  })

  const Icon = icons[status.kind]

  const tone =
    status.kind === 'error'
      ? 'border-rose-200 text-rose-600 dark:border-rose-900 dark:text-rose-300'
      : status.kind === 'pending'
        ? 'border-amber-200 text-amber-600 dark:border-amber-900 dark:text-amber-300'
        : status.kind === 'verified'
          ? 'border-teal-200 text-teal-600 dark:border-teal-900 dark:text-teal-300'
          : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300'

  return (
    <>
      <button
        type="button"
        title={status.detail}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${status.label}. ${status.detail}. Abrir detalhes da sincronização`}
        onClick={() => {
          light()
          setOpen(true)
        }}
        className={`fixed right-3 top-[calc(4.5rem+var(--safe-area-top))] z-40 flex h-10 w-10 items-center justify-center rounded-2xl border bg-white/95 shadow-md backdrop-blur-xl transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-500 dark:bg-slate-900/95 motion-reduce:transition-none ${tone}`}
      >
        <Icon
          size={19}
          aria-hidden="true"
          className={
            status.kind === 'syncing'
              ? 'animate-spin motion-reduce:animate-none'
              : ''
          }
        />
        {status.pending > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-amber-600 px-1 text-[9px] font-bold text-white"
          >
            {status.pending > 99 ? '99+' : status.pending}
          </span>
        )}
      </button>

      <SyncStatusModal
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
