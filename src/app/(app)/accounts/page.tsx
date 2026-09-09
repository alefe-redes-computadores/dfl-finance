// src/app/(app)/accounts/page.tsx
'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Search, Trash2, Wallet, X } from 'lucide-react'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useAccountsList } from '@/hooks/useAccountsList'
import { useLocalSync } from '@/hooks/useLocalSync'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useAuth } from '@/lib/hooks/useAuth'
import { getBankIcon } from '@/lib/BankIcons'
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

  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { data: accounts, loading } = useAccountsList(effectiveContext)

  const activeAccounts = useMemo(
    () => (accounts || []).filter((account: any) => !isAccountArchived(account)),
    [accounts]
  )

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return activeAccounts.filter((account: any) => {
      if (accountFilter !== 'all' && account.type !== accountFilter) return false
      if (!term) return true
      return [
        account.name,
        getAccountInstitutionLabel(account),
        getAccountTypeLabel(account.type),
      ].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(term))
    })
  }, [activeAccounts, accountFilter, search])

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
    <div className="flex h-[100dvh] flex-col bg-[#f6f7f8] font-sans transition-colors duration-300 dark:bg-slate-950">
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

      <div className="sticky top-0 z-40 border-b border-black/5 bg-[#f6f7f8]/92 px-4 pb-3 pt-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/92">
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

      <div ref={scrollRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="custom-scrollbar flex-1 overflow-y-auto px-4 pb-28 pt-3">
        {!loading && (
          <div className="mx-auto mb-3 w-full max-w-2xl overflow-hidden rounded-[22px] bg-slate-950 px-5 py-4 text-white shadow-sm dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-[11px] font-medium text-slate-400">Saldo consolidado</p>
                <p className={`text-[29px] font-semibold leading-none tracking-tight ${totalBalance > 0 ? 'text-emerald-400' : totalBalance < 0 ? 'text-red-400' : 'text-slate-400'}`}>{formatCurrency(totalBalance)}</p>
                <p className="mt-2 text-[11px] font-medium text-slate-400">{activeAccounts.length} {activeAccounts.length === 1 ? 'conta ativa' : 'contas ativas'}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/10"><Wallet size={22} className="text-teal-300" /></div>
            </div>
          </div>
        )}

        {!loading && activeAccounts.length > 0 && (
          <div className="scrollbar-hide mx-auto mb-1 flex w-full max-w-2xl gap-2 overflow-x-auto pb-3">
            {[{ key: 'all', label: 'Todas' }, { key: 'checking', label: 'Corrente' }, { key: 'savings', label: 'Poupança' }, { key: 'investment', label: 'Investimentos' }, { key: 'wallet', label: 'Carteira' }].map((filter) => (
              <button type="button" key={filter.key} onClick={() => { vibrate([5]); setAccountFilter(filter.key) }} className={`h-8 shrink-0 rounded-full border px-3 text-[12px] font-semibold transition-all active:scale-[0.97] ${accountFilter === filter.key ? 'border-transparent bg-gray-950 text-white dark:bg-white dark:text-gray-950' : 'border-black/5 bg-white text-gray-500 dark:border-white/10 dark:bg-slate-900 dark:text-gray-400'}`}>{filter.label}</button>
            ))}
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
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[13px]">{getBankIcon(group.institution)}</div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-gray-950 dark:text-gray-100">{group.institution}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">{group.accounts.length} {group.accounts.length === 1 ? 'conta' : 'contas'}</p>
                    </div>
                  </div>
                  <p className={`shrink-0 text-[13px] font-semibold ${group.balance > 0 ? 'text-emerald-600 dark:text-emerald-400' : group.balance < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>{formatCurrency(group.balance)}</p>
                </div>

                {group.accounts.map((account: any, index: number) => (
                  <div key={account.id} onClick={() => { vibrate([5]); router.push(`/accounts/details?id=${account.id}`) }} className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 transition-colors active:bg-gray-50 dark:active:bg-slate-800 ${index !== group.accounts.length - 1 ? 'border-b border-gray-100 dark:border-slate-700/50' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-gray-950 dark:text-gray-100">{account.name}</p>
                      <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">{getAccountTypeLabel(account.type)}</p>
                      <p className={`mt-1 text-[14px] font-semibold ${Number(account.balance || 0) > 0 ? 'text-emerald-500 dark:text-emerald-400' : Number(account.balance || 0) < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>{formatCurrency(Number(account.balance || 0))}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={(event) => { event.stopPropagation(); vibrate([10]); setDeleteModal(account.id) }} className="rounded-full p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20" aria-label="Excluir conta"><Trash2 size={16} /></button>
                      <ChevronRight size={16} className="text-gray-400" />
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>

      {deleteModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setDeleteModal(null)}>
          <div className="w-full max-w-sm rounded-t-[32px] bg-white p-6 shadow-2xl dark:bg-slate-800 sm:rounded-[32px]" onClick={(event) => event.stopPropagation()}>
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
