'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Loader2,
  WifiOff,
  X
} from 'lucide-react'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import {
  getNetworkNotice,
  shouldShowNetworkNotice
} from '@/lib/networkNoticePolicy'

interface NetworkStatusProps {
  isOnline: boolean
  pendingCount: number
  isSyncing?: boolean
}

const tone = {
  offline: {
    bar: 'border-rose-200 bg-rose-50/95 text-rose-800 dark:border-rose-900 dark:bg-rose-950/95 dark:text-rose-200',
    icon: WifiOff
  },
  pending: {
    bar: 'border-amber-200 bg-amber-50/95 text-amber-800 dark:border-amber-900 dark:bg-amber-950/95 dark:text-amber-200',
    icon: AlertTriangle
  },
  syncing: {
    bar: 'border-sky-200 bg-sky-50/95 text-sky-800 dark:border-sky-900 dark:bg-sky-950/95 dark:text-sky-200',
    icon: Loader2
  }
}

export default function NetworkStatus({
  isOnline,
  pendingCount,
  isSyncing = false
}: NetworkStatusProps) {
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const { light } = useHapticFeedback()

  const notice = getNetworkNotice({
    isOnline,
    pendingCount,
    isSyncing
  })

  if (!shouldShowNetworkNotice(notice, dismissedKey) || !notice) {
    return null
  }

  const visual = tone[notice.kind]
  const Icon = visual.icon

  return (
    <div
      role={notice.kind === 'offline' ? 'alert' : 'status'}
      aria-live={notice.kind === 'offline' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[300] mx-auto max-w-lg motion-reduce:transition-none"
    >
      <div className={`pointer-events-auto flex min-h-14 items-center gap-3 rounded-[20px] border px-3 py-2 shadow-[0_12px_36px_rgba(15,23,42,0.13)] backdrop-blur-xl ${visual.bar}`}>
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-white/70 dark:bg-white/10"
        >
          <Icon
            size={18}
            className={notice.kind === 'syncing' ? 'animate-spin motion-reduce:animate-none' : ''}
          />
        </span>

        <p className="min-w-0 flex-1 text-[11px] font-semibold leading-4">
          {notice.message}
        </p>

        <button
          type="button"
          aria-label="Dispensar aviso de conexão"
          onClick={() => {
            light()
            setDismissedKey(notice.key)
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] transition-colors hover:bg-black/5 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current motion-reduce:transition-none dark:hover:bg-white/10"
        >
          <X size={17} aria-hidden="true"/>
        </button>
      </div>
    </div>
  )
}
