// src/app/(app)/contacts/details/page.tsx
'use client'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  Edit3,
  Mail,
  Phone,
  Plus,
  ReceiptText,
  Trash2,
  User,
  Wallet,
} from 'lucide-react'

import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import DatePickerSheet, { formatDateLabel } from '@/components/DatePickerSheet'
import Skeleton from '@/components/Skeleton'
import { useToast } from '@/contexts/ToastContext'
import { useContactById } from '@/hooks/useContactById'
import { useContactTransactions } from '@/hooks/useContactTransactions'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'
import {
  getContactEntityLabel,
  getContactEntityType,
  getContactFinancialSummary,
  getContactRelationshipLabel,
  getDebtRemainingAmount,
} from '@/lib/contactOperations'
import type {
  LocalCategory,
  LocalDebt,
  LocalTransaction,
} from '@/lib/db'
import { getDebtDueState, isDebtPayment } from '@/lib/debtOperations'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useAuth } from '@/lib/hooks/useAuth'

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

const formatIsoDate = (value?: string | null) => {
  if (!value) return 'Sem vencimento'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  return `${match[3]}/${match[2]}/${match[1]}`
}

const parseMoney = (value: string) => {
  const raw = value.trim().replace(/\s/g, '').replace(/^R\$/i, '')
  if (!raw) return 0

  if (raw.includes(',')) {
    return Number(raw.replace(/\./g, '').replace(',', '.')) || 0
  }

  return Number(raw) || 0
}

function ContactDetailSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-slate-50 px-4 pt-5 dark:bg-slate-950">
      <Skeleton count={7} />
    </div>
  )
}

function ContactDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const { user } = useAuth()
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  const { showToast } = useToast()
  const { vibrate, success, error: hapticError } = useHapticFeedback()
  const { safeAdd, safeDelete } = useSafeDb()

  const { data: contact, loading: contactLoading, notFound } =
    useContactById(id)

  const recordContext = contact?.context || effectiveContext

  const { data: directTransactions, loading: directTransactionsLoading } =
    useContactTransactions(id)

  const { data: allTransactions, loading: allTransactionsLoading } =
    useLocalData<LocalTransaction>({
      table: 'transactions',
      filters: { context: recordContext },
    })

  const { data: allDebts, loading: debtsLoading } =
    useLocalData<LocalDebt>({
      table: 'debts',
      filters: { context: recordContext },
      orderBy: 'updated_at',
    })

  const { data: categories } = useLocalData<LocalCategory>({
    table: 'categories',
    filters: { context: recordContext },
    orderBy: 'name',
    orderDir: 'asc',
  })

  const [showDeleteSheet, setShowDeleteSheet] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showReceivableSheet, setShowReceivableSheet] = useState(false)
  const [showDueDatePicker, setShowDueDatePicker] = useState(false)
  const [creatingReceivable, setCreatingReceivable] = useState(false)
  const [receivableAmount, setReceivableAmount] = useState('')
  const [receivableDueDate, setReceivableDueDate] = useState('')
  const [receivableDescription, setReceivableDescription] = useState('')

  const contactDebts = useMemo(() => {
    if (!id) return []

    return allDebts
      .filter(
        (debt) =>
          debt.contact_id === id &&
          debt.status !== 'cancelled'
      )
      .sort((a, b) => {
        const dueCompare = String(a.due_date || '9999-12-31').localeCompare(
          String(b.due_date || '9999-12-31')
        )
        if (dueCompare !== 0) return dueCompare
        return String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
      })
  }, [allDebts, id])

  const openContactDebts = useMemo(
    () =>
      contactDebts.filter(
        (debt) => getDebtRemainingAmount(debt, allTransactions) > 0
      ),
    [allTransactions, contactDebts]
  )

  const financial = useMemo(() => {
    if (!id) {
      return {
        transactionCount: 0,
        openDebtCount: 0,
        payable: 0,
        standaloneReceivable: 0,
        debtReceivable: 0,
        receivable: 0,
        received: 0,
        paid: 0,
      }
    }

    return getContactFinancialSummary({
      contactId: id,
      transactions: allTransactions,
      debts: allDebts,
    })
  }, [allDebts, allTransactions, id])

  const history = useMemo(() => {
    const map = new Map<string, LocalTransaction>()

    for (const tx of directTransactions) {
      map.set(tx.id, tx)
    }

    const debtIds = new Set(contactDebts.map((debt) => debt.id))

    for (const tx of allTransactions) {
      if (
        tx.debt_id &&
        debtIds.has(tx.debt_id) &&
        isDebtPayment(tx)
      ) {
        map.set(tx.id, tx)
      }
    }

    return Array.from(map.values())
      .sort((a, b) => {
        const dateCompare = String(b.date || '').localeCompare(String(a.date || ''))
        if (dateCompare !== 0) return dateCompare
        return String(b.created_at || '').localeCompare(String(a.created_at || ''))
      })
      .slice(0, 30)
  }, [allTransactions, contactDebts, directTransactions])

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )

  const loading =
    contactLoading ||
    directTransactionsLoading ||
    allTransactionsLoading ||
    debtsLoading

  if (contactLoading && !contact) {
    return <ContactDetailSkeleton />
  }

  if (notFound) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-4 text-center dark:bg-slate-950">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
          <User size={31} className="text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Contato não encontrado
        </h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500 dark:text-slate-400">
          O contato pode ter sido excluído ou não pertence ao usuário atual.
        </p>
        <button
          type="button"
          onClick={() => router.replace('/contacts')}
          className="mt-6 rounded-full bg-teal-600 px-6 py-3 font-semibold text-white"
        >
          Voltar para contatos
        </button>
      </div>
    )
  }

  if (!contact) return null

  const entityType = getContactEntityType(contact)
  const HeroIcon = getDynamicIcon(
    contact.icon || (entityType === 'company' ? 'Building2' : 'User')
  )

  const handleDelete = async () => {
    if (deleting) return

    setDeleting(true)
    try {
      const result = await safeDelete('contacts', contact.id)
      if (!result.success) throw new Error(result.error)

      success()
      showToast('Contato excluído. O histórico financeiro foi preservado.', 'success')
      router.replace('/contacts')
    } catch (error: any) {
      hapticError()
      showToast(error?.message || 'Erro ao excluir contato.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleCreateReceivable = async () => {
    if (creatingReceivable) return

    if (!user?.id) {
      hapticError()
      showToast('Sessão expirada. Entre novamente para salvar.', 'error')
      return
    }

    const amount = parseMoney(receivableAmount)
    if (amount <= 0) {
      hapticError()
      showToast('Informe um valor a receber maior que zero.', 'warning')
      return
    }

    setCreatingReceivable(true)

    try {
      const result = await safeAdd('debts', {
        id: crypto.randomUUID(),
        user_id: user.id,
        context: recordContext,
        person_name: contact.name,
        contact_id: contact.id,
        total_amount: amount,
        paid_amount: 0,
        due_date: receivableDueDate || null,
        description: receivableDescription.trim() || null,
        status: 'pending',
        category_id: null,
        account_id: null,
        icon: contact.icon || (entityType === 'company' ? 'Building2' : 'User'),
        color:
          contact.color ||
          (entityType === 'company' ? '#3b82f6' : '#14b8a6'),
      })

      if (!result.success) throw new Error(result.error)

      success()
      showToast(`Valor a receber de ${contact.name} criado.`, 'success')
      setReceivableAmount('')
      setReceivableDueDate('')
      setReceivableDescription('')
      setShowReceivableSheet(false)
    } catch (error: any) {
      hapticError()
      showToast(error?.message || 'Erro ao criar valor a receber.', 'error')
    } finally {
      setCreatingReceivable(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-28 transition-colors dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/92 px-4 pb-3 pt-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/92">
        <div className="mx-auto max-w-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                vibrate([5])
                router.replace('/contacts')
              }}
              className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-slate-100 text-slate-700 transition active:scale-95 dark:bg-slate-800 dark:text-slate-200"
              aria-label="Voltar"
            >
              <ChevronLeft size={21} />
            </button>

            <div className="min-w-0 flex-1 text-center">
              <h1 className="truncate text-[17px] font-bold text-slate-900 dark:text-slate-100">
                {contact.name}
              </h1>
              <p className="text-[11px] text-slate-400">
                {recordContext === 'dfl' ? 'Empresa' : 'Pessoal'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  vibrate([5])
                  router.push(`/contacts/new?edit=${contact.id}`)
                }}
                className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-teal-50 text-teal-700 transition active:scale-95 dark:bg-teal-950/30 dark:text-teal-400"
                aria-label="Editar contato"
              >
                <Edit3 size={18} />
              </button>
              <button
                type="button"
                onClick={() => {
                  vibrate([10])
                  setShowDeleteSheet(true)
                }}
                className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-red-50 text-red-500 transition active:scale-95 dark:bg-red-950/30"
                aria-label="Excluir contato"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          <ContextToggle />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-4">
        <div className="space-y-4">
          <section
            className="overflow-hidden rounded-[30px] border border-white/10 p-5 text-white shadow-lg"
            style={{
              backgroundColor:
                contact.color ||
                (entityType === 'company' ? '#2563eb' : '#0f766e'),
            }}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-white/20 bg-white/15 backdrop-blur-md">
                <HeroIcon size={24} className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold">
                    {getContactRelationshipLabel(contact)}
                  </span>
                  <span className="rounded-full bg-black/10 px-2.5 py-1 text-[10px] font-semibold text-white/85">
                    {getContactEntityLabel(contact)}
                  </span>
                </div>
                <h2 className="truncate text-[22px] font-black leading-tight">
                  {contact.name}
                </h2>
                {contact.company && entityType === 'individual' && (
                  <p className="mt-1 truncate text-[12px] text-white/75">
                    {contact.position
                      ? `${contact.position} · ${contact.company}`
                      : contact.company}
                  </p>
                )}
              </div>
            </div>

            {(contact.phone || contact.email || contact.document) && (
              <div className="mt-5 space-y-2 rounded-[22px] border border-white/10 bg-black/10 p-4">
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="flex items-center gap-3 text-[13px] text-white/90"
                  >
                    <Phone size={15} className="text-white/60" />
                    <span>{contact.phone}</span>
                  </a>
                )}
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex min-w-0 items-center gap-3 text-[13px] text-white/90"
                  >
                    <Mail size={15} className="shrink-0 text-white/60" />
                    <span className="truncate">{contact.email}</span>
                  </a>
                )}
                {contact.document && (
                  <div className="flex items-center gap-3 text-[13px] text-white/80">
                    <ReceiptText size={15} className="text-white/60" />
                    <span>{contact.document}</span>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-[13px] bg-white/80 text-emerald-600 shadow-sm dark:bg-slate-900/70 dark:text-emerald-400">
                <ArrowUp size={17} />
              </div>
              <p className="text-[11px] font-semibold text-emerald-700/70 dark:text-emerald-400/70">
                A receber
              </p>
              <p className="mt-0.5 text-[18px] font-black text-emerald-700 dark:text-emerald-400">
                {formatCurrency(financial.receivable)}
              </p>
              {financial.debtReceivable > 0 && (
                <p className="mt-1 text-[10px] text-emerald-700/60 dark:text-emerald-400/60">
                  {formatCurrency(financial.debtReceivable)} em cobranças
                </p>
              )}
            </div>

            <div className="rounded-[24px] border border-red-100 bg-red-50/80 p-4 dark:border-red-900/40 dark:bg-red-950/20">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-[13px] bg-white/80 text-red-500 shadow-sm dark:bg-slate-900/70">
                <ArrowDown size={17} />
              </div>
              <p className="text-[11px] font-semibold text-red-600/70 dark:text-red-400/70">
                A pagar
              </p>
              <p className="mt-0.5 text-[18px] font-black text-red-600 dark:text-red-400">
                {formatCurrency(financial.payable)}
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-semibold text-slate-400">
                Recebido
              </p>
              <p className="mt-1 text-[16px] font-black text-slate-800 dark:text-slate-200">
                {formatCurrency(financial.received)}
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-semibold text-slate-400">
                Pago
              </p>
              <p className="mt-1 text-[16px] font-black text-slate-800 dark:text-slate-200">
                {formatCurrency(financial.paid)}
              </p>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                vibrate([5])
                router.push(`/transactions/new?type=income&contact_id=${contact.id}`)
              }}
              className="rounded-[20px] border border-emerald-100 bg-white px-3 py-3.5 text-center shadow-sm transition active:scale-[0.98] dark:border-emerald-900/30 dark:bg-slate-900"
            >
              <ArrowUp size={17} className="mx-auto text-emerald-600" />
              <span className="mt-1.5 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Receita
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                vibrate([5])
                router.push(`/transactions/new?type=expense&contact_id=${contact.id}`)
              }}
              className="rounded-[20px] border border-red-100 bg-white px-3 py-3.5 text-center shadow-sm transition active:scale-[0.98] dark:border-red-900/30 dark:bg-slate-900"
            >
              <ArrowDown size={17} className="mx-auto text-red-500" />
              <span className="mt-1.5 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Despesa
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                vibrate([10])
                setShowReceivableSheet(true)
              }}
              className="rounded-[20px] border border-teal-100 bg-teal-50 px-3 py-3.5 text-center shadow-sm transition active:scale-[0.98] dark:border-teal-900/30 dark:bg-teal-950/20"
            >
              <Wallet size={17} className="mx-auto text-teal-700 dark:text-teal-400" />
              <span className="mt-1.5 block text-[11px] font-bold text-teal-800 dark:text-teal-300">
                A receber
              </span>
            </button>
          </section>

          {(contact.address ||
            contact.city ||
            contact.state ||
            contact.zip_code ||
            contact.notes ||
            (contact.company && entityType === 'company')) && (
            <section className="rounded-[26px] border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-[14px] font-bold text-slate-900 dark:text-slate-100">
                Informações
              </h3>
              <div className="mt-3 space-y-2 text-[12px] text-slate-500 dark:text-slate-400">
                {contact.company && entityType === 'company' && (
                  <p className="flex items-center gap-2">
                    <Building2 size={14} />
                    <span>{contact.company}</span>
                  </p>
                )}
                {(contact.address || contact.city || contact.state || contact.zip_code) && (
                  <p>
                    {[contact.address, contact.city, contact.state, contact.zip_code]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                {contact.notes && (
                  <p className="rounded-[16px] bg-slate-50 p-3 leading-relaxed dark:bg-slate-800">
                    {contact.notes}
                  </p>
                )}
              </div>
            </section>
          )}

          {openContactDebts.length > 0 && (
            <section className="overflow-hidden rounded-[26px] border border-slate-200/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div>
                  <h3 className="text-[14px] font-bold text-slate-900 dark:text-slate-100">
                    Quem me deve
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {financial.openDebtCount} cobrança
                    {financial.openDebtCount === 1 ? '' : 's'} em aberto
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReceivableSheet(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400"
                  aria-label="Novo valor a receber"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {openContactDebts.map((debt) => {
                  const remaining = getDebtRemainingAmount(debt, allTransactions)
                  const due = getDebtDueState(debt.due_date)
                  const isPaid = remaining <= 0

                  return (
                    <button
                      key={debt.id}
                      type="button"
                      onClick={() => {
                        vibrate([5])
                        router.push(`/debts/details?id=${debt.id}`)
                      }}
                      className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50 active:scale-[0.99] dark:hover:bg-slate-800/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold text-slate-800 dark:text-slate-200">
                          {debt.description || 'Valor a receber'}
                        </p>
                        <p
                          className={`mt-0.5 text-[11px] ${
                            due.isOverdue && !isPaid
                              ? 'font-semibold text-red-500'
                              : 'text-slate-400'
                          }`}
                        >
                          {isPaid
                            ? 'Recebido'
                            : due.isOverdue
                              ? `Vencido · ${formatIsoDate(debt.due_date)}`
                              : formatIsoDate(debt.due_date)}
                        </p>
                      </div>
                      <p
                        className={`shrink-0 text-[13px] font-black ${
                          isPaid ? 'text-slate-400' : 'text-emerald-600'
                        }`}
                      >
                        {formatCurrency(remaining)}
                      </p>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-[26px] border border-slate-200/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-[14px] font-bold text-slate-900 dark:text-slate-100">
                  Histórico financeiro
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Transações e recebimentos vinculados
                </p>
              </div>
              {loading && (
                <span className="text-[10px] font-medium text-slate-400">
                  Atualizando...
                </span>
              )}
            </div>

            {history.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-[12px] text-slate-400">
                  Nenhuma movimentação vinculada a este contato.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((tx) => {
                  const category = tx.category_id
                    ? categoriesById.get(tx.category_id)
                    : null
                  const isIncome = tx.type === 'income'
                  const isPending = tx.status === 'pending'
                  const CategoryIcon = getDynamicIcon(category?.icon || 'Tag')

                  return (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={() => {
                        vibrate([5])
                        router.push(`/transactions/details?id=${tx.id}`)
                      }}
                      className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50 active:scale-[0.99] dark:hover:bg-slate-800/40"
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
                        style={{
                          backgroundColor: `${category?.color || '#94a3b8'}20`,
                          color: category?.color || '#64748b',
                        }}
                      >
                        <CategoryIcon size={17} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                          {tx.description ||
                            (tx.debt_id ? 'Recebimento' : 'Sem descrição')}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {formatIsoDate(tx.date)} ·{' '}
                          {isPending
                            ? isIncome
                              ? 'A receber'
                              : 'A pagar'
                            : isIncome
                              ? 'Recebido'
                              : 'Pago'}
                        </p>
                      </div>

                      <p
                        className={`shrink-0 text-[13px] font-black ${
                          isIncome ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatCurrency(Math.abs(Number(tx.amount) || 0))}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {showDeleteSheet &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => !deleting && setShowDeleteSheet(false)}
          >
            <div
              className="w-full max-w-lg rounded-t-[32px] bg-white p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-2xl dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-6 h-1.5 w-11 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/30">
                  <AlertTriangle size={24} />
                </div>
                <h2 className="text-[18px] font-bold text-slate-900 dark:text-slate-100">
                  Excluir contato?
                </h2>
                <p className="mx-auto mt-2 max-w-[310px] text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                  O cadastro será removido. Transações e cobranças continuarão
                  existindo, preservando o histórico, mas sem vínculo com o contato.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setShowDeleteSheet(false)}
                  className="flex-1 rounded-[20px] bg-slate-100 px-4 py-3.5 text-[14px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="flex-1 rounded-[20px] bg-red-500 px-4 py-3.5 text-[14px] font-bold text-white disabled:opacity-50"
                >
                  {deleting ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showReceivableSheet &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm"
            onClick={() =>
              !creatingReceivable && setShowReceivableSheet(false)
            }
          >
            <div
              className="w-full max-w-lg rounded-t-[32px] bg-white p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-2xl dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-6 h-1.5 w-11 rounded-full bg-slate-200 dark:bg-slate-700" />

              <div className="mb-5">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400">
                  <Wallet size={20} />
                </div>
                <h2 className="text-[19px] font-bold text-slate-900 dark:text-slate-100">
                  Novo valor a receber
                </h2>
                <p className="mt-1 text-[12px] text-slate-400">
                  Vinculado a {contact.name}. Pode receber parcialmente depois.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 ml-1 block text-[11px] font-semibold text-slate-500">
                    Valor
                  </label>
                  <div className="flex items-center rounded-[18px] border border-slate-200 bg-slate-50 px-4 focus-within:ring-4 focus-within:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-800">
                    <span className="mr-2 text-[14px] font-bold text-slate-400">R$</span>
                    <input
                      value={receivableAmount}
                      onChange={(event) => setReceivableAmount(event.target.value)}
                      inputMode="decimal"
                      placeholder="0,00"
                      className="min-w-0 flex-1 bg-transparent py-3.5 text-[18px] font-black text-slate-900 outline-none dark:text-slate-100"
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDueDatePicker(true)}
                  className="flex w-full items-center justify-between rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3.5 text-left transition active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <CalendarDays size={17} className="text-slate-400" />
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">
                        Vencimento
                      </p>
                      <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
                        {receivableDueDate
                          ? formatDateLabel(receivableDueDate)
                          : 'Sem vencimento'}
                      </p>
                    </div>
                  </div>
                </button>

                <textarea
                  value={receivableDescription}
                  onChange={(event) =>
                    setReceivableDescription(event.target.value)
                  }
                  placeholder="Descrição ou observação (opcional)"
                  rows={3}
                  className="w-full resize-none rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3.5 text-[13px] text-slate-900 outline-none focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  disabled={creatingReceivable}
                  onClick={() => setShowReceivableSheet(false)}
                  className="flex-1 rounded-[20px] bg-slate-100 px-4 py-3.5 text-[14px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={creatingReceivable}
                  onClick={handleCreateReceivable}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[20px] bg-teal-600 px-4 py-3.5 text-[14px] font-bold text-white disabled:opacity-50"
                >
                  <Check size={16} />
                  {creatingReceivable ? 'Salvando...' : 'Criar'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <DatePickerSheet
        isOpen={showDueDatePicker}
        value={receivableDueDate}
        onChange={setReceivableDueDate}
        onClose={() => setShowDueDatePicker(false)}
        title="Vencimento"
      />
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
