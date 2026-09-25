'use client'

/* eslint-disable @next/next/no-img-element */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Landmark,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import Skeleton from '@/components/Skeleton'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { useToast } from '@/contexts/ToastContext'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import {
  buildReceiptSmartName,
  buildReceiptStorageName,
  getReceiptExtension,
  getReceiptKind,
  getReceiptStoragePath,
  normalizeReceiptDisplayName,
} from '@/lib/receiptPresentation'

type ReceiptFilter = 'all' | 'image' | 'pdf'
type LinkFilter = 'all' | 'linked' | 'loose'

interface ReceiptFile {
  name: string
  path: string
  url: string
  created_at: string
  size: number
  kind: 'image' | 'pdf' | 'file'
  transaction_id?: string
  transaction_desc?: string
  transaction_date?: string
  transaction_amount?: number
  account_name?: string
  bank_name?: string
  display_name: string
  smart_name: string
  extension: string
}

const formatMoney = (value?: number) =>
  typeof value === 'number'
    ? Math.abs(value).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
    : ''

const formatFileSize = (bytes: number) => {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ReceiptViewer({
  receipt,
  onClose,
  onOpenTransaction,
  onOpenExternal,
}: {
  receipt: ReceiptFile
  onClose: () => void
  onOpenTransaction: () => void
  onOpenExternal: () => void
}) {
  const [zoom, setZoom] = useState(1)
  const [origin, setOrigin] = useState({ x: 50, y: 50 })
  const lastDistance = useRef<number | null>(null)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const clampZoom = (value: number) => Math.min(4, Math.max(1, value))

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) return

    const [a, b] = [event.touches[0], event.touches[1]]
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)

    if (lastDistance.current != null) {
      const delta = distance / lastDistance.current
      setZoom((current) => clampZoom(current * delta))
    }

    lastDistance.current = distance
  }

  const handleTouchEnd = () => {
    lastDistance.current = null
  }

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setOrigin({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    })
    setZoom((current) => (current > 1 ? 1 : 2.25))
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200000] flex flex-col bg-slate-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`Visualizar ${receipt.display_name}`}
    >
      <div className="flex items-center gap-3 border-b border-white/10 bg-black/30 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 active:scale-[0.97]"
          aria-label="Fechar visualizador"
        >
          <X size={20} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{receipt.display_name}</p>
          <p className="mt-0.5 truncate text-[11px] text-white/55">
            {receipt.extension ? receipt.extension.toUpperCase() : 'ARQUIVO'}
            {' • '}
            {formatFileSize(receipt.size)}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenExternal}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 active:scale-[0.97]"
          aria-label="Abrir ou salvar arquivo"
        >
          <Download size={18} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {receipt.kind === 'image' ? (
          <>
            <div
              className="flex h-full w-full touch-none items-center justify-center overflow-auto p-3"
              onDoubleClick={handleDoubleClick}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={receipt.url}
                alt={receipt.display_name}
                draggable={false}
                className="max-h-full max-w-full select-none object-contain transition-transform duration-150"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: `${origin.x}% ${origin.y}%`,
                }}
              />
            </div>

            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/60 p-1.5 shadow-xl backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setZoom((value) => clampZoom(value - 0.5))}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 active:bg-white/10"
                aria-label="Diminuir zoom"
              >
                <Minus size={18} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="min-w-14 rounded-full px-2 py-2 text-[12px] font-semibold text-white/80 active:bg-white/10"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((value) => clampZoom(value + 0.5))}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 active:bg-white/10"
                aria-label="Aumentar zoom"
              >
                <Plus size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className="mx-5 w-full max-w-sm rounded-[28px] border border-white/10 bg-white/[0.06] p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-red-500/15 text-red-300">
              <FileText size={38} />
            </div>
            <h2 className="mt-5 truncate text-[17px] font-semibold">{receipt.display_name}</h2>
            <p className="mt-2 text-[12px] leading-5 text-white/55">
              PDFs são abertos no visualizador do sistema para manter compatibilidade entre PWA e APK.
            </p>
            <button
              type="button"
              onClick={onOpenExternal}
              className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-[18px] bg-white px-5 text-[13px] font-bold text-slate-950 active:scale-[0.98]"
            >
              <ExternalLink size={17} />
              Abrir PDF
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-black/30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md gap-2">
          {receipt.transaction_id && (
            <button
              type="button"
              onClick={onOpenTransaction}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[18px] bg-teal-500 px-4 text-[13px] font-bold text-slate-950 active:scale-[0.98]"
            >
              <ArrowLeft size={17} />
              Abrir lançamento
            </button>
          )}
          <button
            type="button"
            onClick={onOpenExternal}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[18px] bg-white/10 px-4 text-[13px] font-semibold text-white active:scale-[0.98]"
          >
            <Download size={17} />
            Abrir / salvar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function ReceiptsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { safeUpdate } = useSafeDb()
  const { vibrate, success, error: hapticError } = useHapticFeedback()

  const [receipts, setReceipts] = useState<ReceiptFile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ReceiptFilter>('all')
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all')
  const [viewerReceipt, setViewerReceipt] = useState<ReceiptFile | null>(null)
  const [receiptToDelete, setReceiptToDelete] = useState<ReceiptFile | null>(null)
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadReceipts = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    setError('')

    try {
      const { data: files, error: listError } = await supabase.storage
        .from('receipts')
        .list(user.id, {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' },
        })

      if (listError) throw listError

      const rawFiles = files || []

      const [transactions, accounts] = await Promise.all([
        db.transactions
          .where('user_id')
          .equals(user.id)
          .filter((transaction) => Boolean(transaction.receipt_url))
          .toArray(),
        db.accounts.where('user_id').equals(user.id).toArray(),
      ])

      const transactionByPath = new Map<string, any>()
      for (const transaction of transactions) {
        const path = getReceiptStoragePath(transaction.receipt_url)
        if (path) transactionByPath.set(path, transaction)
      }

      const accountById = new Map(
        accounts.map((account: any) => [account.id, account]),
      )

      const hydrated = await Promise.all(
        rawFiles.map(async (file) => {
          const path = `${user.id}/${file.name}`
          const transaction = transactionByPath.get(path)
          const account: any = transaction?.account_id
            ? accountById.get(transaction.account_id)
            : null

          const { data: signedData } = await supabase.storage
            .from('receipts')
            .createSignedUrl(path, 60 * 60)

          let url = signedData?.signedUrl || ''
          if (!url) {
            const { data: publicData } = supabase.storage
              .from('receipts')
              .getPublicUrl(path)
            url = publicData?.publicUrl || ''
          }

          const displayName = normalizeReceiptDisplayName(
            file.name,
            transaction?.description,
          )

          return {
            name: file.name,
            path,
            url,
            created_at: file.created_at || new Date().toISOString(),
            size: Number(file.metadata?.size || 0),
            kind: getReceiptKind(file.name),
            transaction_id: transaction?.id,
            transaction_desc: transaction?.description,
            transaction_date: transaction?.date,
            transaction_amount: transaction?.amount,
            account_name: account?.name,
            bank_name: account?.bank,
            display_name: displayName,
            smart_name: buildReceiptSmartName({
              description: transaction?.description,
              amount: transaction?.amount,
              date: transaction?.date,
              fallbackFileName: file.name,
            }),
            extension: getReceiptExtension(file.name),
          } satisfies ReceiptFile
        }),
      )

      setReceipts(hydrated)
    } catch (loadError) {
      console.error('Erro ao carregar comprovantes:', loadError)
      setError('Não foi possível carregar seus comprovantes.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadReceipts()
  }, [loadReceipts])

  const handleRefresh = async () => {
    vibrate([8])
    setRefreshing(true)
    await loadReceipts()
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user?.id) return

    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]

    if (!validTypes.includes(file.type)) {
      hapticError()
      showToast('Use JPG, PNG, WEBP ou PDF.', 'warning')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      hapticError()
      showToast('O comprovante deve ter no máximo 10 MB.', 'warning')
      return
    }

    setUploading(true)

    try {
      const path = `${user.id}/${buildReceiptStorageName(file)}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) throw uploadError

      success()
      showToast('Comprovante adicionado.', 'success')
      await loadReceipts()
    } catch (uploadError: any) {
      hapticError()
      showToast(
        uploadError?.message
          ? `Erro ao enviar: ${uploadError.message}`
          : 'Erro ao enviar comprovante.',
        'error',
      )
    } finally {
      setUploading(false)
    }
  }

  const openExternal = async (receipt: ReceiptFile) => {
    vibrate([8])

    try {
      const { Capacitor } = await import('@capacitor/core')

      if (Capacitor.isNativePlatform()) {
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({ url: receipt.url })
        return
      }

      const anchor = document.createElement('a')
      anchor.href = receipt.url
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      anchor.download = `${receipt.display_name}${receipt.extension ? `.${receipt.extension}` : ''}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    } catch (openError) {
      console.error('Erro ao abrir comprovante:', openError)
      showToast('Não foi possível abrir o comprovante.', 'error')
    }
  }

  const openTransaction = (receipt: ReceiptFile) => {
    if (!receipt.transaction_id) return
    setViewerReceipt(null)
    vibrate([8])
    router.push(
      `/transactions/details?id=${encodeURIComponent(receipt.transaction_id)}`,
    )
  }

  const confirmDeleteReceipt = async () => {
    if (!receiptToDelete?.path) return

    const receipt = receiptToDelete
    setReceiptToDelete(null)

    try {
      if (receipt.transaction_id) {
        const result = await safeUpdate(
          'transactions',
          receipt.transaction_id,
          {
            receipt_url: null,
            updated_at: new Date().toISOString(),
          },
        )

        if (!result.success) {
          throw new Error(
            result.error ||
              'Não foi possível limpar o vínculo com o lançamento.',
          )
        }
      }

      const { error: deleteError } = await supabase.storage
        .from('receipts')
        .remove([receipt.path])

      if (deleteError) {
        // O vínculo já foi removido com segurança. Se o Storage falhar,
        // o arquivo permanece apenas como avulso e pode ser removido depois.
        throw new Error(
          'O vínculo foi removido, mas o arquivo ainda está no armazenamento. Atualize a Central e tente excluir o avulso novamente.',
        )
      }

      success()
      showToast('Comprovante excluído.', 'success')
      await loadReceipts()
    } catch (deleteError: any) {
      hapticError()
      showToast(
        deleteError?.message || 'Erro ao excluir comprovante.',
        'error',
      )
    }
  }

  const filteredReceipts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR')

    return receipts.filter((receipt) => {
      const typeMatches =
        filter === 'all' ||
        (filter === 'image' && receipt.kind === 'image') ||
        (filter === 'pdf' && receipt.kind === 'pdf')

      const linkMatches =
        linkFilter === 'all' ||
        (linkFilter === 'linked' && Boolean(receipt.transaction_id)) ||
        (linkFilter === 'loose' && !receipt.transaction_id)

      const haystack = [
        receipt.display_name,
        receipt.smart_name,
        receipt.transaction_desc,
        receipt.account_name,
        receipt.bank_name,
        receipt.transaction_date,
        formatMoney(receipt.transaction_amount),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')

      return typeMatches && linkMatches && (!query || haystack.includes(query))
    })
  }, [filter, linkFilter, receipts, search])

  const groupedReceipts = useMemo(() => {
    const groups = new Map<string, ReceiptFile[]>()

    for (const receipt of filteredReceipts) {
      const sourceDate =
        receipt.transaction_date || receipt.created_at.slice(0, 10)
      const key = sourceDate.slice(0, 7)
      const current = groups.get(key) || []
      current.push(receipt)
      groups.set(key, current)
    }

    return Array.from(groups.entries()).sort(([a], [b]) =>
      b.localeCompare(a),
    )
  }, [filteredReceipts])

  const totalImages = receipts.filter((item) => item.kind === 'image').length
  const totalPdfs = receipts.filter((item) => item.kind === 'pdf').length
  const linkedCount = receipts.filter((item) => item.transaction_id).length

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#f8f9fa] pb-28 font-sans dark:bg-slate-900">
      <header className="sticky top-0 z-30 border-b border-gray-200/60 bg-[#f8f9fa]/94 px-4 pb-3 pt-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/94">
        <div className="rounded-[26px] border border-gray-200/70 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/95">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] border border-gray-200/70 bg-gray-50 text-gray-500 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900/50 dark:text-gray-300"
              aria-label="Voltar"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="text-[21px] font-bold tracking-tight text-gray-950 dark:text-white">
                Comprovantes
              </h1>
              <p className="mt-0.5 text-[11px] text-gray-400">
                Seu arquivo financeiro pesquisável
              </p>
            </div>

            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] bg-teal-600 text-white shadow-lg shadow-teal-600/20 active:scale-[0.98] disabled:opacity-50"
              aria-label="Adicionar comprovante"
            >
              <Upload size={18} />
            </button>

            <button
              type="button"
              disabled={refreshing}
              onClick={handleRefresh}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] border border-gray-200/70 bg-gray-50 text-gray-500 active:scale-[0.98] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/50 dark:text-gray-300"
              aria-label="Atualizar"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="relative mt-4">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar loja, banco, valor ou data"
              className="h-12 w-full rounded-[17px] border border-gray-200 bg-gray-50 pl-11 pr-10 text-[13px] text-gray-900 outline-none transition focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-400"
                aria-label="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {([
              ['all', 'Todos', receipts.length],
              ['image', 'Imagens', totalImages],
              ['pdf', 'PDFs', totalPdfs],
            ] as const).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`h-9 shrink-0 rounded-[15px] border px-3 text-[12px] font-semibold transition active:scale-[0.98] ${
                  filter === id
                    ? 'border-transparent bg-gray-950 text-white dark:bg-white dark:text-slate-950'
                    : 'border-gray-200 bg-white text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300'
                }`}
              >
                {label} {count}
              </button>
            ))}
          </div>

          <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {([
              ['all', 'Todos os vínculos'],
              ['linked', 'Vinculados'],
              ['loose', 'Avulsos'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLinkFilter(id)}
                className={`h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold transition active:scale-[0.98] ${
                  linkFilter === id
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300'
                    : 'bg-transparent text-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleUpload}
        className="hidden"
      />

      <main className="px-4 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            <Skeleton variant="card" height="210px" count={4} />
          </div>
        ) : error ? (
          <div className="rounded-[26px] border border-red-200/60 bg-white p-8 text-center shadow-sm dark:border-red-900/30 dark:bg-slate-800">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-red-50 text-red-500 dark:bg-red-500/10">
              <AlertCircle size={30} />
            </div>
            <p className="mt-4 text-[13px] text-gray-500 dark:text-gray-400">{error}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="mt-5 h-11 rounded-[17px] bg-teal-600 px-5 text-[13px] font-bold text-white"
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="rounded-[26px] border border-gray-200/70 bg-white p-9 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-gray-50 text-gray-400 dark:bg-slate-700/50">
              <ImageIcon size={30} />
            </div>
            <h2 className="mt-4 text-[15px] font-bold text-gray-900 dark:text-white">
              {receipts.length ? 'Nenhum resultado' : 'Nenhum comprovante'}
            </h2>
            <p className="mx-auto mt-1 max-w-[250px] text-[12px] leading-5 text-gray-400">
              {receipts.length
                ? 'Ajuste a busca ou os filtros.'
                : 'Os comprovantes anexados às transações e os arquivos avulsos aparecerão aqui.'}
            </p>
          </div>
        ) : (
          <div className="space-y-7">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[18px] border border-gray-200/70 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-[18px] font-bold text-gray-950 dark:text-white">{receipts.length}</p>
                <p className="text-[10px] text-gray-400">arquivos</p>
              </div>
              <div className="rounded-[18px] border border-gray-200/70 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-[18px] font-bold text-teal-600 dark:text-teal-400">{linkedCount}</p>
                <p className="text-[10px] text-gray-400">vinculados</p>
              </div>
              <div className="rounded-[18px] border border-gray-200/70 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-[18px] font-bold text-amber-600 dark:text-amber-400">{receipts.length - linkedCount}</p>
                <p className="text-[10px] text-gray-400">avulsos</p>
              </div>
            </div>

            {groupedReceipts.map(([month, monthReceipts]) => (
              <section key={month}>
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.09em] text-gray-400">
                    {format(
                      new Date(`${month}-01T12:00:00`),
                      'MMMM yyyy',
                      { locale: ptBR },
                    )}
                  </h2>
                  <span className="text-[10px] text-gray-400">{monthReceipts.length}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {monthReceipts.map((receipt) => {
                    const imageFailed = imageErrors[receipt.path]

                    return (
                      <article
                        key={receipt.path}
                        className="group overflow-hidden rounded-[23px] border border-gray-200/70 bg-white shadow-sm transition active:scale-[0.995] dark:border-slate-700 dark:bg-slate-800"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            vibrate([6])
                            setViewerReceipt(receipt)
                          }}
                          className="relative block aspect-[4/5] w-full overflow-hidden bg-gray-100 text-left dark:bg-slate-900"
                        >
                          {receipt.kind === 'image' && !imageFailed ? (
                            <img
                              src={receipt.url}
                              alt={receipt.display_name}
                              loading="lazy"
                              onError={() =>
                                setImageErrors((current) => ({
                                  ...current,
                                  [receipt.path]: true,
                                }))
                              }
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-50 to-slate-100 text-slate-400 dark:from-slate-900 dark:to-slate-950">
                              <div className={`flex h-16 w-16 items-center justify-center rounded-[22px] ${
                                receipt.kind === 'pdf'
                                  ? 'bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-300'
                                  : 'bg-white text-slate-400 dark:bg-white/5'
                              }`}>
                                {receipt.kind === 'pdf' ? <FileText size={30} /> : <ImageIcon size={30} />}
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-[0.12em]">
                                {receipt.extension || 'arquivo'}
                              </span>
                            </div>
                          )}

                          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/65 to-transparent" />

                          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between gap-2">
                            <span className="rounded-full bg-black/45 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-md">
                              {receipt.kind === 'image' ? 'Imagem' : receipt.extension.toUpperCase()}
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md">
                              {receipt.kind === 'image' ? <Maximize2 size={14} /> : <ExternalLink size={14} />}
                            </span>
                          </div>
                        </button>

                        <div className="p-3">
                          <p className="line-clamp-2 min-h-[38px] text-[13px] font-bold leading-[19px] text-gray-900 dark:text-white">
                            {receipt.display_name}
                          </p>

                          <div className="mt-2 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                              <CalendarDays size={12} />
                              <span className="truncate">
                                {receipt.transaction_date
                                  ? format(
                                      new Date(`${receipt.transaction_date}T12:00:00`),
                                      'dd MMM yyyy',
                                      { locale: ptBR },
                                    )
                                  : format(new Date(receipt.created_at), 'dd MMM yyyy', { locale: ptBR })}
                              </span>
                              {receipt.transaction_amount != null && (
                                <>
                                  <span>•</span>
                                  <span className="truncate font-semibold text-gray-600 dark:text-gray-300">
                                    {formatMoney(receipt.transaction_amount)}
                                  </span>
                                </>
                              )}
                            </div>

                            {(receipt.bank_name || receipt.account_name) && (
                              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                <Landmark size={12} />
                                <span className="truncate">
                                  {receipt.bank_name || receipt.account_name}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewerReceipt(receipt)}
                              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[14px] bg-gray-950 px-2 text-[10px] font-bold text-white active:scale-[0.98] dark:bg-white dark:text-slate-950"
                            >
                              <ZoomIn size={13} />
                              Visualizar
                            </button>

                            <button
                              type="button"
                              onClick={() => setReceiptToDelete(receipt)}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-red-50 text-red-500 active:scale-[0.98] dark:bg-red-500/10"
                              aria-label={`Excluir ${receipt.display_name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {viewerReceipt && typeof document !== 'undefined' && (
        <ReceiptViewer
          receipt={viewerReceipt}
          onClose={() => setViewerReceipt(null)}
          onOpenTransaction={() => openTransaction(viewerReceipt)}
          onOpenExternal={() => openExternal(viewerReceipt)}
        />
      )}

      {receiptToDelete && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[210000] flex items-end justify-center bg-black/55 px-3 backdrop-blur-sm sm:items-center"
            onClick={() => setReceiptToDelete(null)}
            role="presentation"
          >
            <div
              className="w-full max-w-md rounded-t-[28px] border border-gray-200 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[28px] dark:border-slate-700 dark:bg-slate-800"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Excluir comprovante"
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700 sm:hidden" />
              <h3 className="text-[17px] font-bold text-gray-950 dark:text-white">
                Excluir comprovante?
              </h3>
              <p className="mt-2 text-[12px] leading-5 text-gray-500 dark:text-gray-400">
                {receiptToDelete.transaction_id
                  ? 'O arquivo será removido e o vínculo com o lançamento será limpo.'
                  : 'O arquivo avulso será removido permanentemente.'}
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setReceiptToDelete(null)}
                  className="h-12 flex-1 rounded-[17px] bg-gray-100 text-[13px] font-bold text-gray-600 dark:bg-slate-700 dark:text-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteReceipt}
                  className="h-12 flex-1 rounded-[17px] bg-red-500 text-[13px] font-bold text-white"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
