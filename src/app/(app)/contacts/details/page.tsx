'use client'

import { useEffect, useState, useRef, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import Skeleton from '@/components/Skeleton'

const ContactDetailSkeleton = () => (
  <div className="animate-pulse px-4 pt-6 space-y-4">
    <div className="rounded-[28px] p-6 bg-gray-200 dark:bg-slate-700 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-14 h-14 bg-white/50 dark:bg-slate-600 rounded-[18px]" />
        <div className="space-y-2">
          <div className="h-5 w-40 bg-white/50 dark:bg-slate-600 rounded" />
          <div className="h-3 w-24 bg-white/30 dark:bg-slate-600/50 rounded" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-3 w-48 bg-white/30 dark:bg-slate-600/50 rounded" />
        <div className="h-3 w-32 bg-white/30 dark:bg-slate-600/50 rounded" />
      </div>
    </div>
  </div>
)

function ContactDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const { user } = useAuth()
  
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  
  const { showToast } = useToast()
  const { safeDelete } = useSafeDb()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()

  const [refreshing, setRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

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

  const contact = useMemo(() => {
    return contacts?.find((c: any) => c.id === id)
  }, [contacts, id])

  const transactions = useMemo(() => {
    if (!allTransactions || !contact) return []
    
    return allTransactions
      .filter((tx: any) => tx.contact_id === contact.id)
      .map((tx: any) => {
        const category = categories?.find((c: any) => c.id === tx.category_id)
        return { ...tx, categories: category || null }
      })
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20)
  }, [allTransactions, contact, categories])

  const totalToPay = useMemo(() => {
    return transactions.filter((t: any) => t.type === 'expense' && t.status === 'pending').reduce((acc, t: any) => acc + Number(t.amount), 0)
  }, [transactions])

  const totalToReceive = useMemo(() => {
    return transactions.filter((t: any) => t.type === 'income' && t.status === 'pending').reduce((acc, t: any) => acc + Number(t.amount), 0)
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
      vibrate([10])
      Promise.all([reloadContacts(), reloadTxs()]).finally(() => setRefreshing(false))
    }
  }

  const handleTouchEnd = () => { isPulling.current = false }

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

  const handleDelete = async () => {
    if (!contact) return
    vibrate([10, 50])
    if (!confirm('Excluir este contato? As transações vinculadas continuarão existindo sem contato vinculado.')) return
    
    try {
      const result = await safeDelete('contacts', contact.id)
      if (!result.success) throw new Error(result.error)

      success()
      showToast('🗑️ Contato excluído com sucesso.', 'success')
      router.push('/contacts')
    } catch(err: any) {
      errorHaptic()
      showToast(`❌ Erro ao excluir: ${err.message}`, 'error')
    }
  }

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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

  if (contactsLoading && !contact) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 font-sans pb-24 transition-colors duration-300">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl px-4 pt-6 pb-4 shadow-sm border-b border-gray-100 dark:border-slate-800 sticky top-0">
          <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
        </div>
        <ContactDetailSkeleton />
      </div>
    )
  }

  if (!contactsLoading && !contact) {
    router.push('/contacts')
    return null
  }

  const IconComp = getDynamicIcon(contact.icon || (contact.type === 'company' ? 'Building2' : 'User'))

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.1)] rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl px-4 pt-6 pb-4 shadow-sm border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { vibrate([5]); router.push('/contacts'); }} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors active:scale-95">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[18px] font-bold text-gray-800 dark:text-gray-100 truncate flex-1 text-center">{contact.name}</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => { vibrate([5]); router.push(`/contacts/new?edit=${contact.id}`); }} className="p-2.5 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 active:scale-95 transition-transform">
              <Edit3 size={18} />
            </button>
            <button onClick={handleDelete} className="p-2.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 active:scale-95 transition-transform">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-5 space-y-4 animate-in fade-in duration-300">
        {/* Card principal */}
        <div className="rounded-[28px] p-6 text-white shadow-lg relative overflow-hidden" style={{ backgroundColor: contact.color || '#0f766e' }}>
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <IconComp size={100} />
          </div>
          
          <div className="flex items-center gap-4 mb-5 relative z-10">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-[18px] flex items-center justify-center border border-white/20">
              <IconComp size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-[20px] truncate leading-tight">{contact.name}</h2>
              <p className="text-white/80 font-medium text-[12px] uppercase tracking-widest mt-0.5">{getTypeLabel(contact.type)}</p>
            </div>
          </div>
          <div className="space-y-2.5 bg-black/10 backdrop-blur-md p-4 rounded-[20px] relative z-10 border border-white/10">
            {contact.email && (
              <div className="flex items-center gap-3 text-white/90 text-[13px] font-medium">
                <Mail size={16} className="text-white/70" /> <span className="truncate">{contact.email}</span>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-3 text-white/90 text-[13px] font-medium">
                <Phone size={16} className="text-white/70" /> {contact.phone}
              </div>
            )}
            {contact.company && contact.type !== 'company' && (
              <div className="flex items-center gap-3 text-white/90 text-[13px] font-medium">
                <Building size={16} className="text-white/70" /> <span className="truncate">{contact.company}</span>
              </div>
            )}
          </div>
        </div>

        {/* Resumo financeiro */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700/50 text-center">
            <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-2">
              <ArrowDown size={18} className="text-red-500" />
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">A Pagar</p>
            <p className="text-[18px] font-black text-red-500">{formatCurrency(totalToPay)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700/50 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
              <ArrowUp size={18} className="text-emerald-500" />
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">A Receber</p>
            <p className="text-[18px] font-black text-emerald-600">{formatCurrency(totalToReceive)}</p>
          </div>
        </div>

        {contact.notes && (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700/50">
            <h3 className="font-bold text-[14px] text-gray-800 dark:text-gray-200 mb-2">Observações Internas</h3>
            <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-slate-700/30 p-3 rounded-[16px]">{contact.notes}</p>
          </div>
        )}

        {/* Transações vinculadas */}
        <div className="bg-white dark:bg-slate-800 rounded-[28px] shadow-sm border border-gray-50 dark:border-slate-700/50 overflow-hidden">
          <div className="flex justify-between items-center px-6 py-5 border-b border-gray-50 dark:border-slate-700/50">
            <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-200">Últimas Transações</h3>
            <button
              onClick={() => { vibrate([5]); router.push(`/transactions/new?contact_id=${contact.id}`); }}
              className="text-teal-700 dark:text-teal-400 p-2 bg-teal-50 dark:bg-teal-900/30 rounded-full hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors active:scale-90"
            >
              <Plus size={18} />
            </button>
          </div>
          {txLoading ? (
            <div className="p-8 flex justify-center"><Loader2 size={24} className="animate-spin text-teal-500"/></div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-[13px] font-medium">Nenhuma transação vinculada a este contato.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {transactions.map((tx: any) => {
                const isIncome = tx.type === 'income'
                const isPending = tx.status === 'pending'
                const TxIconComp = getDynamicIcon(tx.categories?.icon || 'tag')
                const attachmentIcon = getAttachmentIcon(tx.receipt_url)
                return (
                  <div
                    key={tx.id}
                    onClick={() => { vibrate([5]); router.push(`/transactions/details?id=${tx.id}`); }}
                    className={`flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer active:scale-[0.98] ${isPending ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {isPending ? (
                        <div className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                          <Clock size={12} className="text-orange-500" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                          <Check size={12} className="text-emerald-500" />
                        </div>
                      )}
                      <div
                        className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 shadow-sm"
                        style={{ backgroundColor: `${tx.categories?.color || '#94a3b8'}20`, color: tx.categories?.color || '#64748b' }}
                      >
                        <TxIconComp size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate">
                            {tx.description || 'Sem descrição'}
                          </p>
                          {attachmentIcon && <span className="shrink-0">{attachmentIcon}</span>}
                        </div>
                        <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                          {format(new Date(tx.date), "dd/MM/yy")} • {tx.categories?.name || 'Geral'}
                        </p>
                      </div>
                    </div>
                    <p className={`text-[15px] font-black flex-shrink-0 ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(Math.abs(Number(tx.amount)))}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default function ContactDetailPage() {
  return (
    <Suspense fallback={<ContactDetailSkeleton />}>
      <ContactDetailContent />
    </Suspense>
  )
}
