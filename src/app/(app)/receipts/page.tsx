'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import {
  ChevronLeft, Search, Trash2, Download, FileText,
  Image as ImageIcon, X, AlertCircle, Upload, RefreshCw,
  ChevronDown, ChevronUp
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/contexts/ToastContext'
import Skeleton from '@/components/Skeleton'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

interface ReceiptFile {
  name: string
  path: string
  url: string
  created_at: string
  size: number
  isImage: boolean
  transaction_id?: string
  transaction_desc?: string
  transaction_date?: string
}

const normalizeReceiptStoragePath = (
  value?: string | null
) => {
  if (!value) return ''

  try {
    const decoded = decodeURIComponent(value)
    const marker = '/receipts/'
    const markerIndex = decoded.indexOf(marker)

    if (markerIndex >= 0) {
      return decoded.slice(markerIndex + marker.length).split('?')[0]
    }

    return decoded
      .replace(/^receipts\//, '')
      .replace(/^\/+/, '')
      .split('?')[0]
  } catch {
    return String(value)
      .replace(/^receipts\//, '')
      .replace(/^\/+/, '')
      .split('?')[0]
  }
}

export default function ReceiptsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { safeUpdate } = useSafeDb()
  const { vibrate, success, error: hapticError } = useHapticFeedback()
  
  const [receipts, setReceipts] = useState<ReceiptFile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'image' | 'pdf'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({})
  const [receiptToDelete, setReceiptToDelete] = useState<ReceiptFile | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  useEffect(() => {
    if (!user?.id) return
    loadReceipts()
  }, [user?.id])

  const loadReceipts = async (showPulse = true) => {
    if (showPulse) setLoadingPulse(true)
    setLoading(true)
    setError('')

    try {
      const { data: files, error: listError } = await supabase
        .storage
        .from('receipts')
        .list(user.id, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' },
        })

      if (listError) {
        setError('Erro ao carregar comprovantes. Verifique as permissões do bucket.')
        setReceipts([])
        setLoading(false)
        setLoadingPulse(false)
        return
      }

      if (!files || files.length === 0) {
        setReceipts([])
        setLoading(false)
        setLoadingPulse(false)
        return
      }

      const receiptsData: ReceiptFile[] = await Promise.all(files.map(async file => {
        const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.name)
        const filePath = `${user.id}/${file.name}`

        const { data: signedData, error: signedError } = await supabase
          .storage
          .from('receipts')
          .createSignedUrl(filePath, 3600)

        let url = ''
        if (signedData?.signedUrl) {
          url = signedData.signedUrl
        } else {
          const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filePath)
          if (urlData?.publicUrl) url = urlData.publicUrl
        }

        return {
          name: file.name,
          path: filePath,
          url,
          created_at: file.created_at || new Date().toISOString(),
          size: file.metadata?.size || 0,
          isImage,
        }
      }))

      const txs = await db.transactions
        .where('user_id')
        .equals(user.id)
        .filter((tx) => Boolean(tx.receipt_url))
        .toArray()

      const txMap = new Map<string, any>()

      for (const tx of txs) {
        const receiptPath = normalizeReceiptStoragePath(tx.receipt_url)
        if (receiptPath) txMap.set(receiptPath, tx)
      }

      const enrichedReceipts = receiptsData.map((receipt) => {
        const tx = txMap.get(receipt.path)

        return {
          ...receipt,
          transaction_id: tx?.id,
          transaction_desc: tx?.description,
          transaction_date: tx?.date,
        }
      })

      setReceipts(enrichedReceipts)
    } catch (err: any) {
      console.error('Erro ao carregar comprovantes:', err)
      setError('Erro inesperado ao carregar comprovantes.')
    } finally {
      setLoading(false)
      setLoadingPulse(false)
      setRefreshing(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      hapticError()
      showToast('Formato não suportado. Use JPG, PNG, WEBP ou PDF.', 'warning')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      hapticError()
      showToast('Arquivo muito grande (máx 5MB).', 'warning')
      return
    }

    setUploading(true)
    setLoadingPulse(true)

    try {
      const filePath = `${user.id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      success()
      showToast('Arquivo enviado. Você pode vinculá-lo a uma transação depois.', 'success')
      loadReceipts(false)
    } catch (error: any) {
      hapticError()
      showToast(`Erro ao enviar: ${error.message}`, 'error')
    } finally {
      setUploading(false)
      setLoadingPulse(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = (receipt: ReceiptFile) => {
    vibrate([10])
    setReceiptToDelete(receipt)
  }

  const confirmDeleteReceipt = async () => {
    if (!user?.id || !receiptToDelete) return

    const receipt = receiptToDelete

    try {
      const { error: deleteError } = await supabase.storage
        .from('receipts')
        .remove([receipt.path])

      if (deleteError) throw deleteError

      if (receipt.transaction_id) {
        const result = await safeUpdate(
          'transactions',
          receipt.transaction_id,
          {
            receipt_url: null,
            updated_at: new Date().toISOString(),
          }
        )

        if (!result.success) {
          throw new Error(
            result.error ||
              'O arquivo foi removido, mas o vínculo da transação não pôde ser atualizado.'
          )
        }
      }

      success()
      showToast('Comprovante excluído.', 'success')
      setReceiptToDelete(null)
      loadReceipts(false)
    } catch (err: any) {
      hapticError()
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    }
  }

  const handleDownload = (receipt: ReceiptFile) => {
    vibrate([10])
    window.open(receipt.url, '_blank')
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const toggleExpand = (id: string) => {
    vibrate([5])
    setExpandedId(prev => prev === id ? null : id)
  }

  const filteredReceipts = useMemo(
    () =>
      receipts.filter((receipt) => {
        const matchesSearch =
          !search ||
          receipt.name.toLowerCase().includes(search.toLowerCase())

        const matchesFilter =
          filter === 'all' ||
          (filter === 'image' ? receipt.isImage : !receipt.isImage)

        return matchesSearch && matchesFilter
      }),
    [filter, receipts, search]
  )

  const totalImages = useMemo(
    () => receipts.filter((receipt) => receipt.isImage).length,
    [receipts]
  )

  const totalPdfs = receipts.length - totalImages

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 10 || loading) return
      pullStartY.current = e.touches[0].clientY
      isPulling.current = true
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || refreshing) return
      const distance = e.touches[0].clientY - pullStartY.current
      if (distance > 60) {
        setRefreshing(true)
        isPulling.current = false
        vibrate([10])
        loadReceipts(false)
      }
    }

    const onTouchEnd = () => { isPulling.current = false }

    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', onTouchMove, { passive: true })
    container.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
    }
  }, [loading, refreshing, vibrate])

  return (
    <div
      ref={containerRef}
      className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300"
    >
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-sm rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200/70 dark:border-slate-700">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-semibold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* HEADER UNIFICADO */}
      <div className="sticky top-0 z-30 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => { vibrate([5]); router.back(); }}
                className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98] shrink-0"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="text-[22px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                  Comprovantes
                  {!loading && receipts.length > 0 && (
                    <span className="text-gray-400 dark:text-gray-500 font-medium"> ({filteredReceipts.length})</span>
                  )}
                </h1>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Arquivos anexados e arquivos avulsos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { vibrate([10]); fileInputRef.current?.click(); }}
                className="h-11 w-11 rounded-[18px] bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98]"
                title="Enviar comprovante"
              >
                <Upload size={18} />
              </button>
              <button
                onClick={() => { vibrate([10]); loadReceipts(true); }}
                className="h-11 w-11 rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 text-gray-500 dark:text-gray-300 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          <div className="mb-3">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome..."
                className="w-full rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 pl-11 pr-10 py-3 text-[14px] text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none focus:ring-2 focus:ring-teal-500/20 transition-all"
              />
              {search && (
                <button
                  onClick={() => { vibrate([5]); setSearch(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {[
              { id: 'all', label: 'Todos', count: receipts.length },
              { id: 'image', label: 'Imagens', count: totalImages },
              { id: 'pdf', label: 'PDFs', count: totalPdfs },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => { vibrate([5]); setFilter(f.id as any); }}
                className={`h-10 px-3.5 rounded-[18px] border whitespace-nowrap shrink-0 text-[13px] font-semibold transition-colors active:scale-[0.98] ${
                  filter === f.id
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200/70 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 animate-in fade-in duration-300">
        {loading ? (
          <div className="space-y-2.5">
            <Skeleton variant="card" height="88px" count={4} />
          </div>
        ) : error ? (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-[20px] flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-red-500" />
            </div>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-6 px-6">{error}</p>
            <button
              onClick={() => { vibrate([10]); loadReceipts(true); }}
              className="bg-teal-600 text-white px-8 py-4 rounded-[20px] font-bold hover:bg-teal-700 transition-transform active:scale-[0.98] shadow-lg shadow-teal-600/20"
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm">
            <div className="w-16 h-16 bg-gray-50 dark:bg-slate-700/50 rounded-[20px] flex items-center justify-center mx-auto mb-4">
              <ImageIcon size={32} className="text-gray-400" />
            </div>

            {receipts.length === 0 ? (
              <>
                <h2 className="text-[16px] font-semibold text-gray-800 dark:text-gray-200 mb-1">
                  Nenhum comprovante
                </h2>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-6 px-6">
                  Os comprovantes que você anexar nas transações aparecerão aqui.
                </p>
                <button
                  onClick={() => { vibrate([10]); fileInputRef.current?.click(); }}
                  className="bg-teal-600 text-white px-8 py-4 rounded-[20px] font-bold hover:bg-teal-700 transition-transform active:scale-[0.98] shadow-lg shadow-teal-600/20 inline-flex items-center gap-2"
                >
                  <Upload size={18} />
                  Enviar arquivo
                </button>
              </>
            ) : search ? (
              <p className="text-[14px] text-gray-500 dark:text-gray-400">
                Sem resultados para <span className="font-semibold text-gray-800 dark:text-gray-200">"{search}"</span>
              </p>
            ) : filter !== 'all' ? (
              <p className="text-[14px] text-gray-500 dark:text-gray-400">
                Nenhum{filter === 'image' ? 'a imagem' : ' PDF'} encontrado.
              </p>
            ) : (
              <p className="text-[14px] text-gray-500 dark:text-gray-400">
                Nenhum comprovante encontrado.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredReceipts.map(receipt => {
              const hasError = imgErrors[receipt.url] || false
              const isExpanded = expandedId === receipt.name

              return (
                <div
                  key={receipt.name}
                  className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2"
                >
                  <div className="rounded-[18px] p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-12 h-12 rounded-[14px] overflow-hidden bg-gray-50 dark:bg-slate-900 flex-shrink-0 cursor-pointer flex items-center justify-center border border-gray-200/70 dark:border-slate-700"
                        onClick={() => {
                          if (receipt.isImage && !hasError) {
                            toggleExpand(receipt.name)
                          } else {
                            handleDownload(receipt)
                          }
                        }}
                      >
                        {receipt.isImage && !hasError ? (
                          <img
                            src={receipt.url}
                            alt={receipt.name}
                            className="w-full h-full object-cover"
                            onError={() => {
                              setImgErrors(prev => ({ ...prev, [receipt.url]: true }))
                            }}
                          />
                        ) : receipt.isImage ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                            <ImageIcon size={18} className="opacity-50" />
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 dark:bg-red-500/10 text-red-500">
                            <FileText size={20} />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {receipt.name}
                        </p>
                        <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                          {format(new Date(receipt.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • {formatFileSize(receipt.size)}
                        </p>

                        {receipt.transaction_desc && (
                          <p className="text-[11px] font-medium text-teal-700 dark:text-teal-400 mt-1 truncate inline-flex items-center rounded-full bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5">
                            Vinculado: {receipt.transaction_desc}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {receipt.isImage && !hasError && (
                          <button
                            onClick={() => toggleExpand(receipt.name)}
                            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors active:scale-[0.95]"
                            title={isExpanded ? 'Recolher' : 'Expandir'}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDownload(receipt)}
                            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors active:scale-[0.95]"
                            title="Download"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(receipt)}
                            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-[0.95]"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {isExpanded && receipt.isImage && !hasError && (
                      <div className="mt-3 rounded-[16px] overflow-hidden border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 animate-in slide-in-from-top-2 duration-200">
                        <img
                          src={receipt.url}
                          alt={receipt.name}
                          className="w-full max-h-72 object-contain"
                          onError={() => {
                            setImgErrors(prev => ({ ...prev, [receipt.url]: true }))
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {receiptToDelete &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setReceiptToDelete(null)}
          >
            <div
              className="w-full max-w-lg rounded-t-[32px] bg-white p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-2xl dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-6 h-1.5 w-11 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/30">
                  <Trash2 size={24} />
                </div>
                <h2 className="text-[18px] font-bold text-slate-900 dark:text-slate-100">
                  Excluir comprovante?
                </h2>
                <p className="mx-auto mt-2 max-w-[320px] text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                  O arquivo será removido. Se estiver vinculado a uma transação, o vínculo também será limpo.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setReceiptToDelete(null)}
                  className="flex-1 rounded-[20px] bg-slate-100 px-4 py-3.5 text-[14px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteReceipt}
                  className="flex-1 rounded-[20px] bg-red-500 px-4 py-3.5 text-[14px] font-bold text-white"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleUpload}
        className="hidden"
        disabled={uploading}
      />
    </div>
  )
}