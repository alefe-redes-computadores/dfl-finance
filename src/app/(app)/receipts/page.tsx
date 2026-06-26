'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Loader2, Search, X, Download, Share2, ZoomIn,
  Calendar, Filter, Tag, Wallet, ArrowUp, ArrowDown, Maximize2
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'

interface Receipt {
  id: string
  date: string
  amount: number
  type: string
  description: string
  receipt_url: string
  category_name: string
  category_color: string
  category_icon: string
  account_name: string
  account_color: string
}

export default function ReceiptsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [dateFilter, setDateFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const loaderRef = useRef<HTMLDivElement>(null)

  const loadReceipts = useCallback(async (pageNum: number, append = false) => {
    if (!user) return
    if (pageNum === 0) setLoading(true)
    else setLoadingMore(true)

    const pageSize = 20
    const from = pageNum * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('transactions')
      .select(`
        id, date, amount, type, description, receipt_url,
        categories(name, color, icon),
        accounts(name, color)
      `)
      .match({ user_id: user.id, context })
      .not('receipt_url', 'is', null)
      .order('date', { ascending: sortOrder === 'asc' })
      .range(from, to)

    // Filtro de data
    const now = new Date()
    if (dateFilter === 'this-month') {
      query = query.gte('date', format(startOfMonth(now), 'yyyy-MM-dd')).lte('date', format(endOfMonth(now), 'yyyy-MM-dd'))
    } else if (dateFilter === 'last-month') {
      const lastMonth = subMonths(now, 1)
      query = query.gte('date', format(startOfMonth(lastMonth), 'yyyy-MM-dd')).lte('date', format(endOfMonth(lastMonth), 'yyyy-MM-dd'))
    } else if (dateFilter === 'last-3') {
      query = query.gte('date', format(subMonths(now, 3), 'yyyy-MM-dd'))
    }

    const { data, error } = await query

    if (error) {
      showToast('Erro ao carregar comprovantes', 'error')
      setLoading(false)
      setLoadingMore(false)
      return
    }

    const mapped: Receipt[] = (data || []).map((tx: any) => ({
      id: tx.id,
      date: tx.date,
      amount: Number(tx.amount),
      type: tx.type,
      description: tx.description || '',
      receipt_url: tx.receipt_url,
      category_name: tx.categories?.name || 'Geral',
      category_color: tx.categories?.color || '#64748b',
      category_icon: tx.categories?.icon || 'tag',
      account_name: tx.accounts?.name || '',
      account_color: tx.accounts?.color || '#64748b',
    }))

    if (append) {
      setReceipts(prev => [...prev, ...mapped])
    } else {
      setReceipts(mapped)
    }

    setHasMore(data?.length === pageSize)
    setLoading(false)
    setLoadingMore(false)
  }, [user, context, dateFilter, sortOrder])

  useEffect(() => {
    setPage(0)
    loadReceipts(0)
  }, [loadReceipts])

  // Scroll infinito
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          const nextPage = page + 1
          setPage(nextPage)
          loadReceipts(nextPage, true)
        }
      },
      { threshold: 0.1 }
    )

    if (loaderRef.current) observer.observe(loaderRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, page, loadReceipts])

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = 'comprovante.jpg'
      a.click()
      URL.revokeObjectURL(blobUrl)
      showToast('Download iniciado!', 'success')
    } catch {
      showToast('Erro ao baixar', 'error')
    }
  }

  const handleShare = async (url: string, description: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Comprovante DFL Finance',
          text: description,
          url: url
        })
      } catch {}
    } else {
      // Fallback: copiar link
      navigator.clipboard.writeText(url)
      showToast('Link copiado!', 'success')
    }
  }

  const formatCurrency = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (loading && receipts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
        <Loader2 className="animate-spin text-teal-700" size={40} />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-24 font-sans transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 sticky top-0 z-10 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="font-bold text-[17px] text-gray-800 dark:text-gray-100">Comprovantes</h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-full transition-colors ${showFilters ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'text-gray-400 dark:text-gray-500'}`}
          >
            <Filter size={20} />
          </button>
        </div>

        {/* Filtros */}
        {showFilters && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { key: 'all', label: 'Todos' },
              { key: 'this-month', label: 'Este mês' },
              { key: 'last-month', label: 'Mês passado' },
              { key: 'last-3', label: 'Últimos 3 meses' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setDateFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  dateFilter === f.key
                    ? 'bg-teal-700 text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                {f.label}
              </button>
            ))}
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400"
            >
              {sortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
              {sortOrder === 'desc' ? 'Recentes' : 'Antigos'}
            </button>
          </div>
        )}
      </div>

      {/* Grid de Comprovantes */}
      <div className="px-4 pt-4">
        {receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center mb-3">
              <Search size={28} className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="font-bold text-gray-800 dark:text-gray-200">Nenhum comprovante</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Os comprovantes anexados às transações aparecerão aqui.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {receipts.map(receipt => (
                <button
                  key={receipt.id}
                  onClick={() => setSelectedReceipt(receipt)}
                  className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-50 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow text-left"
                >
                  {/* Miniatura */}
                  <div className="aspect-[4/3] bg-gray-100 dark:bg-slate-700 relative overflow-hidden">
                    <img
                      src={receipt.receipt_url}
                      alt={receipt.description}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                      <ZoomIn size={14} className="text-white" />
                    </div>
                  </div>
                  {/* Informações */}
                  <div className="p-3">
                    <p className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate">
                      {receipt.description || (receipt.type === 'income' ? 'Receita' : 'Despesa')}
                    </p>
                    <p className={`text-[13px] font-bold mt-1 ${receipt.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {receipt.type === 'income' ? '+' : '-'} {formatCurrency(receipt.amount)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Calendar size={12} className="text-gray-400" />
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        {format(new Date(receipt.date + 'T12:00:00'), "dd/MM/yy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: receipt.category_color }} />
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{receipt.category_name}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Loader para scroll infinito */}
            {hasMore && (
              <div ref={loaderRef} className="flex justify-center py-8">
                <Loader2 className="animate-spin text-teal-700" size={24} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de Visualização em Tela Cheia */}
      {selectedReceipt && (
        <div
          className="fixed inset-0 z-[100] bg-black flex flex-col"
          onClick={() => setSelectedReceipt(null)}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 text-white">
            <button onClick={() => setSelectedReceipt(null)} className="p-2">
              <X size={24} />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownload(selectedReceipt.receipt_url)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <Download size={20} />
              </button>
              <button
                onClick={() => handleShare(selectedReceipt.receipt_url, selectedReceipt.description)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>

          {/* Imagem */}
          <div className="flex-1 flex items-center justify-center p-4">
            <img
              src={selectedReceipt.receipt_url}
              alt={selectedReceipt.description}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Informações */}
          <div className="bg-white dark:bg-slate-800 rounded-t-3xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-lg text-gray-800 dark:text-gray-100">
                {selectedReceipt.description || (selectedReceipt.type === 'income' ? 'Receita' : 'Despesa')}
              </p>
              <p className={`font-bold text-lg ${selectedReceipt.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                {selectedReceipt.type === 'income' ? '+' : '-'} {formatCurrency(selectedReceipt.amount)}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Calendar size={14} />
                {format(new Date(selectedReceipt.date + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </div>
              <div className="flex items-center gap-1">
                <Tag size={14} />
                {selectedReceipt.category_name}
              </div>
              {selectedReceipt.account_name && (
                <div className="flex items-center gap-1">
                  <Wallet size={14} />
                  {selectedReceipt.account_name}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
