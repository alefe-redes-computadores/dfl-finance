'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Search, Trash2, Eye, Download, FileText,
  Image as ImageIcon, X, AlertCircle, Upload, RefreshCw,
  ChevronDown, ChevronUp
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/contexts/ToastContext'
import Skeleton from '@/components/Skeleton'
import { useSafeDb } from '@/hooks/useSafeDb'

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
      showToast('Formato não suportado. Use JPG, PNG, WEBP ou PDF.', 'warning')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
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

      showToast('Comprovante enviado com sucesso!', 'success')
      loadReceipts(false)
    } catch (error: any) {
      showToast(`Erro ao enviar: ${error.message}`, 'error')
    } finally {
      setUploading(false)
      setLoadingPulse(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (receipt: ReceiptFile) => {
    if (!confirm(`Excluir o comprovante "${receipt.name}"?`)) return

    try {
      // 1. Apaga a imagem real do Storage (Nuvem)
      const path = `${user.id}/${receipt.name}`
      const { error: deleteError } = await supabase.storage.from('receipts').remove([path])
      if (deleteError) throw deleteError

      // 2. 🔥 ATUALIZAÇÃO LOCAL-FIRST DA TRANSAÇÃO
      // Em vez de ir no Supabase, limpa o link da imagem no banco local do celular e joga na fila
      if (receipt.transaction_id) {
        const result = await safeUpdate('transactions', receipt.transaction_id, { 
          receipt_url: null,
          updated_at: new Date().toISOString()
        })
        if (!result.success) throw new Error(result.error)
      }

      showToast('Comprovante excluído.', 'success')
      loadReceipts(false)
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

  const toggleExpand = (id: string) => {
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
  }, [loading, refreshing])

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            Comprovantes {!loading && receipts.length > 0 && `(${filteredReceipts.length})`}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-full transition-colors"
              title="Enviar comprovante"
            >
              <Upload size={20} />
            </button>
            <button
              onClick={() => loadReceipts(true)}
              className="p-2 text-gray-400 hover:text-teal-600 rounded-full transition-colors"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome do arquivo..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl text-sm outline-none text-gray-700 dark:text-gray-300"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          {[
            { id: 'all', label: 'Todos', count: receipts.length },
            { id: 'image', label: 'Imagens', count: totalImages },
            { id: 'pdf', label: 'PDFs', count: totalPdfs },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                filter === f.id
                  ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-700 text-teal-800 dark:text-teal-300'
                  : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton variant="card" height="80px" count={4} />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => loadReceipts(true)}
              className="bg-teal-700 text-white px-6 py-3 rounded-2xl font-bold hover:bg-teal-800 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="text-center py-16">
            <ImageIcon size={56} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            {receipts.length === 0 ? (
              <>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Nenhum comprovante</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Os comprovantes que você anexar nas transações aparecerão aqui.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-teal-700 text-white px-6 py-3 rounded-2xl font-bold hover:bg-teal-800 transition-colors"
                >
                  <Upload size={18} className="inline mr-2" />
                  Enviar comprovante
                </button>
              </>
            ) : search ? (
              <p className="text-gray-500 dark:text-gray-400">
                Nenhum resultado para <span className="font-bold text-gray-700 dark:text-gray-300">"{search}"</span>
              </p>
            ) : filter !== 'all' ? (
              <p className="text-gray-500 dark:text-gray-400">
                Nenhum {filter === 'image' ? 'imagem' : 'PDF'} encontrado.
              </p>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">Nenhum comprovante encontrado.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredReceipts.map(receipt => {
              const hasError = imgErrors[receipt.url] || false
              const isExpanded = expandedId === receipt.name

              return (
                <div
                  key={receipt.name}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-14 h-14 aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-700 flex-shrink-0 cursor-pointer flex items-center justify-center"
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
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-200 dark:bg-slate-600">
                          <ImageIcon size={24} className="opacity-50" />
                          <span className="text-[8px] mt-0.5">Erro</span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/20">
                          <FileText size={24} className="text-red-400" />
                          <span className="text-[8px] font-medium text-gray-500 mt-0.5">PDF</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200 truncate">
                        {receipt.name}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {format(new Date(receipt.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {' • '}
                        {formatFileSize(receipt.size)}
                      </p>
                      {receipt.transaction_desc && (
                        <p className="text-[10px] text-teal-600 dark:text-teal-400 mt-0.5 truncate">
                          Vinculado a: {receipt.transaction_desc}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {receipt.isImage && !hasError && (
                        <button
                          onClick={() => toggleExpand(receipt.name)}
                          className="p-2 text-gray-400 hover:text-teal-600 transition-colors"
                          title={isExpanded ? 'Recolher' : 'Expandir'}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(receipt)}
                        className="p-2 text-gray-400 hover:text-teal-600 transition-colors"
                        title="Download"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(receipt)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && receipt.isImage && !hasError && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700">
                      <img
                        src={receipt.url}
                        alt={receipt.name}
                        className="w-full max-h-64 object-contain bg-gray-50 dark:bg-slate-900"
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
