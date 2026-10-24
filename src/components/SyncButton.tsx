'use client'

import {
  AlertTriangle,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  WifiOff
} from 'lucide-react'

import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import {
  getSyncBadgePresentation,
  type BadgeKind
} from '@/lib/syncBadgePresentation'

interface SyncButtonProps {
  pendingCount: number
  isSyncing: boolean
  isOnline: boolean
  hasFinancialOutbox?: boolean
  lastSuccessfulSyncAt?: string | null
  lastSyncError?: string | null
  onSync: () => void
  onClick?: () => void
}

const icons = {
  offline: WifiOff,
  syncing: Loader2,
  error: AlertTriangle,
  pending: RefreshCw,
  verified: ShieldCheck,
  unverified: Clock3
}

const tones: Record<BadgeKind, string> = {
  offline:
    'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
  syncing:
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-900/20 dark:text-sky-300',
  error:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300',
  pending:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300',
  verified:
    'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-900/20 dark:text-teal-300',
  unverified:
    'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
}

export default function SyncButton({
  pendingCount,
  isSyncing,
  isOnline,
  hasFinancialOutbox = false,
  lastSuccessfulSyncAt = null,
  lastSyncError = null,
  onSync,
  onClick
}: SyncButtonProps) {
  const { light } = useHapticFeedback()

  const state = getSyncBadgePresentation({
    pendingCount,
    isSyncing,
    isOnline,
    hasFinancialOutbox,
    lastSuccessfulSyncAt,
    lastSyncError
  })

  const Icon = icons[state.kind]

  const handleClick = () => {
    light()

    if (onClick) {
      onClick()
      return
    }

    if (!isSyncing && isOnline) {
      onSync()
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${state.label}. Abrir detalhes da sincronização`}
      title={state.detail}
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border shadow-sm backdrop-blur-sm transition-all duration-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 motion-reduce:transition-none ${tones[state.kind]}`}
    >
      <Icon
        size={19}
        aria-hidden="true"
        className={
          state.kind === 'syncing'
            ? 'animate-spin motion-reduce:animate-none'
            : ''
        }
      />

      {state.pending > 0 && (
        <span
          aria-hidden="true"
          className={`absolute -right-1 -top-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-white px-0.5 text-[9px] font-bold leading-none text-white shadow-sm dark:border-slate-900 ${
            state.kind === 'error'
              ? 'bg-rose-600'
              : 'bg-amber-600'
          }`}
        >
          {state.pending > 99 ? '99+' : state.pending}
        </span>
      )}

      {state.kind === 'error' && state.pending === 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500 dark:border-slate-900"
        />
      )}
    </button>
  )
}
