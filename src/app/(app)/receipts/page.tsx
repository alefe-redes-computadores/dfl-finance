'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Search, Trash2, Eye, Download, FileText,
  Image as ImageIcon, X, AlertCircle, RefreshCw, Paperclip,
  Calendar, HardDrive
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/contexts/ToastContext'

interface ReceiptFile {
  name: string
  url: string
  created_at: string
  size: number
  isImage: boolean
  transaction_id?: string
  transaction_desc?: string
  transaction_date?: string
}

// ============================================================
// SKELETON LOADER
// ============================================================
const ReceiptsSkeleton = () => (
  <div className="space-y-2 animate-pulse">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl bg-gray-200 dark:bg-slate-700 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-3.5 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-2.5 w-28 bg-gray-100 dark:bg-slate-700/50 rounded" />
          <div className="h-2.5 w-32 bg-teal-100 dark:bg-teal-900/20 rounded" />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-8 h-8 bg-gray-100 dark:bg-slate-700/50 rounded-full" />
          <div className="w-8 h-8 bg-gray-100 dark:bg-slate-700/50 rounded-full" />
          <div className="w-8 h-8 bg-gray-100 dark:bg-slate-700/50 rounded-full" />
        </div>
      </div>
    ))}
  </div>
)

export default function ReceiptsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [receipts, setReceipts] = useState<ReceiptFile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'image' | 'pdf'>('all')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Pull to refresh
  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY > 10 || loading) return
    pullStartY.current = e.touches[0].clientY
    isPulling.current = true
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const pullDistance = e.touches[0].clientY - pullStartY.current
    if (pullDistance > 60) {
      setRefreshing(true)
      isPulling.current = false
      loadReceipts().finally(() => setRefreshing(false))
    }
  }

  const handleTouchEnd = () => {
    isPulling.current = false
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [loading, refreshing])

  useEffect(() => {
    if (!user?.id) return
    loadReceipts()
  }, [user?.id])

  const loadReceipts = async () => {
    setLoading(true)
    setError('')

    try {
      const { data: files, error: listError } = await supabase
        .storage
        .from('receipts')
        .list(user.id, {
          limit: 50,
          sortBy: { column: 'created_at', order: 'desc' },
        })

      if (listError) {
        setError('Erro ao carregar comprovantes. Verifique as permissões do bucket.')
        setReceipts([])
        setLoading(false)
        return
      }

      if (!files || files.length === 0) {
        setReceipts([])
        setLoading(false)
        return
      }

      const receiptsData: ReceiptFile[] = files.map(file => {
        const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.name)
        const { data: urlData } = supabase
          .storage
          .from('receipts')
          .getPublicUrl(`${user.id}/${file.name}`)

        return {
          name: file.name,
          url: urlData.publicUrl,
          created_at: file.created_at || new Date().toISOString(),
          size: file.metadata?.size || 0,
          isImage,
        }
      })

      const { data: txs } = await supabase
        .from('transactions')
        .select('id, receipt_url, description, date')
        .eq('user_id', user.id)
        .not('receipt_url', 'is', null)
        .order('date', { ascending: false })
        .limit(50)

      const txMap = new Map<string, any>()
      if (txs) {
        txs.forEach(tx => {
          if (tx.receipt_url) {
            txMap.set(tx.receipt_url, tx)
          }
        })
      }

      const enrichedReceipts = receiptsData.map(r => {
        const tx = txMap.get(r.url)
        return {
          ...r,
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
    }
  }

  const handleDelete = async (receipt: ReceiptFile) => {
    if (!confirm(`Excluir o comprovante "${receipt.name}"?`)) return

    try {
      const path = `${user.id}/${receipt.name}`
      const { error: deleteError } = await supabase
        .storage
        .from('receipts')
        .remove([path])

      if (deleteError) throw deleteError

      if (receipt.transaction_id) {
        await supabase
          .from('transactions')
          .update({ receipt_url: null })
          .eq('id', receipt.transaction_id)
      }

      showToast('Comprovante excluído.', 'success')
      loadReceipts()
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    }
  }

  const handleDownload = (receipt: ReceiptFile) => {
    window.open(receipt.url, '_blank')
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const filteredReceipts = receipts.filter(r => {
    const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'image' ? r.isImage : !r.isImage)
    return matchesSearch && matchesFilter
  })

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      
      {/* Pull to refresh */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            Comprovantes {!loading && receipts.length > 0 && `(${filteredReceipts.length})`}
          </h1>
          <div className="w-10" />
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome do arquivo..."
            className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl text-sm outline-none text-gray-700 dark:text-gray-300 focus:border-teal-500 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-2 mt-3">
          {[
            { id: 'all', label: 'Todos', icon: null },
            { id: 'image', label: 'Imagens', icon: <ImageIcon size={12} /> },
            { id: 'pdf', label: 'PDFs', icon: <FileText size={12} /> },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 ${
                filter === f.id
                  ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 shadow-sm'
                  : 'bg-gray-50 dark:bg-slate-700 border border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600'
              }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <ReceiptsSkeleton />
        ) : error ? (
          <div className="text-center py-12 animate-in fade-in duration-300">
            <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={loadReceipts}
              className="bg-teal-700 text-white px-6 py-3 rounded-2xl font-bold hover:bg-teal-800 transition-colors active:scale-95"
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="text-center py-16 animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon size={40} className="text-gray-300 dark:text-gray-600" />
            </div>
            {receipts.length === 0 ? (
              <>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Nenhum comprovante</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Os comprovantes que você anexar nas transações aparecerão aqui.
                </p>
              </>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                Nenhum resultado para "{search}".
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2 animate-in fade-in duration-300">
            {filteredReceipts.map(receipt => (
              <div
                key={receipt.name}
                className="bg-white dark:bg-slate-800 rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-3 hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div
                  className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-700 flex-shrink-0 cursor-pointer relative group"
                  onClick={() => receipt.isImage ? setPreviewUrl(receipt.url) : handleDownload(receipt)}
                >
                  {receipt.isImage ? (
                    <img src={receipt.url} alt={receipt.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
                      <FileText size={24} className="text-red-400" />
                    </div>
                  )}
                  {/* Overlay de hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Eye size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {receipt.isImage ? (
                      <ImageIcon size={12} className="text-blue-500 flex-shrink-0" />
                    ) : (
                      <Paperclip size={12} className="text-red-500 flex-shrink-0" />
                    )}
                    <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200 truncate">
                      {receipt.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Calendar size={10} className="text-gray-400 flex-shrink-0" />
                    <p className="text-[10px] text-gray-400">
                      {format(new Date(receipt.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <HardDrive size={10} className="text-gray-400 flex-shrink-0" />
                    <p className="text-[10px] text-gray-400">
                      {formatFileSize(receipt.size)}
                    </p>
                  </div>
                  {receipt.transaction_desc && (
                    <p className="text-[10px] text-teal-600 dark:text-teal-400 mt-0.5 truncate flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-teal-400 flex-shrink-0" />
                      Vinculado a: {receipt.transaction_desc}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => receipt.isImage ? setPreviewUrl(receipt.url) : handleDownload(receipt)}
                    className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-full transition-colors"
                    title="Visualizar"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => handleDownload(receipt)}
                    className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-full transition-colors"
                    title="Download"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(receipt)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={28} />
          </button>
          <img
            src={previewUrl}
            alt="Preview"
            className="max-w-full max-h-[85vh] object-contain rounded-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}