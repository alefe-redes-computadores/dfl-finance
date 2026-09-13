// src/app/(app)/accounts/page.tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  ArrowDownAZ,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import BankLogo from '@/components/BankLogo'
import Skeleton from '@/components/Skeleton'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useAccountsList } from '@/hooks/useAccountsList'
import { useLocalSync } from '@/hooks/useLocalSync'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  getAccountInstitutionLabel,
  getAccountTypeLabel,
  groupAccountsByInstitution,
  isAccountArchived,
} from '@/lib/accountPresentation'

function AccountsContent() {
  const router = useRouter()
  const { showToast } = useToast()
  const { success, error: errorHaptic, vibrate } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { user } = useAuth()
  const { appMode, effectiveContext } = useContext_()
  const { safeDelete } = useSafeDb()

  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [accountFilter, setAccountFilter] = useState('all')
  const [showViewOptions, setShowViewOptions] = useState(false)
  const [accountSort, setAccountSort] = useState<
    'balance' | 'institution' | 'name'
  >('institution')

  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { data: accounts, loading } = useAccountsList(effectiveContext)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        'dfl_accounts_sort'
      )

      if (
        saved === 'balance' ||
        saved === 'institution' ||
        saved === 'name'
      ) {
        setAccountSort(saved)
      }
    } catch {
      // localStorage pode estar indisponível em ambientes restritos.
    }
  }, [])

  const changeAccountSort = (
    next: 'balance' | 'institution' | 'name'
  ) => {
    vibrate([5])
    setAccountSort(next)

    try {
      localStorage.setItem(
        'dfl_accounts_sort',
        next
      )
    } catch {
      // Preferência local é opcional.
    }
  }

  const activeAccounts = useMemo(
    () => (accounts || []).filter((account: any) => !isAccountArchived(account)),
    [accounts]
  )

  const filteredAccounts = useMemo(() => {
    const term =
      search.trim().toLocaleLowerCase('pt-BR')

    const filtered = activeAccounts.filter(
      (account: any) => {
        if (
          accountFilter !== 'all' &&
          account.type !== accountFilter
        ) {
          return false
        }

        if (!term) return true

        return [
          account.name,
          getAccountInstitutionLabel(account),
          getAccountTypeLabel(account.type),
        ].some((value) =>
          String(value || '')
            .toLocaleLowerCase('pt-BR')
            .includes(term)
        )
      }
    )

    return [...filtered].sort((a: any, b: any) => {
      if (accountSort === 'balance') {
        return (
          Number(b.balance || 0) -
          Number(a.balance || 0)
        )
      }

      if (accountSort === 'name') {
        return String(a.name || '').localeCompare(
          String(b.name || ''),
          'pt-BR'
        )
      }

      const institutionCompare =
        getAccountInstitutionLabel(a).localeCompare(
          getAccountInstitutionLabel(b),
          'pt-BR'
        )

      if (institutionCompare !== 0) {
        return institutionCompare
      }

      return String(a.name || '').localeCompare(
        String(b.name || ''),
        'pt-BR'
      )
    })
  }, [
    activeAccounts,
    accountFilter,
    accountSort,
    search,
  ])

  const accountGroups = useMemo(
    () => groupAccountsByInstitution(filteredAccounts),
    [filteredAccounts]
  )

  const totalBalance = useMemo(
    () => activeAccounts.reduce((sum: number, account: any) => sum + Number(account.balance || 0), 0),
    [activeAccounts]
  )

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const handleDelete = async () => {
    if (!deleteModal || !user) return
    try {
      const result = await safeDelete('accounts', deleteModal)
      if (!result.success) {
        showToast(`Erro ao excluir: ${result.error}`, 'error')
        errorHaptic()
        return
      }
      showToast('Conta excluída com sucesso!', 'success')
      success()
      setDeleteModal(null)
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, 'error')
      errorHaptic()
    }
  }

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    touchStartY.current = event.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      const deltaY = event.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        vibrate([10])
        setTimeout(() => setRefreshing(false), 600)
      }
    }
  }, [refreshing, vibrate])

  return (
    <div className="min-h-full bg-gray-50 font-sans transition-colors duration-300 dark:bg-slate-950">
      {(loading || pendingCount > 0) && (
        <div className="fixed right-6 top-6 z-50">
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      {refreshing && (
        <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center pt-6">
          <div className="flex items-center gap-2 rounded-full border border-gray-200/70 bg-white px-4 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-semibold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="app-topbar">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <button onClick={() => { vibrate([5]); router.push('/more') }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-black/5 bg-white text-gray-500 shadow-sm transition-all active:scale-95 dark:border-white/10 dark:bg-slate-900 dark:text-gray-300">
                <ChevronLeft size={20} />
              </button>
              <div className="min-w-0">
                <h1 className="text-[22px] font-semibold tracking-tight text-gray-950 dark:text-white">Contas</h1>
                <p className="mt-0.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                  {appMode === 'personal_only' ? 'Visão pessoal' : 'Visão global'} · agrupadas por instituição
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => { vibrate([5]); setShowSearch((value) => !value) }} className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-black/5 bg-white text-gray-600 shadow-sm transition-all active:scale-95 dark:border-white/10 dark:bg-slate-900 dark:text-gray-300">
                {showSearch ? <X size={18} /> : <Search size={18} />}
              </button>
              <button type="button" onClick={() => { vibrate([10]); router.push('/accounts/new') }} className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-teal-600 text-white shadow-sm shadow-teal-600/20 transition-all active:scale-95">
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1"><ContextToggle /></div>
            <span className="shrink-0 rounded-full border border-black/5 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-400">
              {effectiveContext === 'dfl' ? 'Empresa (PJ)' : 'Pessoal (PF)'}
            </span>
          </div>

          {showSearch && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900">
                <Search size={18} className="shrink-0 text-gray-400" />
                <input type="text" placeholder="Buscar conta ou instituição..." value={search} onChange={(event) => setSearch(event.target.value)} className="flex-1 bg-transparent text-[14px] text-gray-800 outline-none placeholder-gray-400 dark:text-gray-200" autoFocus />
                {search && <button onClick={() => setSearch('')} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400"><X size={14} /></button>}
              </div>
            </div>
          )}
        </div>
      </div>

      <div ref={scrollRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="px-4 pb-8 pt-3">
        {!loading && (
          <div className="mx-auto mb-3 w-full max-w-2xl overflow-hidden rounded-[20px] bg-slate-950 px-4 py-4 text-white shadow-sm dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-[11px] font-medium text-slate-400">Saldo consolidado</p>
                <p className={`text-[26px] font-semibold leading-none tracking-tight ${totalBalance > 0 ? 'text-emerald-400' : totalBalance < 0 ? 'text-red-400' : 'text-slate-400'}`}>{formatCurrency(totalBalance)}</p>
                <p className="mt-2 text-[11px] font-medium text-slate-400">{activeAccounts.length} {activeAccounts.length === 1 ? 'conta ativa' : 'contas ativas'}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/10"><Wallet size={22} className="text-teal-300" /></div>
            </div>
          </div>
        )}

        {!loading && activeAccounts.length > 0 && (
          <div className="mx-auto mb-3 flex w-full max-w-2xl items-center gap-2">
            <button
              type="button"
              onClick={() => {
                vibrate([5])
                setShowViewOptions(true)
              }}
              className="flex h-9 items-center gap-2 rounded-[14px] border border-black/5 bg-white px-3 text-[11px] font-semibold text-gray-600 shadow-sm transition-all active:scale-[0.97] dark:border-white/10 dark:bg-slate-900 dark:text-gray-300"
            >
              <SlidersHorizontal size={14} />
              Filtros e ordem
            </button>

            {accountFilter !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  vibrate([5])
                  setAccountFilter('all')
                }}
                className="flex h-9 min-w-0 items-center gap-1.5 rounded-full bg-gray-950 px-3 text-[10px] font-semibold text-white dark:bg-white dark:text-gray-950"
              >
                <Filter size={12} />

                <span className="truncate">
                  {getAccountTypeLabel(accountFilter)}
                </span>

                <X size={12} />
              </button>
            )}

            <span className="ml-auto text-[10px] font-medium text-gray-400">
              {filteredAccounts.length}{' '}
              {filteredAccounts.length === 1
                ? 'conta'
                : 'contas'}
            </span>
          </div>
        )}

        {loading ? (
          <div className="mx-auto w-full max-w-2xl space-y-3"><Skeleton count={1} className="h-[120px] rounded-[24px]" /><Skeleton count={3} className="h-[90px] rounded-[18px]" /></div>
        ) : accountGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gray-200/70 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"><Wallet size={28} className="text-gray-400" /></div>
            <p className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">Nenhuma conta encontrada</p>
            <p className="mt-1 text-center text-[12px] text-gray-400 dark:text-gray-500">Toque no + para adicionar uma nova conta.</p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl space-y-3">
            {accountGroups.map((group) => (
              <section key={group.institution} className="overflow-hidden rounded-[22px] border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-slate-700/60">
                  <div className="flex min-w-0 items-center gap-3">
                    <BankLogo name={group.institution} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-gray-950 dark:text-gray-100">{group.institution}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">{group.accounts.length} {group.accounts.length === 1 ? 'conta' : 'contas'}</p>
                    </div>
                  </div>
                  <p className={`shrink-0 text-[13px] font-semibold ${group.balance > 0 ? 'text-emerald-600 dark:text-emerald-400' : group.balance < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>{formatCurrency(group.balance)}</p>
                </div>

                {group.accounts.map((account: any, index: number) => (
                  <div key={account.id} onClick={() => { vibrate([5]); router.push(`/accounts/details?id=${account.id}`) }} className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors active:bg-gray-50 dark:active:bg-slate-800 ${index !== group.accounts.length - 1 ? 'border-b border-gray-100 dark:border-slate-700/50' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-[14px] font-semibold text-gray-950 dark:text-gray-100">{account.name}</p>
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[9.5px] font-semibold text-gray-500 dark:bg-slate-800 dark:text-gray-400">{getAccountTypeLabel(account.type)}</span>
                      </div>
                    </div>

                    <p className={`shrink-0 text-[14px] font-semibold ${Number(account.balance || 0) > 0 ? 'text-emerald-500 dark:text-emerald-400' : Number(account.balance || 0) < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>{formatCurrency(Number(account.balance || 0))}</p>

                    <button onClick={(event) => { event.stopPropagation(); vibrate([10]); setDeleteModal(account.id) }} className="shrink-0 rounded-full p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20" aria-label="Excluir conta"><Trash2 size={16} /></button>

                    <ChevronRight size={16} className="shrink-0 text-gray-300 dark:text-gray-600" />
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>

      {showViewOptions && createPortal(
        <div
          className="fixed inset-0 z-[99998] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setShowViewOptions(false)}
        >
          <div
            className="w-full max-w-md rounded-t-[24px] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-[24px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="app-sheet-handle" />

            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[17px] font-semibold text-gray-900 dark:text-white">
                  Exibição das contas
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  Filtre sem ocupar espaço permanente na tela.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowViewOptions(false)}
                className="app-icon-button"
              >
                <X size={17} />
              </button>
            </div>

            <div>
              <p className="app-form-label">
                Tipo de conta
              </p>

              <div className="grid grid-cols-2 gap-2">
                {[
                  ['all', 'Todas'],
                  ['checking', 'Corrente'],
                  ['savings', 'Poupança'],
                  ['investment', 'Investimentos'],
                  ['wallet', 'Carteira'],
                ].map(([key, label]) => {
                  const active = accountFilter === key

                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => {
                        vibrate([5])
                        setAccountFilter(key)
                      }}
                      className={`flex min-h-11 items-center justify-between rounded-[14px] border px-3 text-left text-[11px] font-semibold transition ${
                        active
                          ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400'
                          : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300'
                      }`}
                    >
                      {label}
                      {active && <Check size={14} />}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-5">
              <p className="app-form-label">
                Ordenar por
              </p>

              <div className="space-y-2">
                {[
                  ['institution', 'Banco e conta', ArrowDownAZ],
                  ['balance', 'Maior saldo', ArrowUpDown],
                  ['name', 'Nome da conta', ArrowDownAZ],
                ].map(([key, label, Icon]: any[]) => {
                  const active = accountSort === key

                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() =>
                        changeAccountSort(key)
                      }
                      className={`flex min-h-11 w-full items-center gap-3 rounded-[14px] border px-3 text-left transition ${
                        active
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
                          : 'border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800'
                      }`}
                    >
                      <Icon
                        size={16}
                        className={
                          active
                            ? 'text-teal-600 dark:text-teal-400'
                            : 'text-gray-400'
                        }
                      />

                      <span className={`flex-1 text-[12px] font-semibold ${
                        active
                          ? 'text-teal-700 dark:text-teal-400'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {label}
                      </span>

                      {active && (
                        <Check
                          size={15}
                          className="text-teal-600"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowViewOptions(false)}
              className="mt-5 h-11 w-full rounded-[15px] bg-gray-950 text-[12px] font-semibold text-white active:scale-[0.99] dark:bg-white dark:text-gray-950"
            >
              Aplicar
            </button>
          </div>
        </div>,
        document.body
      )}

      {deleteModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setDeleteModal(null)}>
          <div className="w-full max-w-sm rounded-t-[24px] bg-white p-5 shadow-2xl dark:bg-slate-800 sm:rounded-[24px]" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-900/30"><Trash2 size={28} /></div>
            <h3 className="mb-2 text-center text-[20px] font-semibold text-gray-800 dark:text-gray-100">Excluir conta</h3>
            <p className="mb-8 text-center text-[14px] text-gray-500 dark:text-gray-400">A exclusão só será concluída se as regras de dependência permitirem.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteModal(null)} className="flex-1 rounded-[20px] bg-gray-100 py-4 text-[15px] font-semibold text-gray-600 dark:bg-slate-700 dark:text-gray-300">Cancelar</button>
              <button type="button" onClick={handleDelete} className="flex-1 rounded-[20px] bg-red-500 py-4 text-[15px] font-semibold text-white shadow-lg shadow-red-500/20">Excluir</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default function AccountsPage() {
  return <AccountsContent />
}
