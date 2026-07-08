'use client'

import { useState, useEffect, useCallback, useRef } from "react"
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
  Loader2,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import ContextToggle from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"
import { db } from '@/lib/db'
// 🔥 NOVO: Importando o useSafeDb para blindagem
import { useSafeDb } from '@/hooks/useSafeDb'

const ACCOUNT_ICONS: Record<string, any> = {
  checking: Wallet,
  savings: PiggyBank,
  investment: Building2,
  credit_card: CreditCard,
  wallet: Wallet,
  other: Wallet,
}

const ACCOUNT_LABELS: Record<string, string> = {
  checking: "Conta Corrente",
  savings: "Poupança",
  investment: "Investimento",
  credit_card: "Cartão de Crédito",
  wallet: "Carteira",
  other: "Outro",
}

function AccountsContent() {
  const router = useRouter()
  const { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { user } = useAuth()
  const { context, appMode, effectiveContext } = useContext_()
  // 🔥 NOVO: Hook de blindagem
  const { safeDelete, safeUpdate, safeAdd } = useSafeDb()

  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: accounts, loading, reload } = useLocalData({
    table: 'accounts' as any,
    filters: { context: effectiveContext },
  })

  // ============================================================
  // 🔥 HANDLE DELETE CORRIGIDO COM safeDelete
  // ============================================================
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
        reload().finally(() => {
          setTimeout(() => setRefreshing(false), 600)
        })
      }
    }
  }, [refreshing, reload])

  const filteredAccounts = (accounts || []).filter((acc: any) => {
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

  const totalBalance = filteredAccounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0)

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
      {(loading || pendingCount > 0) && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pb-3">
        {/* 🔥 LINHA 1: Título + Botões */}
        <div className="flex items-center justify-between pt-4 mb-2">
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-slate-100">Contas</h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {appMode === "personal_only" ? "Pessoais" : "Empresariais e Pessoais"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {showSearch ? <X size={18} /> : <Search size={18} />}
            </button>
            <button
              onClick={() => router.push("/accounts/new")}
              className="p-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white shadow-md shadow-teal-500/20 transition-all active:scale-95"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* 🔥 LINHA 2: SELETOR DE CONTEXTO + INDICADOR */}
        <div className="flex items-center justify-between mb-3">
          <ContextToggle />
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
            {effectiveContext === 'dfl' ? '🏢 PJ' : '👤 PF'}
          </span>
        </div>

        {/* Saldo Total */}
        <div className="bg-gradient-to-r from-teal-500 to-emerald-500 rounded-2xl p-4 mb-3 text-white shadow-lg shadow-teal-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/80">Saldo Total</p>
              <p className="text-2xl font-black">{formatCurrency(totalBalance)}</p>
            </div>
            <div className="bg-white/20 rounded-xl p-2">
              <Wallet size={24} />
            </div>
          </div>
          <p className="text-xs text-white/70 mt-1">{filteredAccounts.length} conta(s)</p>
        </div>

        {/* Search */}
        {showSearch && (
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar conta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
            />
          </div>
        )}
      </div>

      <div ref={scrollRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="flex-1 overflow-y-auto px-4 pt-3 pb-24">
        {loading ? (
          <Skeleton count={4} />
        ) : filteredAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Wallet size={48} className="text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-semibold">Nenhuma conta</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Toque no + para adicionar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAccounts.map((acc: any) => {
              const Icon = ACCOUNT_ICONS[acc.type] || Wallet
              const label = ACCOUNT_LABELS[acc.type] || acc.type
              return (
                <div key={acc.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <button onClick={() => router.push(`/accounts/${acc.id}`)} className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${(acc.balance || 0) >= 0 ? "bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400" : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"}`}>
                      <Icon size={22} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <h3 className="font-bold text-slate-800 dark:text-slate-200 truncate">{acc.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{label}{acc.bank ? ` — ${acc.bank}` : ""}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-black text-lg ${(acc.balance || 0) >= 0 ? "text-teal-600 dark:text-teal-400" : "text-red-500"}`}>{formatCurrency(acc.balance || 0)}</p>
                      <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 inline" />
                    </div>
                  </button>
                  <div className="px-4 pb-3 flex justify-end">
                    <button onClick={() => setDeleteModal(acc.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">Excluir Conta</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Tem certeza que deseja excluir esta conta? As transações vinculadas não serão afetadas.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AccountsPage() {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => setIsClient(true), [])
  if (!isClient) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" />
  return <AccountsContent />
}