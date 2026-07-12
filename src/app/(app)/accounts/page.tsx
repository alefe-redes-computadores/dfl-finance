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
  const { success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { user } = useAuth()
  const { context, appMode, effectiveContext } = useContext_()
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
        reload().finally(() => {
          setTimeout(() => setRefreshing(false), 600)
        })
      }
    }
  }, [refreshing, reload])

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
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* HEADER SOFT UI */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl pt-6 pb-2 px-4 shadow-[0_2px_15px_rgba(0,0,0,0.02)] border-b border-gray-100 dark:border-slate-800/50">
        
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">Contas</h1>
            <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
              {appMode === "personal_only" ? "Visão Pessoal" : "Visão Global"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className="w-10 h-10 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 active:scale-95"
            >
              {showSearch ? <X size={18} /> : <Search size={18} />}
            </button>
            <button
              type="button"
              onClick={() => router.push("/accounts/new")}
              className="w-10 h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-teal-600/20 transition-all active:scale-95"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <ContextToggle />
          <span className="text-[11px] font-bold px-3 py-1 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 rounded-full">
            {effectiveContext === 'dfl' ? '🏢 Empresa (PJ)' : '👤 Pessoal (PF)'}
          </span>
        </div>

        {/* Search Bar Animada */}
        {showSearch && (
          <div className="mb-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700/50 rounded-[18px] px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
              <Search size={18} className="text-gray-400" />
              <input
                type="text"
                placeholder="Buscar conta..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-[14px] outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 font-medium"
                autoFocus
              />
              {search && (
                 <button onClick={() => setSearch('')} className="p-1 text-gray-400 hover:text-gray-600"><X size={14}/></button>
              )}
            </div>
          </div>
        )}

      </div>

      <div ref={scrollRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="flex-1 overflow-y-auto px-4 pt-4 pb-28 custom-scrollbar">
        
        {/* CARD DE SALDO TOTAL (GLASSMORPHISM) */}
        {!loading && (
          <div className="relative overflow-hidden bg-gradient-to-br from-teal-500 to-emerald-600 rounded-[28px] p-6 mb-6 shadow-lg shadow-teal-500/20 group cursor-default">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full blur-xl -ml-8 -mb-8 pointer-events-none" />
            
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-[12px] font-bold text-white/80 uppercase tracking-widest mb-1">Saldo Consolidado</p>
                <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(totalBalance)}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-[18px] flex items-center justify-center border border-white/10 shadow-inner">
                <Wallet size={24} className="text-white" />
              </div>
            </div>
            <p className="relative z-10 text-[11px] text-teal-50 font-medium mt-4 bg-black/10 inline-block px-3 py-1 rounded-full backdrop-blur-sm">
              Compondo {accounts?.length || 0} {(accounts?.length || 0) === 1 ? 'conta' : 'contas'}
            </p>
          </div>
        )}

        {/* FILTROS RÁPIDOS */}
        {!loading && accounts?.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 snap-x mb-2">
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
                onClick={() => setAccountFilter(f.key)}
                className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all border snap-start shrink-0 ${accountFilter === f.key ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-md scale-105' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* LISTAGEM DE CONTAS */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton count={1} height="120px" borderRadius="28px" />
            <Skeleton count={3} height="80px" borderRadius="24px" />
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
               <Wallet size={32} className="opacity-30 text-gray-500" />
            </div>
            <p className="text-[16px] font-bold text-gray-800 dark:text-gray-200 tracking-tight">Nenhuma conta encontrada</p>
            <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1 font-medium text-center">Toque no + para adicionar uma nova conta.</p>
          </div>
        ) : (
          <div className="space-y-3 animate-in fade-in duration-500">
            {filteredAccounts.map((acc: any) => {
              const Icon = ACCOUNT_ICONS[acc.type] || Wallet
              const label = ACCOUNT_LABELS[acc.type] || acc.type
              const isPositive = (acc.balance || 0) >= 0

              return (
                <div key={acc.id} className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-100 dark:border-slate-700/50 overflow-hidden shadow-[0_2px_15px_rgba(0,0,0,0.02)] hover:shadow-md transition-shadow relative group">
                  
                  {/* Botão de Excluir Integrado de forma limpa */}
                  <button 
                    onClick={() => setDeleteModal(acc.id)} 
                    className="absolute top-3 right-3 p-2 rounded-full text-gray-300 dark:text-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors z-10"
                    title="Excluir conta"
                  >
                    <Trash2 size={16} />
                  </button>

                  <button 
                    onClick={() => router.push(`/accounts/details?id=${acc.id}`)} 
                    className="w-full p-5 flex items-center gap-4 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors active:bg-gray-100 dark:active:bg-slate-700"
                  >
                    <div className={`w-[48px] h-[48px] rounded-[18px] flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-105 ${isPositive ? "bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400" : "bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400"}`}>
                      <Icon size={22} strokeWidth={2.5} />
                    </div>
                    
                    <div className="flex-1 min-w-0 text-left pr-6">
                      <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-100 truncate tracking-tight mb-0.5">{acc.name}</h3>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500 truncate max-w-[120px]">{label}</span>
                        {acc.bank && (
                          <>
                            <span className="text-gray-300 dark:text-gray-600">•</span>
                            <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400 truncate">{acc.bank}</span>
                          </>
                        )}
                      </div>
                      <p className={`font-black text-[17px] mt-1 tracking-tight ${isPositive ? "text-teal-600 dark:text-teal-400" : "text-red-500 dark:text-red-400"}`}>
                        {formatCurrency(acc.balance || 0)}
                      </p>
                    </div>
                    
                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gray-50 dark:bg-slate-700 group-hover:bg-teal-50 dark:group-hover:bg-teal-900/30 transition-colors">
                      <ChevronRight size={16} className="text-gray-400 dark:text-gray-500 group-hover:text-teal-600 dark:group-hover:text-teal-400" />
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL DE EXCLUSÃO SOFT UI */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteModal(null)}>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-t-[32px] sm:rounded-[32px] w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Trash2 size={28} className="text-red-500" />
            </div>
            <h3 className="text-[20px] font-black text-gray-800 dark:text-gray-100 mb-2 text-center tracking-tight">Excluir Conta</h3>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-8 text-center font-medium px-4">
              Tem certeza que deseja excluir esta conta? As transações vinculadas não serão afetadas.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteModal(null)} className="flex-1 py-4 rounded-[20px] bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold text-[15px] hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors active:scale-95">
                Cancelar
              </button>
              <button type="button" onClick={handleDelete} className="flex-1 py-4 rounded-[20px] bg-red-500 hover:bg-red-600 text-white font-bold text-[15px] shadow-lg shadow-red-500/20 transition-all active:scale-95">
                Sim, Excluir
              </button>
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
  if (!isClient) return <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900" />
  return <AccountsContent />
}
