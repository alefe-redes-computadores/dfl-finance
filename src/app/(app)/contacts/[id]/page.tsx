'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  ChevronLeft, Edit3, Trash2, Loader2, Phone, Mail, Building, User,
  ArrowDown, ArrowUp, Clock, Check, Plus, RefreshCw, Image, Paperclip
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
// 🔥 NOVO: Arquitetura Local-First blindada
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'

// ============================================================
// SKELETON LOADER
// ============================================================
const ContactDetailSkeleton = () => (
  <div className="animate-pulse px-4 pt-4 space-y-4">
    <div className="rounded-2xl p-5 bg-gray-200 dark:bg-slate-700 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-white/20 rounded-xl" />
        <div className="space-y-2">
          <div className="h-5 w-32 bg-white/20 rounded" />
          <div className="h-3 w-20 bg-white/10 rounded" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white/20 rounded" />
          <div className="h-3 w-40 bg-white/10 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white/20 rounded" />
          <div className="h-3 w-28 bg-white/10 rounded" />
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 text-center">
        <div className="w-5 h-5 bg-gray-200 dark:bg-slate-700 rounded mx-auto mb-2" />
        <div className="h-3 w-12 bg-gray-200 dark:bg-slate-700 rounded mx-auto mb-1" />
        <div className="h-6 w-20 bg-gray-100 dark:bg-slate-700/50 rounded mx-auto" />
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 text-center">
        <div className="w-5 h-5 bg-gray-200 dark:bg-slate-700 rounded mx-auto mb-2" />
        <div className="h-3 w-12 bg-gray-200 dark:bg-slate-700 rounded mx-auto mb-1" />
        <div className="h-6 w-20 bg-gray-100 dark:bg-slate-700/50 rounded mx-auto" />
      </div>
    </div>
  </div>
)

export default function ContactDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  
  // 🔥 CORRIGIDO: effectiveContext
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  
  const { showToast } = useToast()
  const { safeDelete } = useSafeDb()

  const [refreshing, setRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  // 🔥 LENDO DADOS 100% LOCAL-FIRST OFFLINE
  const { data: contacts, loading: contactsLoading, reload: reloadContacts } = useLocalData({
    table: 'contacts' as any,
    filters: { context: effectiveContext }
  })

  const { data: allTransactions, loading: txLoading, reload: reloadTxs } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext }
  })

  const { data: categories } = useLocalData({
    table: 'categories' as any,
    filters: { context: effectiveContext }
  })

  // Encontra o contato específico
  const contact = useMemo(() => {
    return contacts?.find((c: any) => c.id === params.id)
  }, [contacts, params.id])

  // Filtra as transações desse contato e mescla com a categoria para exibir o ícone (Offline-First)
  const transactions = useMemo(() => {
    if (!allTransactions || !contact) return []
    
    return allTransactions
      .filter((tx: any) => tx.contact_id === contact.id)
      .map((tx: any) => {
        const category = categories?.find((c: any) => c.id === tx.category_id)
        return {
          ...tx,
          categories: category || null
        }
      })
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20) // Limita as últimas 20 para performance
  }, [allTransactions, contact, categories])

  const totalToPay = useMemo(() => {
    return transactions
      .filter((t: any) => t.type === 'expense' && t.status === 'pending')
      .reduce((acc, t: any) => acc + Number(t.amount), 0)
  }, [transactions])

  const totalToReceive = useMemo(() => {
    return transactions
      .filter((t: any) => t.type === 'income' && t.status === 'pending')
      .reduce((acc, t: any) => acc + Number(t.amount), 0)
  }, [transactions])


  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY > 10 || contactsLoading) return
    pullStartY.current = e.touches[0].clientY
    isPulling.current = true
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const pullDistance = e.touches[0].clientY - pullStartY.current
    if (pullDistance > 60) {
      setRefreshing(true)
      isPulling.current = false
      Promise.all([reloadContacts(), reloadTxs()]).finally(() => setRefreshing(false))
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
  }, [contactsLoading, refreshing])

  const getAttachmentIcon = (url: string | null) => {
    if (!url) return null
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url)
    if (isImage) return <Image size={12} className="text-blue-500 shrink-0" />
    return <Paperclip size={12} className="text-gray-500 shrink-0" />
  }

  // 🔥 DELETE ATÔMICO 100% BLINDADO
  const handleDelete = async () => {
    if (!contact) return
    if (!confirm('Excluir este contato? As transações vinculadas continuarão existindo sem contato vinculado.')) return
    
    try {
      const result = await safeDelete('contacts', contact.id)
      if (!result.success) throw new Error(result.error)

      showToast('Contato excluído com sucesso.', 'success')
      router.push('/contacts')
    } catch(err: any) {
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    }
  }

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'supplier': return 'Fornecedor'
      case 'customer': return 'Cliente'
      case 'both': return 'Fornecedor/Cliente'
      case 'individual': return 'Pessoa Física'
      case 'company': return 'Pessoa Jurídica'
      default: return type
    }
  }

  // Se tá carregando pela primeira vez, mostra Skeleton
  if (contactsLoading && !contact) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
        <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4 animate-pulse">
            <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full" />
            <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded-full" />
              <div className="w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded-full" />
            </div>
          </div>
          <div className="h-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
        </div>
        <ContactDetailSkeleton />
      </div>
    )
  }

  // Se carregou e não achou, volta pra lista
  if (!contactsLoading && !contact) {
    router.push('/contacts')
    return null
  }

  const IconComp = getDynamicIcon(contact.icon || (contact.type === 'company' ? 'Building2' : 'User'))

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
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
          <button onClick={() => router.push('/contacts')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate flex-1 text-center">{contact.name}</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push(`/contacts/new?edit=${contact.id}`)} className="p-2 text-gray-400 hover:text-teal-600 transition-colors">
              <Edit3 size={18} />
            </button>
            <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Card principal */}
        <div className="rounded-2xl p-5 text-white shadow-lg animate-in fade-in duration-300" style={{ backgroundColor: contact.color || '#14b8a6' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <IconComp size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg truncate">{contact.name}</h2>
              <p className="text-white/70 text-xs">{getTypeLabel(contact.type)}</p>
            </div>
          </div>
          <div className="space-y-2">
            {contact.email && (
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Mail size={14} /> <span className="truncate">{contact.email}</span>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Phone size={14} /> {contact.phone}
              </div>
            )}
            {contact.company && contact.type !== 'company' && (
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Building size={14} /> <span className="truncate">{contact.company}</span>
              </div>
            )}
          </div>
        </div>

        {/* Resumo financeiro */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 text-center">
            <ArrowDown size={18} className="text-red-500 mx-auto mb-1" />
            <p className="text-[10px] text-gray-400 font-bold">A Pagar</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totalToPay)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 text-center">
            <ArrowUp size={18} className="text-emerald-500 mx-auto mb-1" />
            <p className="text-[10px] text-gray-400 font-bold">A Receber</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalToReceive)}</p>
          </div>
        </div>

        {/* Transações vinculadas */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden animate-in fade-in duration-300">
          <div className="flex justify-between items-center px-5 py-4 border-b border-gray-50 dark:border-slate-700">
            <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200">Transações</h3>
            <button
              onClick={() => router.push(`/transactions/new?contact_id=${contact.id}`)}
              className="text-teal-700 dark:text-teal-400 p-1 hover:text-teal-800 transition-colors active:scale-90"
            >
              <Plus size={20} />
            </button>
          </div>
          {txLoading ? (
            <div className="p-6 flex justify-center"><Loader2 size={24} className="animate-spin text-teal-500"/></div>
          ) : transactions.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">
              Nenhuma transação vinculada.
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-slate-700">
              {transactions.map((tx: any) => {
                const isIncome = tx.type === 'income'
                const isPending = tx.status === 'pending'
                const TxIconComp = getDynamicIcon(tx.categories?.icon || 'tag')
                const attachmentIcon = getAttachmentIcon(tx.receipt_url)
                return (
                  <div
                    key={tx.id}
                    onClick={() => router.push(`/transactions/${tx.id}`)}
                    className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer active:scale-[0.98] ${isPending ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {isPending ? (
                        <Clock size={14} className="text-orange-500 shrink-0" />
                      ) : (
                        <Check size={14} className="text-emerald-500 shrink-0" />
                      )}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${tx.categories?.color || '#94a3b8'}20`, color: tx.categories?.color || '#64748b' }}
                      >
                        <TxIconComp size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200 truncate">
                            {tx.description || 'Sem descrição'}
                          </p>
                          {attachmentIcon && <span className="shrink-0">{attachmentIcon}</span>}
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {format(new Date(tx.date), "dd/MM/yy")} • {tx.categories?.name || 'Geral'}
                        </p>
                      </div>
                    </div>
                    <p className={`text-[14px] font-bold flex-shrink-0 ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {contact.notes && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 animate-in fade-in duration-300">
            <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-2">Observações</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{contact.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
