'use client'

import { useEffect, useState, useRef, useMemo, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  ChevronLeft, Edit3, Trash2, Loader2, Phone, Mail, Building, User,
  ArrowDown, ArrowUp, Clock, Check, Plus, RefreshCw, Image, Paperclip, AlertTriangle
} from 'lucide-react'
import { format } from 'date-fns'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
import { useContactById } from '@/hooks/useContactById'
import { useContactTransactions } from '@/hooks/useContactTransactions'
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import Skeleton from '@/components/Skeleton'

const ContactDetailSkeleton = () => (
  <div className="animate-pulse px-4 pt-6 space-y-4">
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-center gap-4">
        <div className="h-14 w-14 rounded-[18px] bg-slate-200 dark:bg-slate-700" />
        <div className="space-y-2">
          <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-3 w-48 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-3 w-32 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  </div>
)

function ContactDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // ✅ useMemo para normalizar o ID
  const rawId = searchParams.get('id')
  const id = useMemo(() => rawId?.trim() || null, [rawId])

  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const { showToast } = useToast()
  const { safeDelete } = useSafeDb()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()

  const [refreshing, setRefreshing] = useState(false)
  const [showDeleteSheet, setShowDeleteSheet] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  // ✅ HOOK ESPECÍFICO POR ID
  const { data: contact, loading: contactLoading, notFound } = useContactById(id)

  // ✅ HOOK DE RELACIONAMENTO (transações do contato)
  const { data: transactions, loading: txLoading } = useContactTransactions(id)

  // ✅ CATEGORIAS ainda vêm via useLocalData para joins
  const { data: categories } = useLocalData({
    table: 'categories' as any,
    filters: { context: effectiveContext }
  })

  // ✅ CONSOLIDA TRANSAÇÕES COM CATEGORIAS
  const transactionsWithCategories = useMemo(() => {
    if (!transactions) return []
    return transactions
      .map((tx: any) => {
        const category = categories?.find((c: any) => c.id === tx.category_id)
        return { ...tx, categories: category || null }
      })
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20)
  }, [transactions, categories])

  const totalToPay = useMemo(() => {
    return transactionsWithCategories
      .filter((t: any) => t.type === 'expense' && t.status === 'pending')
      .reduce((acc, t: any) => acc + Number(t.amount), 0)
  }, [transactionsWithCategories])

  const totalToReceive = useMemo(() => {
    return transactionsWithCategories
      .filter((t: any) => t.type === 'income' && t.status === 'pending')
      .reduce((acc, t: any) => acc + Number(t.amount), 0)
  }, [transactionsWithCategories])

  // ✅ REMOVIDO reload manual – a UI reage automaticamente via hooks

  const getAttachmentIcon = (url: string | null) => {
    if (!url) return null
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url)
    if (isImage) return <Image size={12} className="shrink-0 text-blue-500" />
    return <Paperclip size={12} className="shrink-0 text-slate-400" />
  }

  const handleDelete = async () => {
    if (!contact) return
    setDeleting(true)
    try {
      const result = await safeDelete('contacts', contact.id)
      if (!result.success) throw new Error(result.error)
      success()
      showToast('Contato excluído com sucesso.', 'success')
      setShowDeleteSheet(false)
      router.push('/contacts')
    } catch (err: any) {
      errorHaptic()
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'supplier': return 'Fornecedor'
      case 'customer': return 'Cliente'
      case 'both': return 'Fornecedor/Cliente'
      case 'individual': return 'Pessoa física'
      case 'company': return 'Pessoa jurídica'
      default: return type
    }
  }

  // ✅ TRATAMENTO DE LOADING
  if (contactLoading && !contact) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24 dark:bg-slate-950">
        <div className="sticky top-0 border-b border-slate-200 bg-white/90 px-4 pb-4 pt-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
          <div className="h-10 w-10 animate-pulse rounded-[14px] bg-slate-200 dark:bg-slate-700" />
        </div>
        <ContactDetailSkeleton />
      </div>
    )
  }

  // ✅ TRATAMENTO DE NÃO ENCONTRADO
  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <User size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Contato não encontrado</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs mb-6">
          O contato que você está tentando acessar pode ter sido excluído ou você não tem permissão.
        </p>
        <button
          onClick={() => router.push('/contacts')}
          className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-full font-semibold transition-colors active:scale-95"
        >
          Voltar para listagem
        </button>
      </div>
    )
  }

  if (!contact) return null

  const IconComp = getDynamicIcon(contact.icon || (contact.type === 'company' ? 'Building2' : 'User'))

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen bg-slate-50 pb-24 transition-colors duration-300 dark:bg-slate-950"
    >
      {refreshing && (
        <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center pt-6">
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-lg dark:bg-slate-800">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-semibold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 pb-4 pt-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => {
              vibrate([5])
              router.push('/contacts')
            }}
            className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-slate-100 text-slate-700 transition active:scale-95 dark:bg-slate-800 dark:text-slate-200"
          >
            <ChevronLeft size={22} />
          </button>

          <h1 className="mx-3 flex-1 truncate text-center text-[17px] font-bold text-slate-900 dark:text-slate-100">
            {contact.name}
          </h1>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                vibrate([5])
                router.push(`/contacts/new?edit=${contact.id}`)
              }}
              className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-teal-50 text-teal-700 transition active:scale-95 dark:bg-teal-950/30 dark:text-teal-400"
            >
              <Edit3 size={18} />
            </button>
            <button
              onClick={() => {
                vibrate([5])
                setShowDeleteSheet(true)
              }}
              className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-red-50 text-red-500 transition active:scale-95 dark:bg-red-950/30"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        <ContextToggle />
      </header>

      <main className="mx-auto max-w-xl px-4 pt-5">
        <div className="space-y-4">
          <section
            className="overflow-hidden rounded-[30px] border border-slate-200/60 p-5 text-white shadow-lg dark:border-slate-800"
            style={{ backgroundColor: contact.color || '#0f766e' }}
          >
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/20 bg-white/15 backdrop-blur-md">
                <IconComp size={24} className="text-white" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[12px] font-semibold text-white/75">
                  {getTypeLabel(contact.type)}
                </p>
                <h2 className="truncate text-[22px] font-black leading-tight">
                  {contact.name}
                </h2>
              </div>
            </div>

            <div className="space-y-2 rounded-[22px] border border-white/10 bg-black/10 p-4 backdrop-blur-md">
              {contact.email && (
                <div className="flex items-center gap-3 text-[14px] text-white/90">
                  <Mail size={16} className="text-white/65" />
                  <span className="truncate">{contact.email}</span>
                </div>
              )}

              {contact.phone && (
                <div className="flex items-center gap-3 text-[14px] text-white/90">
                  <Phone size={16} className="text-white/65" />
                  <span>{contact.phone}</span>
                </div>
              )}

              {contact.company && contact.type !== 'company' && (
                <div className="flex items-center gap-3 text-[14px] text-white/90">
                  <Building size={16} className="text-white/65" />
                  <span className="truncate">{contact.company}</span>
                </div>
              )}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[14px] bg-red-50 dark:bg-red-950/30">
                <ArrowDown size={18} className="text-red-500" />
              </div>
              <p className="mb-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
                A pagar
              </p>
              <p className="text-[18px] font-black text-red-500">
                {formatCurrency(totalToPay)}
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[14px] bg-emerald-50 dark:bg-emerald-950/30">
                <ArrowUp size={18} className="text-emerald-500" />
              </div>
              <p className="mb-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
                A receber
              </p>
              <p className="text-[18px] font-black text-emerald-600">
                {formatCurrency(totalToReceive)}
              </p>
            </div>
          </section>

          {contact.notes && (
            <section className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-2 text-[15px] font-bold text-slate-900 dark:text-slate-100">
                Observações
              </h3>
              <p className="rounded-[18px] bg-slate-50 p-4 text-[14px] leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {contact.notes}
              </p>
            </section>
          )}

          <section className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-[16px] font-bold text-slate-900 dark:text-slate-100">
                  Últimas transações
                </h3>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Até 20 registros vinculados
                </p>
              </div>

              <button
                onClick={() => {
                  vibrate([5])
                  router.push(`/transactions/new?contact_id=${contact.id}`)
                }}
                className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-teal-50 text-teal-700 transition active:scale-95 dark:bg-teal-950/30 dark:text-teal-400"
              >
                <Plus size={18} />
              </button>
            </div>

            {txLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 size={24} className="animate-spin text-teal-500" />
              </div>
            ) : transactionsWithCategories.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500">
                  Nenhuma transação vinculada a este contato.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactionsWithCategories.map((tx: any) => {
                  const isIncome = tx.type === 'income'
                  const isPending = tx.status === 'pending'
                  const TxIconComp = getDynamicIcon(tx.categories?.icon || 'tag')
                  const attachmentIcon = getAttachmentIcon(tx.receipt_url)

                  return (
                    <button
                      key={tx.id}
                      onClick={() => {
                        vibrate([5])
                        router.push(`/transactions/details?id=${tx.id}`)
                      }}
                      className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition active:scale-[0.99] hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-[14px] ${
                          isPending
                            ? 'bg-amber-50 dark:bg-amber-950/30'
                            : 'bg-slate-100 dark:bg-slate-800'
                        }`}>
                          {isPending ? (
                            <Clock size={16} className="text-amber-500" />
                          ) : (
                            <Check size={16} className="text-emerald-500" />
                          )}
                        </div>

                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
                          style={{
                            backgroundColor: `${tx.categories?.color || '#94a3b8'}20`,
                            color: tx.categories?.color || '#64748b'
                          }}
                        >
                          <TxIconComp size={18} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                              {tx.description || 'Sem descrição'}
                            </p>
                            {attachmentIcon}
                          </div>
                          <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                            {format(new Date(tx.date), 'dd/MM/yy')} • {tx.categories?.name || 'Geral'}
                          </p>
                        </div>
                      </div>

                      <p className={`shrink-0 text-[15px] font-black ${
                        isIncome ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {isIncome ? '+' : '-'}{formatCurrency(Math.abs(Number(tx.amount)))}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* DELETE SHEET COM PORTAL */}
      {showDeleteSheet && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !deleting && setShowDeleteSheet(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-[32px] bg-white p-6 pb-8 dark:bg-slate-900 shadow-2xl animate-in slide-in-from-bottom-8 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-6 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
                <AlertTriangle size={26} className="text-red-500" />
              </div>
              <h3 className="mb-1 text-[18px] font-bold text-slate-900 dark:text-slate-100">
                Excluir contato?
              </h3>
              <p className="max-w-[280px] text-[14px] text-slate-500 dark:text-slate-400">
                Essa ação não pode ser desfeita. O contato será removido permanentemente.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteSheet(false)}
                disabled={deleting}
                className="flex-1 rounded-[20px] bg-slate-100 px-4 py-3.5 text-[14px] font-semibold text-slate-700 transition active:scale-[0.98] disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-[20px] bg-red-500 px-4 py-3.5 text-[14px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
              >
                {deleting ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Excluir
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
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