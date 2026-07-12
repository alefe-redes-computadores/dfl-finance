"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUpDown, Search, Plus, X, RefreshCw, Trash2, CheckCircle2, AlertTriangle, Clock, Repeat, Calendar, ChevronLeft
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import ContextToggle from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"
import { db, addToSyncQueue } from '@/lib/db'

export default function SubscriptionsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { user } = useAuth()
  
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [sortBy, setSortBy] = useState("updated_at")
  const [sortOrder, setSortOrder] = useState("desc")
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  
  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: subscriptions, loading, reload } = useLocalData({
    table: 'subscriptions' as any,
    filters: { context: effectiveContext },
  })

  // EXCLUSÃO ATÔMICA DA LISTA COM addToSyncQueue E ARRAY
  const handleDelete = async () => {
    if (!deleteModal || !user) return
    try {
      await db.transaction('rw', ['subscriptions', 'syncQueue'], async () => {
        await db.table('subscriptions').delete(deleteModal)
        await addToSyncQueue(user.id, 'subscriptions', 'delete', deleteModal, null)
      })
      
      showToast("Assinatura excluída com sucesso!", "success")
      success()
      setDeleteModal(null)
      reload()
    } catch (err: any) {
      showToast(`Erro ao excluir assinatura: ${err.message}`, "error")
      errorHaptic()
    }
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY }, [])
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        reload().finally(() => setTimeout(() => setRefreshing(false), 600))
      }
    }
  }, [refreshing, reload])

  const filteredSubscriptions = (subscriptions || []).filter((sub: any) => {
    if (!search) return true
    const s = search.toLowerCase()
    return ((sub.name && sub.name.toLowerCase().includes(s)) || (sub.category && sub.category.toLowerCase().includes(s)) || (sub.notes && sub.notes.toLowerCase().includes(s)))
  })

  const sortedSubscriptions = [...filteredSubscriptions].sort((a: any, b: any) => {
    let valA = a[sortBy] || ""; let valB = b[sortBy] || ""
    if (sortBy === "amount" || sortBy === "monthly_total") return sortOrder === "desc" ? Number(b[sortBy]) - Number(a[sortBy]) : Number(a[sortBy]) - Number(b[sortBy])
    return sortOrder === "desc" ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB))
  })

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)
  
  const formatDate = (date: string | null) => {
    if (!date) return ""
    const d = new Date(date + 'T12:00:00') // Evita problemas de fuso horário
    return d.toLocaleDateString("pt-BR", { day: '2-digit', month: 'short' })
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "active": return { label: 'Ativa', icon: Clock, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/30' }
      case "cancelled": return { label: 'Cancelada', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' }
      case "paused": return { label: 'Pausada', icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' }
      default: return { label: status, icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-slate-800' }
    }
  }

  const getBillingCycleLabel = (cycle: string) => {
    switch (cycle) {
      case "monthly": return "mensal"
      case "yearly": return "anual"
      case "weekly": return "semanal"
      case "quarterly": return "trimestral"
      case "semiannually": return "semestral"
      default: return cycle
    }
  }

  const monthlyTotal = (subscriptions || []).reduce((sum: number, sub: any) => {
    if (sub.status !== "active") return sum
    let monthlyAmount = sub.amount || 0
    switch (sub.billing_cycle) {
      case "yearly": monthlyAmount = monthlyAmount / 12; break
      case "weekly": monthlyAmount = monthlyAmount * 4.33; break
      case "quarterly": monthlyAmount = monthlyAmount / 3; break
      case "semiannually": monthlyAmount = monthlyAmount / 6; break
    }
    return sum + monthlyAmount
  }, 0)

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f8f9fa] dark:bg-slate-900 font-sans transition-colors duration-300">
      
      {/* Ponto de Luz de Sincronização */}
      {(loadingPulse || loading || pendingCount > 0) && (
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
            <div className="flex items-center gap-2">
              <button onClick={() => router.push('/more')} className="p-1 -ml-1 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                <ChevronLeft size={24} />
              </button>
              <h1 className="text-[26px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">Assinaturas</h1>
            </div>
            <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5 ml-1">
              {appMode === "personal_only" ? "Visão Pessoal" : "Visão Global"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="w-10 h-10 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 active:scale-95"
            >
              {showSearch ? <X size={18} /> : <Search size={18} />}
            </button>
            <button
              onClick={() => router.push("/subscriptions/new")}
              className="w-10 h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-teal-600/20 transition-all active:scale-95"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <ContextToggle />
          <button 
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 rounded-full font-bold text-[11px] active:scale-95 transition-transform"
          >
            <ArrowUpDown size={12} />
            {sortOrder === 'desc' ? 'Decrescente' : 'Crescente'}
          </button>
        </div>

        {/* Search Bar Animada */}
        {showSearch && (
          <div className="mb-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700/50 rounded-[18px] px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
              <Search size={18} className="text-gray-400" />
              <input
                type="text"
                placeholder="Buscar assinatura..."
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
        
        {/* CARD DE TOTAL MENSAL (GLASSMORPHISM) */}
        {!loading && (
          <div className="relative overflow-hidden bg-gradient-to-br from-teal-500 to-emerald-600 rounded-[28px] p-6 mb-6 shadow-lg shadow-teal-500/20 group cursor-default">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full blur-xl -ml-8 -mb-8 pointer-events-none" />
            
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-[12px] font-bold text-white/80 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <Calendar size={14} /> Comprometimento Mensal
                </p>
                <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(monthlyTotal)}</p>
              </div>
            </div>
            <p className="relative z-10 text-[11px] text-teal-50 font-medium mt-4 bg-black/10 inline-block px-3 py-1 rounded-full backdrop-blur-sm">
              {subscriptions?.filter((s: any) => s.status === "active").length || 0} assinaturas ativas
            </p>
          </div>
        )}

        {/* PÍLULAS DE ORDENAÇÃO */}
        {!loading && sortedSubscriptions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 snap-x mb-2">
            {[
              { key: 'updated_at', label: 'Mais Recentes' },
              { key: 'amount', label: 'Maior Valor' },
              { key: 'name', label: 'Por Nome' },
            ].map(f => (
              <button 
                type="button" 
                key={f.key} 
                onClick={() => setSortBy(f.key)}
                className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all border snap-start shrink-0 ${sortBy === f.key ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-md scale-105' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* LISTAGEM DE ASSINATURAS */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton count={1} height="120px" borderRadius="28px" />
            <Skeleton count={3} height="100px" borderRadius="28px" />
          </div>
        ) : sortedSubscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
               <Repeat size={32} className="opacity-30 text-gray-500" />
            </div>
            <p className="text-[16px] font-bold text-gray-800 dark:text-gray-200 tracking-tight">
              {search ? "Nenhuma assinatura encontrada" : "Nenhuma assinatura ativa"}
            </p>
            <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1 font-medium text-center">
              {search ? "Tente buscar com outro termo." : "Gerencie seus serviços de streaming, planos e contratos mensais aqui."}
            </p>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-500">
            {sortedSubscriptions.map((sub: any) => {
              const status = getStatusInfo(sub.status)
              
              return (
                <div key={sub.id} className="bg-white dark:bg-slate-800 rounded-[28px] border border-gray-100 dark:border-slate-700/50 overflow-hidden shadow-[0_2px_15px_rgba(0,0,0,0.02)] hover:shadow-md transition-all relative group">
                  
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      
                      {/* Ícone e Título */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-[46px] h-[46px] rounded-[16px] flex items-center justify-center shrink-0 ${status.bg}`}>
                          <Repeat size={20} className={status.color} />
                        </div>
                        <div className="min-w-0 pr-2">
                          <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-100 truncate tracking-tight mb-0.5">{sub.name || "Assinatura"}</h3>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                              POR {getBillingCycleLabel(sub.billing_cycle)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Valor */}
                      <div className="text-right shrink-0">
                        <p className={`font-black text-[18px] tracking-tight ${sub.status === 'active' ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                          {formatCurrency(sub.amount || 0)}
                        </p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <status.icon size={10} className={status.color} />
                          <span className={`text-[10px] font-bold uppercase ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-5">
                      <div className="flex items-center gap-2">
                        {sub.next_due_date && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-700">
                            <Calendar size={12} className="text-gray-400" />
                            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                              Vence {formatDate(sub.next_due_date)}
                            </span>
                          </div>
                        )}
                        {sub.category && (
                          <span className="px-2.5 py-1.5 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-700 text-[11px] font-bold text-gray-600 dark:text-gray-300 truncate max-w-[100px]">
                            {sub.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* AÇÕES */}
                  <div className="px-5 pb-5 pt-0 flex gap-2">
                    <button 
                      onClick={() => router.push(`/subscriptions/new?edit=${sub.id}`)} 
                      className="flex-1 py-3 bg-gray-50 dark:bg-slate-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-gray-700 dark:text-gray-200 hover:text-teal-600 dark:hover:text-teal-400 rounded-[16px] font-bold text-[13px] transition-colors active:scale-95"
                    >
                      Editar Assinatura
                    </button>
                    <button 
                      onClick={() => setDeleteModal(sub.id)} 
                      className="w-12 flex items-center justify-center bg-gray-50 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 rounded-[16px] transition-colors active:scale-95"
                      aria-label="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

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
            <h3 className="text-[20px] font-black text-gray-800 dark:text-gray-100 mb-2 text-center tracking-tight">Excluir Assinatura</h3>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-8 text-center font-medium px-4">
              Tem certeza que deseja remover esta assinatura do seu planejamento?
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
