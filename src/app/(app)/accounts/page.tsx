'use client'

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import {
  Search,
  Plus,
  X,
  RefreshCw,
  Wallet,
  Building2,
  CreditCard,
  PiggyBank,
  Trash2,
  ChevronRight,
  ChevronLeft, // ✅ ADICIONADO
  Landmark,
  Briefcase
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import ContextToggle from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"
import { useSafeDb } from '@/hooks/useSafeDb'

const ACCOUNT_ICONS: Record<string, any> = {
  checking: Landmark,
  savings: PiggyBank,
  investment: Building2,
  credit_card: CreditCard,
  wallet: Wallet,
  other: Briefcase,
}

const ACCOUNT_LABELS: Record<string, string> = {
  checking: "Conta Corrente",
  savings: "Poupança",
  investment: "Investimento",
  credit_card: "Cartão de Crédito",
  wallet: "Carteira Física",
  other: "Outros",
}

function AccountsContent() {
  const router = useRouter()
  const { showToast } = useToast()
  const { success, error: errorHaptic, vibrate } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { user } = useAuth()
  const { appMode, effectiveContext } = useContext_()
  const { safeDelete } = useSafeDb()

  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [accountFilter, setAccountFilter] = useState<string>('all')
  
  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: accounts, loading, reload } = useLocalData({
    table: 'accounts' as any,
    filters: { context: effectiveContext },
  })

  const handleDelete = async () => {
    if (!deleteModal || !user) return
    try {
      const result = await safeDelete('accounts', deleteModal)
      if (!result.success) {
        showToast(`Erro ao excluir: ${result.error}`, "error")
        errorHaptic()
        return
      }
      showToast("Conta excluída com sucesso!", "success")
      success()
      setDeleteModal(null)
      reload()
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, "error")
      errorHaptic()
    }
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        vibrate([10])
        reload().finally(() => {
          setTimeout(() => setRefreshing(false), 600)
        })
      }
    }
  }, [refreshing, reload, vibrate])

  const filteredAccounts = (accounts || []).filter((acc: any) => {
    if (accountFilter !== 'all' && acc.type !== accountFilter) return false
    
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (acc.name && acc.name.toLowerCase().includes(s)) ||
      (acc.bank && acc.bank.toLowerCase().includes(s)) ||
      (acc.type && ACCOUNT_LABELS[acc.type]?.toLowerCase().includes(s))
    )
  })

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)

  const totalBalance = (accounts || []).reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0)

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f8f9fa] dark:bg-slate-900 font-sans transition-colors duration-300">
      
      {/* Ponto de Luz de Sincronização */}
      {(loading || pendingCount > 0) && (
        <div className="fixed top-6 right-6 z-50">
          <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-sm rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200/70 dark:border-slate-700">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-semibold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* 🔥 HEADER UNIFICADO COM BOTÃO DE VOLTAR */}
      <div className="sticky top-0 z-40 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              {/* ✅ ADICIONADO: Botão Voltar Padronizado */}
              <button
                onClick={() => { vibrate([5]); router.push('/more'); }}
                className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98] shrink-0"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="text-[24px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                  Contas
                </h1>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {appMode === "personal_only" ? "Visão pessoal" : "Visão global"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => { vibrate([5]); setShowSearch(!showSearch); }}
                className="h-11 w-11 rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/40 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
              >
                {showSearch ? <X size={18} /> : <Search size={18} />}
              </button>

              <button
                type="button"
                onClick={() => { vibrate([10]); router.push("/accounts/new"); }}
                className="h-11 w-11 rounded-[18px] bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98]"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <ContextToggle />
            </div>

            <span className="shrink-0 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 px-3 py-2 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
              {effectiveContext === 'dfl' ? 'Empresa (PJ)' : 'Pessoal (PF)'}
            </span>
          </div>

          {showSearch && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
                <Search size={18} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar conta..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-[14px] text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none"
                  autoFocus
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className="flex-1 overflow-y-auto px-4 pt-3 pb-28 custom-scrollbar"
      >
        {/* CARD DE SALDO CONSOLIDADO - VISUAL NEUTRO */}
        {!loading && (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5 mb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1">
                  Saldo consolidado
                </p>
                <p className="text-[30px] leading-none font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                  {formatCurrency(totalBalance)}
                </p>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-2">
                  Compondo {accounts?.length || 0} {(accounts?.length || 0) === 1 ? 'conta' : 'contas'}
                </p>
              </div>

              <div className="w-12 h-12 rounded-[18px] bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
                <Wallet size={22} className="text-teal-600 dark:text-teal-400" />
              </div>
            </div>
          </div>
        )}

        {/* FILTROS RÁPIDOS - MAIS COMPACTOS */}
        {!loading && accounts?.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-1">
            {[
              { key: 'all', label: 'Todas' },
              { key: 'checking', label: 'Corrente' },
              { key: 'savings', label: 'Poupança' },
              { key: 'investment', label: 'Investimentos' },
              { key: 'wallet', label: 'Física' },
            ].map(f => (
              <button
                type="button"
                key={f.key}
                onClick={() => { vibrate([5]); setAccountFilter(f.key); }}
                className={`h-10 px-3.5 rounded-[18px] border whitespace-nowrap shrink-0 text-[13px] font-semibold transition-colors active:scale-[0.98] ${
                  accountFilter === f.key
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200/70 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* LISTAGEM DE CONTAS */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton count={1} height="120px" borderRadius="24px" />
            <Skeleton count={3} height="80px" borderRadius="18px" />
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full border border-gray-200/70 dark:border-slate-700 shadow-sm flex items-center justify-center mb-4">
              <Wallet size={28} className="opacity-30 text-gray-500" />
            </div>
            <p className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">
              Nenhuma conta encontrada
            </p>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1 text-center">
              Toque no + para adicionar uma nova conta.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 animate-in fade-in duration-500">
            {filteredAccounts.map((acc: any) => {
              const Icon = ACCOUNT_ICONS[acc.type] || Wallet
              const label = ACCOUNT_LABELS[acc.type] || acc.type
              const isPositive = (acc.balance || 0) >= 0

              return (
                <div
                  key={acc.id}
                  className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2 relative"
                >
                  <button
                    onClick={() => { vibrate([10]); setDeleteModal(acc.id); }}
                    className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors z-10"
                    title="Excluir conta"
                  >
                    <Trash2 size={15} />
                  </button>

                  <button
                    onClick={() => { vibrate([5]); router.push(`/accounts/details?id=${acc.id}`); }}
                    className="w-full rounded-[18px] p-3 flex items-start gap-3 text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]"
                  >
                    <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 shadow-sm ${
                      isPositive
                        ? "bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400"
                        : "bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"
                    }`}>
                      <Icon size={18} strokeWidth={2.3} />
                    </div>

                    <div className="min-w-0 flex-1 pr-6">
                      <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {acc.name}
                      </p>

                      <div className="mt-1 flex items-center gap-1.5 min-w-0 text-[12px] text-gray-400 dark:text-gray-500">
                        <span className="truncate max-w-[120px]">{label}</span>
                        {acc.bank && (
                          <>
                            <span className="text-gray-300 dark:text-slate-600">•</span>
                            <span className="truncate">{acc.bank}</span>
                          </>
                        )}
                      </div>

                      <p className={`mt-1.5 text-[15px] font-semibold tracking-tight ${
                        isPositive
                          ? "text-teal-600 dark:text-teal-400"
                          : "text-red-500 dark:text-red-400"
                      }`}>
                        {formatCurrency(acc.balance || 0)}
                      </p>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-slate-700 flex items-center justify-center shrink-0">
                      <ChevronRight size={15} className="text-gray-400 dark:text-gray-500" />
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL DE EXCLUSÃO COM PORTAL */}
      {deleteModal && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50 backdrop-blur-sm"
          onClick={() => setDeleteModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 p-6 rounded-t-[32px] sm:rounded-[32px] w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Trash2 size={28} className="text-red-500" />
            </div>
            <h3 className="text-[20px] font-black text-gray-800 dark:text-gray-100 mb-2 text-center tracking-tight">
              Excluir Conta
            </h3>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-8 text-center font-medium px-4">
              Tem certeza que deseja excluir esta conta?
            </p>
            <div className="flex gap-3 pb-safe">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                className="flex-1 py-4 rounded-[20px] bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold text-[15px] active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-4 rounded-[20px] bg-red-500 text-white font-bold text-[15px] shadow-lg shadow-red-500/20 active:scale-[0.98]"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default function AccountsPage() {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => setIsClient(true), [])
  if (!isClient) return <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900" />
  return <AccountsContent />
}