// src/app/(app)/contacts/page.tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  ArrowDown,
  ArrowUp,
  Building2,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react'

import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useContactsList } from '@/hooks/useContactsList'
import { useLocalData } from '@/hooks/useLocalData'
import { useLocalSync } from '@/hooks/useLocalSync'
import { useSafeDb } from '@/hooks/useSafeDb'
import type { LocalContact, LocalDebt, LocalTransaction } from '@/lib/db'
import {
  getContactEntityLabel,
  getContactEntityType,
  getContactFinancialSummary,
  getContactRelationshipShortLabel,
  getContactRelationshipType,
  normalizeContactSearch,
  type ContactRelationshipType,
} from '@/lib/contactOperations'

type RelationshipFilter = 'all' | ContactRelationshipType

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export default function ContactsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { vibrate, success, error: hapticError } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { appMode, context } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  const { safeDelete } = useSafeDb()

  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [relationshipFilter, setRelationshipFilter] =
    useState<RelationshipFilter>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: contacts, loading } = useContactsList(effectiveContext)
  const { data: transactions } = useLocalData<LocalTransaction>({
    table: 'transactions',
    filters: { context: effectiveContext },
  })
  const { data: debts } = useLocalData<LocalDebt>({
    table: 'debts',
    filters: { context: effectiveContext },
    orderBy: 'updated_at',
  })

  const summaryByContact = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getContactFinancialSummary>>()

    for (const contact of contacts as LocalContact[]) {
      map.set(
        contact.id,
        getContactFinancialSummary({
          contactId: contact.id,
          transactions,
          debts,
        })
      )
    }

    return map
  }, [contacts, debts, transactions])

  const totals = useMemo(() => {
    let receivable = 0
    let payable = 0

    for (const summary of summaryByContact.values()) {
      receivable += summary.receivable
      payable += summary.payable
    }

    return { receivable, payable }
  }, [summaryByContact])

  const filteredContacts = useMemo(() => {
    const needle = normalizeContactSearch(search)

    return (contacts as LocalContact[]).filter((contact) => {
      const relationship = getContactRelationshipType(contact)

      if (
        relationshipFilter !== 'all' &&
        relationship !== relationshipFilter
      ) {
        return false
      }

      if (!needle) return true

      const haystack = [
        contact.name,
        contact.email,
        contact.phone,
        contact.company,
        contact.document,
        contact.city,
      ]
        .filter(Boolean)
        .map((value) => normalizeContactSearch(String(value)))
        .join(' ')

      return haystack.includes(needle)
    })
  }, [contacts, relationshipFilter, search])

  const groupedContacts = useMemo(() => {
    const groups = new Map<string, LocalContact[]>()

    for (const contact of filteredContacts) {
      const letter = (contact.name?.trim()?.[0] || '#').toUpperCase()
      const current = groups.get(letter) || []
      current.push(contact)
      groups.set(letter, current)
    }

    return Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b, 'pt-BR')
    )
  }, [filteredContacts])

  const selectedContact = useMemo(
    () =>
      (contacts as LocalContact[]).find((contact) => contact.id === deleteId) ||
      null,
    [contacts, deleteId]
  )

  const handleDelete = async () => {
    if (!deleteId || deleting) return

    setDeleting(true)
    vibrate([10, 50])

    try {
      const result = await safeDelete('contacts', deleteId)
      if (!result.success) throw new Error(result.error)

      success()
      showToast('Contato excluído. O histórico financeiro foi preservado.', 'success')
      setDeleteId(null)
    } catch (error: any) {
      hapticError()
      showToast(error?.message || 'Erro ao excluir contato.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const filterOptions: Array<{
    key: RelationshipFilter
    label: string
  }> = [
    { key: 'all', label: 'Todos' },
    { key: 'customer', label: 'Clientes' },
    { key: 'supplier', label: 'Fornecedores' },
    { key: 'both', label: 'Ambos' },
    { key: 'other', label: 'Outros' },
  ]

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f8f9fa] pb-24 transition-colors dark:bg-slate-950">
      {(loading || pendingCount > 0) && (
        <div className="fixed right-4 top-20 z-50">
          <div className="h-3 w-3 animate-pulse rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#f8f9fa]/94 px-4 pb-3 pt-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/94">
        <div className="mx-auto max-w-xl rounded-[26px] border border-slate-200/70 bg-white/95 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  vibrate([5])
                  router.push('/more')
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-slate-100 text-slate-600 transition active:scale-95 dark:bg-slate-800 dark:text-slate-300"
                aria-label="Voltar"
              >
                <ChevronLeft size={19} />
              </button>

              <div className="min-w-0">
                <h1 className="text-[23px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Contatos
                </h1>
                <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                  Clientes, fornecedores e histórico financeiro
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  vibrate([5])
                  setShowSearch((current) => !current)
                }}
                className="flex h-11 w-11 items-center justify-center rounded-[17px] border border-slate-200 bg-slate-50 text-slate-600 transition active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                aria-label={showSearch ? 'Fechar busca' : 'Buscar contato'}
              >
                {showSearch ? <X size={18} /> : <Search size={18} />}
              </button>

              <button
                type="button"
                onClick={() => {
                  vibrate([10])
                  router.push('/contacts/new')
                }}
                className="flex h-11 w-11 items-center justify-center rounded-[17px] bg-teal-600 text-white shadow-lg shadow-teal-600/20 transition active:scale-95"
                aria-label="Novo contato"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <ContextToggle />

          {showSearch && (
            <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 rounded-[17px] border border-slate-200 bg-slate-50 px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-800">
                <Search size={17} className="shrink-0 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nome, telefone, empresa, documento..."
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition active:scale-95"
                    aria-label="Limpar busca"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-4">
        <section className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-[13px] bg-white/80 text-emerald-600 shadow-sm dark:bg-slate-900/70 dark:text-emerald-400">
              <ArrowUp size={17} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/70 dark:text-emerald-400/70">
              A receber
            </p>
            <p className="mt-0.5 text-[18px] font-black text-emerald-700 dark:text-emerald-400">
              {formatCurrency(totals.receivable)}
            </p>
          </div>

          <div className="rounded-[24px] border border-red-100 bg-red-50/80 p-4 dark:border-red-900/40 dark:bg-red-950/20">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-[13px] bg-white/80 text-red-500 shadow-sm dark:bg-slate-900/70">
              <ArrowDown size={17} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600/70 dark:text-red-400/70">
              A pagar
            </p>
            <p className="mt-0.5 text-[18px] font-black text-red-600 dark:text-red-400">
              {formatCurrency(totals.payable)}
            </p>
          </div>
        </section>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filterOptions.map((option) => {
            const active = relationshipFilter === option.key
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  vibrate([5])
                  setRelationshipFilter(option.key)
                }}
                className={`h-10 shrink-0 rounded-[17px] border px-3.5 text-[13px] font-semibold transition active:scale-[0.98] ${
                  active
                    ? 'border-transparent bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton count={5} height="104px" borderRadius="24px" />
          </div>
        ) : groupedContacts.length === 0 ? (
          <section className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Users size={27} className="text-slate-300 dark:text-slate-600" />
            </div>
            <h2 className="text-[15px] font-bold text-slate-800 dark:text-slate-200">
              {search ? 'Nenhum contato encontrado' : 'Nenhum contato por aqui'}
            </h2>
            <p className="mt-1 max-w-[260px] text-[12px] leading-relaxed text-slate-400 dark:text-slate-500">
              {search
                ? 'Tente outro termo ou altere o filtro.'
                : 'Cadastre clientes e fornecedores para conectar cobranças e transações.'}
            </p>
          </section>
        ) : (
          <div className="space-y-5 pb-4">
            {groupedContacts.map(([letter, group]) => (
              <section key={letter}>
                <div className="mb-2 px-1">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {letter}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {group.map((contact) => {
                    const entityType = getContactEntityType(contact)
                    const summary = summaryByContact.get(contact.id)
                    const relationshipLabel =
                      getContactRelationshipShortLabel(contact)

                    return (
                      <article
                        key={contact.id}
                        className="rounded-[24px] border border-slate-200/70 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              vibrate([5])
                              router.push(`/contacts/details?id=${contact.id}`)
                            }}
                            className="flex min-w-0 flex-1 items-start gap-3 text-left"
                          >
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] ${
                                entityType === 'company'
                                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
                                  : 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400'
                              }`}
                            >
                              {entityType === 'company' ? (
                                <Building2 size={18} />
                              ) : (
                                <span className="text-[12px] font-black">
                                  {initials(contact.name)}
                                </span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="max-w-full truncate text-[14px] font-bold text-slate-900 dark:text-slate-100">
                                  {contact.name}
                                </h3>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                  {relationshipLabel}
                                </span>
                                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[9px] font-semibold text-slate-400 dark:bg-slate-800/70">
                                  {getContactEntityLabel(contact)}
                                </span>
                              </div>

                              {(contact.company || contact.phone || contact.email) && (
                                <div className="mt-1.5 space-y-1">
                                  {contact.company && entityType === 'individual' && (
                                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                      {contact.company}
                                    </p>
                                  )}
                                  {contact.phone && (
                                    <p className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                                      <Phone size={11} />
                                      <span>{contact.phone}</span>
                                    </p>
                                  )}
                                  {!contact.phone && contact.email && (
                                    <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                                      <Mail size={11} />
                                      <span className="truncate">{contact.email}</span>
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </button>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                vibrate([10])
                                setDeleteId(contact.id)
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition hover:bg-red-50 hover:text-red-500 active:scale-95 dark:hover:bg-red-950/30"
                              aria-label={`Excluir ${contact.name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                vibrate([5])
                                router.push(`/contacts/details?id=${contact.id}`)
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition active:scale-95 dark:bg-slate-800"
                              aria-label={`Abrir ${contact.name}`}
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>

                        {summary &&
                          (summary.receivable > 0 ||
                            summary.payable > 0 ||
                            summary.transactionCount > 0) && (
                            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                              {summary.receivable > 0 && (
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                                  A receber {formatCurrency(summary.receivable)}
                                </span>
                              )}
                              {summary.payable > 0 && (
                                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-600 dark:bg-red-950/30 dark:text-red-400">
                                  A pagar {formatCurrency(summary.payable)}
                                </span>
                              )}
                              {summary.openDebtCount > 0 && (
                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                                  {summary.openDebtCount} cobrança
                                  {summary.openDebtCount === 1 ? '' : 's'}
                                </span>
                              )}
                              <span className="ml-auto text-[10px] font-medium text-slate-400">
                                {summary.transactionCount} movimentação
                                {summary.transactionCount === 1 ? '' : 'ões'}
                              </span>
                            </div>
                          )}
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {deleteId &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteId(null)}
          >
            <div
              className="w-full max-w-lg rounded-t-[32px] bg-white p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-2xl dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-6 h-1.5 w-11 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/30">
                  <Trash2 size={23} />
                </div>
                <h2 className="text-[18px] font-bold text-slate-900 dark:text-slate-100">
                  Excluir contato?
                </h2>
                <p className="mx-auto mt-2 max-w-[300px] text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {selectedContact?.name || 'Este contato'} será removido. Transações,
                  cobranças e histórico financeiro continuarão existindo sem o vínculo.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteId(null)}
                  className="flex-1 rounded-[20px] bg-slate-100 px-4 py-3.5 text-[14px] font-semibold text-slate-700 transition active:scale-[0.98] disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="flex-1 rounded-[20px] bg-red-500 px-4 py-3.5 text-[14px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                >
                  {deleting ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
