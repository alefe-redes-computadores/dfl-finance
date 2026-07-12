'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
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
  url: string
  created_at: string
  size: number
  isImage: boolean
  transaction_id?: string
  transaction_desc?: string
  transaction_date?: string
}

export default function ReceiptsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { safeDelete, safeUpdate, safeAdd } = useSafeDb()
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
          url,
          created_at: file.created_at || new Date().toISOString(),
          size: file.metadata?.size || 0,
          isImage,
        }
      }))

      const { data: txs } = await supabase
        .from('transactions')
        .select('id, receipt_url, description, date')
        .eq('user_id', user.id)
        .not('receipt_url', 'is', null)
        .order('date', { ascending: false })

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
      showToast('✅ Comprovante enviado com sucesso!', 'success')
      loadReceipts(false)
    } catch (error: any) {
      hapticError()
      showToast(`❌ Erro ao enviar: ${error.message}`, 'error')
    } finally {
      setUploading(false)
      setLoadingPulse(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (receipt: ReceiptFile) => {
    vibrate([10])
    if (!confirm(`Deseja excluir o comprovante "${receipt.name}"?`)) return

    try {
      const path = `${user.id}/${receipt.name}`
      const { error: deleteError } = await supabase.storage.from('receipts').remove([path])
      if (deleteError) throw deleteError

      if (receipt.transaction_id) {
        const result = await safeUpdate('transactions', receipt.transaction_id, { 
          receipt_url: null,
          updated_at: new Date().toISOString()
        })
        if (!result.success) throw new Error(result.error)
      }

      success()
      showToast('🗑️ Comprovante excluído.', 'success')
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

  const filteredReceipts = receipts.filter(r => {
    const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'image' ? r.isImage : !r.isImage)
    return matchesSearch && matchesFilter
  })

  const totalImages = receipts.filter(r => r.isImage).length
  const totalPdfs = receipts.filter(r => !r.isImage).length

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
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
        </div>
      )}

      {/* Header Premium com Glassmorphism */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl px-4 pt-6 pb-4 shadow-sm border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { vibrate([5]); router.back(); }} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 active:scale-95 transition-transform">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">
            Comprovantes {!loading && receipts.length > 0 && <span className="text-gray-400 font-medium">({filteredReceipts.length})</span>}
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { vibrate([10]); fileInputRef.current?.click(); }}
              className="p-2.5 text-teal-600 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 rounded-full transition-all active:scale-95"
              title="Enviar comprovante"
            >
              <Upload size={18} />
            </button>
            <button
              onClick={() => { vibrate([10]); loadReceipts(true); }}
              className="p-2.5 text-gray-400 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-all active:scale-95"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="w-full pl-11 pr-10 py-3 bg-gray-100 dark:bg-slate-800/80 border border-transparent focus:border-teal-500 rounded-[20px] text-[14px] font-medium outline-none text-gray-800 dark:text-gray-200 transition-all"
          />
          {search && (
            <button onClick={() => { vibrate([5]); setSearch(''); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 bg-gray-200 dark:bg-slate-700 rounded-full p-0.5">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
          {[
            { id: 'all', label: 'Todos', count: receipts.length },
            { id: 'image', label: 'Imagens', count: totalImages },
            { id: 'pdf', label: 'PDFs', count: totalPdfs },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => { vibrate([5]); setFilter(f.id as any); }}
              className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all whitespace-nowrap active:scale-95 ${
                filter === f.id
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 animate-in fade-in duration-300">
        {loading ? (
          <div className="space-y-3">
            <Skeleton variant="card" height="88px" count={4} />
          </div>
        ) : error ? (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-[32px] mt-2 border border-gray-100 dark:border-slate-700/50">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-[24px] flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-red-500" />
            </div>
            <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400 mb-6 px-6">{error}</p>
            <button
              onClick={() => { vibrate([10]); loadReceipts(true); }}
              className="bg-teal-600 text-white px-8 py-4 rounded-[24px] font-bold hover:bg-teal-700 transition-transform active:scale-[0.98] shadow-lg shadow-teal-600/30"
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-[32px] mt-2 border border-gray-100 dark:border-slate-700/50">
            <div className="w-16 h-16 bg-gray-50 dark:bg-slate-700/50 rounded-[24px] flex items-center justify-center mx-auto mb-4">
              <ImageIcon size={32} className="text-gray-400" />
            </div>
            {receipts.length === 0 ? (
              <>
                <h2 className="text-[16px] font-bold text-gray-800 dark:text-gray-200 mb-2">Nenhum comprovante</h2>
                <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-8 px-6">
                  Os comprovantes que você anexar nas transações aparecerão aqui.
                </p>
                <button
                  onClick={() => { vibrate([10]); fileInputRef.current?.click(); }}
                  className="bg-teal-600 text-white px-8 py-4 rounded-[24px] font-bold hover:bg-teal-700 transition-transform active:scale-[0.98] shadow-lg shadow-teal-600/30 inline-flex items-center gap-2"
                >
                  <Upload size={18} />
                  Enviar arquivo
                </button>
              </>
            ) : search ? (
              <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400">
                Sem resultados para <span className="font-bold text-gray-800 dark:text-gray-200">"{search}"</span>
              </p>
            ) : filter !== 'all' ? (
              <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400">
                Nenhum{filter === 'image' ? 'a imagem' : ' PDF'} encontrado.
              </p>
            ) : (
              <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400">Nenhum comprovante encontrado.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReceipts.map(receipt => {
              const hasError = imgErrors[receipt.url] || false
              const isExpanded = expandedId === receipt.name

              return (
                <div
                  key={receipt.name}
                  className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-[16px] overflow-hidden bg-gray-50 dark:bg-slate-700/50 flex-shrink-0 cursor-pointer flex items-center justify-center border border-gray-100 dark:border-slate-600"
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
                          className="w-full h-full object-cover transition-transform hover:scale-110"
                          onError={() => {
                            setImgErrors(prev => ({ ...prev, [receipt.url]: true }))
                          }}
                        />
                      ) : receipt.isImage ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                          <ImageIcon size={20} className="opacity-50" />
                          <span className="text-[8px] font-bold uppercase tracking-widest mt-1">Erro</span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 dark:bg-red-500/10 text-red-500">
                          <FileText size={22} />
                          <span className="text-[8px] font-bold uppercase tracking-widest mt-1">PDF</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 py-1">
                      <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate">
                        {receipt.name}
                      </p>
                      <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                        {format(new Date(receipt.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {' • '}
                        {formatFileSize(receipt.size)}
                      </p>
                      {receipt.transaction_desc && (
                        <p className="text-[11px] font-bold text-teal-600 dark:text-teal-400 mt-1 truncate bg-teal-50 dark:bg-teal-900/20 inline-block px-2 py-0.5 rounded-md">
                          Vinculado: {receipt.transaction_desc}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {receipt.isImage && !hasError && (
                        <button
                          onClick={() => toggleExpand(receipt.name)}
                          className="p-2 text-gray-400 hover:text-teal-600 bg-gray-50 dark:bg-slate-700/50 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-full transition-all active:scale-90"
                          title={isExpanded ? 'Recolher' : 'Expandir'}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      )}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDownload(receipt)}
                          className="p-2 text-gray-400 hover:text-blue-500 bg-gray-50 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-all active:scale-90"
                          title="Download"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(receipt)}
                          className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-slate-700/50 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-full transition-all active:scale-90"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && receipt.isImage && !hasError && (
                    <div className="mt-4 rounded-[16px] overflow-hidden border border-gray-100 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-900 animate-in slide-in-from-top-2 duration-200">
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
              )
            })}
          </div>
        )}
      </div>

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
