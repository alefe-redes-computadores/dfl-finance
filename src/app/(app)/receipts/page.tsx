'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, RefreshCw, Upload, Image as ImageIcon, FileText, X,
  Calendar, Search, Filter, Eye, Trash2, Loader2
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
import Image from 'next/image'

// ============================================================
// SKELETON LOADER
// ============================================================
const ReceiptsSkeleton = () => (
  <div className="grid grid-cols-2 gap-3 animate-pulse">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[20px] overflow-hidden shadow-sm border border-gray-50 dark:border-slate-700">
        <div className="aspect-square bg-gray-200 dark:bg-slate-700" />
        <div className="p-3 space-y-2">
          <div className="h-4 w-3/4 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-1/2 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
    ))}
  </div>
)

export default function ReceiptsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  const [receipts, setReceipts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'image' | 'pdf'>('all')
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)

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
  }, [user?.id, context])

  const loadReceipts = async () => {
    setLoading(true)
    setLoadingPulse(true)

    const { data } = await supabase
      .from('receipts')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
      .order('created_at', { ascending: false })

    setReceipts(Array.isArray(data) ? data : [])
    setLoading(false)
    setLoadingPulse(false)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      showToast('Formato não suportado. Use JPG, PNG, WEBP ou PDF.', 'warning')
      return
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Arquivo muito grande (máx 5MB).', 'warning')
      return
    }

    setUploading(true)
    setLoadingPulse(true)

    try {
      const filePath = `receipts/${user?.id}/${Date.now()}_${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath)

      // Salvar no banco
      const { error: insertError } = await supabase
        .from('receipts')
        .insert({
          user_id: user.id,
          context: context,
          file_path: filePath,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          description: file.name,
          uploaded_at: new Date().toISOString(),
        })

      if (insertError) throw insertError

      showToast('Comprovante enviado com sucesso!', 'success')
      loadReceipts()
    } catch (error: any) {
      showToast(`Erro ao enviar: ${error.message}`, 'error')
    } finally {
      setUploading(false)
      setLoadingPulse(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este comprovante?')) return

    try {
      await supabase.from('receipts').delete().eq('id', id)
      showToast('Comprovante removido.', 'info')
      loadReceipts()
    } catch (error: any) {
      showToast(`Erro ao remover: ${error.message}`, 'error')
    }
  }

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <ImageIcon size={16} className="text-blue-500" />
    return <FileText size={16} className="text-red-500" />
  }

  const getFileLabel = (type: string) => {
    if (type.includes('image')) return 'Imagem'
    return 'PDF'
  }

  const getFileColor = (type: string) => {
    if (type.includes('image')) return 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'
    return 'bg-red-50 dark:bg-red-900/30 text-red-600'
  }

  const filteredReceipts = receipts.filter(r => {
    const matchSearch = r.file_name?.toLowerCase().includes(search.toLowerCase()) ||
                        r.description?.toLowerCase().includes(search.toLowerCase()) ||
                        false
    const matchType = filterType === 'all' || 
                      (filterType === 'image' && r.file_type?.includes('image')) ||
                      (filterType === 'pdf' && r.file_type?.includes('pdf'))
    return matchSearch && matchType
  })

  const filterOptions = [
    { key: 'all', label: 'Todos' },
    { key: 'image', label: 'Imagens' },
    { key: 'pdf', label: 'PDFs' },
  ]

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans transition-colors duration-300">
      {/* Indicador de carregamento sutil */}
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {/* Pull to refresh */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/home')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <ImageIcon size={20} className="text-teal-500" />
            Comprovantes
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={loadReceipts}
              className="p-2 text-gray-400 hover:text-teal-600 transition-colors"
            >
              <RefreshCw size={20} className={loadingPulse ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Busca e Filtros */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[16px] px-4 py-2.5 shadow-sm">
            <Search size={18} className="text-gray-400 dark:text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar comprovante..."
              className="flex-1 bg-transparent text-[14px] outline-none text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-500 font-medium"
            />
          </div>
          <div className="flex gap-1 bg-white dark:bg-slate-800 p-1 rounded-full shadow-sm border border-gray-100 dark:border-slate-700">
            {filterOptions.map(f => (
              <button
                key={f.key}
                onClick={() => setFilterType(f.key as any)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                  filterType === f.key
                    ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Upload */}
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-gray-400 dark:text-gray-500">
            {filteredReceipts.length} comprovante{filteredReceipts.length !== 1 ? 's' : ''}
          </p>
          <div className="relative">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleUpload}
              className="hidden"
              id="receipt-upload"
              disabled={uploading}
            />
            <label
              htmlFor="receipt-upload"
              className={`flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-full text-sm font-bold cursor-pointer hover:bg-teal-800 transition-colors active:scale-95 ${
                uploading ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? 'Enviando...' : 'Novo comprovante'}
            </label>
          </div>
        </div>

        {loading ? (
          <ReceiptsSkeleton />
        ) : filteredReceipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <ImageIcon size={40} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">
              {search ? 'Nenhum resultado encontrado' : 'Nenhum comprovante'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[250px]">
              {search 
                ? 'Tente alterar o termo de busca.' 
                : 'Envie comprovantes para organizar suas transações.'}
            </p>
            {!search && (
              <label
                htmlFor="receipt-upload"
                className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors cursor-pointer"
              >
                <Upload size={16} className="inline mr-2" />
                Enviar comprovante
              </label>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-300">
            {filteredReceipts.map(receipt => (
              <div
                key={receipt.id}
                className="bg-white dark:bg-slate-800 rounded-[20px] overflow-hidden shadow-sm border border-gray-50 dark:border-slate-700 hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div 
                  className="aspect-square bg-gray-100 dark:bg-slate-700 relative cursor-pointer group"
                  onClick={() => {
                    setSelectedReceipt(receipt)
                    setShowModal(true)
                  }}
                >
                  {receipt.file_type?.includes('image') ? (
                    <img
                      src={receipt.file_url}
                      alt={receipt.file_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                      <FileText size={48} />
                      <span className="text-xs mt-2">PDF</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye size={24} className="text-white" />
                  </div>
                  <div className={`absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full ${getFileColor(receipt.file_type)} flex items-center gap-1`}>
                    {getFileIcon(receipt.file_type)}
                    {getFileLabel(receipt.file_type)}
                  </div>
                </div>

                <div className="p-3">
                  <p className="font-bold text-[13px] text-gray-800 dark:text-gray-200 truncate">
                    {receipt.file_name || 'Sem nome'}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      <Calendar size={10} />
                      {format(new Date(receipt.uploaded_at || receipt.created_at), "dd/MM/yy", { locale: ptBR })}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(receipt.id)
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de visualização */}
      {showModal && selectedReceipt && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80" onClick={() => setShowModal(false)}>
          <div className="relative max-w-lg w-[90%] max-h-[80vh] bg-white dark:bg-slate-800 rounded-2xl overflow-hidden animate-in fade-in-zoom-in-95 duration-200">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-2 right-2 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="p-4 border-b border-gray-100 dark:border-slate-700">
              <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">
                {selectedReceipt.file_name}
              </p>
              <p className="text-[10px] text-gray-400">
                {format(new Date(selectedReceipt.uploaded_at || selectedReceipt.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>

            <div className="p-4 flex items-center justify-center max-h-[60vh] overflow-auto">
              {selectedReceipt.file_type?.includes('image') ? (
                <img
                  src={selectedReceipt.file_url}
                  alt={selectedReceipt.file_name}
                  className="max-w-full max-h-[55vh] object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <FileText size={80} className="text-gray-400 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                    Visualização de PDF não disponível no app.
                  </p>
                  <a
                    href={selectedReceipt.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors"
                  >
                    Abrir PDF
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}