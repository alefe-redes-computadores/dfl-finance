"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUpDown, Search, Plus, X, ChevronDown, RefreshCw, Trash2, CheckCircle2, AlertTriangle, Clock, Car, Home, Percent,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"
import { useSafeDb } from '@/hooks/useSafeDb'
import ContextToggle from '@/components/ContextToggle'

type Installment = { id: string, financing_id: string, amount: number, due_date: string, paid: boolean, number: number }

export default function FinancingsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { user } = useAuth()
  
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  
  const { safeDelete } = useSafeDb()

  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [sortBy, setSortBy] = useState("updated_at")
  const [sortOrder, setSortOrder] = useState("desc")
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: financings, loading, reload } = useLocalData({ 
    table: 'financings' as any, 
    filters: { context: effectiveContext } 
  })
  
  const { data: allInstallments } = useLocalData({ 
    table: 'transactions' as any, 
    filters: { context: effectiveContext, type: 'financing_installment' } 
  })

  const installmentsByFinancing = (allInstallments || []).reduce((acc: Record<string, Installment[]>, inst: any) => {
    if (inst.financing_id) {
      if (!acc[inst.financing_id]) acc[inst.financing_id] = []
      acc[inst.financing_id].push(inst)
    }
    return acc
  }, {})

  const handleDelete = async () => {
    if (!deleteModal || !user) return
    vibrate([10, 50])
    try {
      const installments = installmentsByFinancing[deleteModal] || []
      
      for (const inst of installments) {
        const res1 = await safeDelete('transactions', inst.id)
        if (!res1.success) throw new Error(res1.error)
      }
      
      const res2 = await safeDelete('financings', deleteModal)
      if (!res2.success) throw new Error(res2.error)

      success()
      showToast("✅ Financiamento excluído com sucesso!", "success")
      setDeleteModal(null)
      reload()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro ao excluir financiamento: ${err.message}`, "error")
    }
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY }, [])
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        vibrate([10])
        reload().finally(() => setTimeout(() => setRefreshing(false), 600))
      }
    }
  }, [refreshing, reload, vibrate])

  const filteredFinancings = (financings || []).filter((fin: any) => {
    if (!search) return true
    const s = search.toLowerCase()
    return ((fin.description && fin.description.toLowerCase().includes(s)) || (fin.bank && fin.bank.toLowerCase().includes(s)) || (fin.asset && fin.asset.toLowerCase().includes(s)))
  })

  const sortedFinancings = [...filteredFinancings].sort((a: any, b: any) => {
    let valA = a[sortBy] || ""; let valB = b[sortBy] || ""
    if (sortBy === "total_amount" || sortBy === "remaining_amount") return sortOrder === "desc" ? Number(b[sortBy]) - Number(a[sortBy]) : Number(a[sortBy]) - Number(b[sortBy])
    return sortOrder === "desc" ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB))
  })

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)
  const formatDate = (date: string | null) => {
    if (!date) return ""
    return new Date(date + 'T12:00:00').toLocaleDateString("pt-BR", { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-full"><Clock size={12} /> Ativo</span>
      case "paid": return <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2.5 py-1 rounded-full"><CheckCircle2 size={12} /> Quitado</span>
      case "overdue": return <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-full"><AlertTriangle size={12} /> Atrasado</span>
      default: return <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">{status}</span>
    }
  }

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "vehicle": return <Car size={20} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
      case "property": return <Home size={20} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
      default: return <Percent size={20} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      {(loadingPulse || loading || pendingCount > 0) && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.1)] rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl pt-6 pb-2 px-4 shadow-sm border-b border-gray-100 dark:border-slate-800/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">Financiamentos</h1>
            <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
              {appMode === "personal_only" ? "Visão Pessoal" : "Visão Global"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { vibrate([5]); setShowSearch(!showSearch); }} className="w-10 h-10 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 active:scale-95">
              {showSearch ? <X size={18} /> : <Search size={18} />}
            </button>
            <button onClick={() => { vibrate([10]); router.push("/financings/new"); }} className="w-10 h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-teal-600/20 transition-all active:scale-95">
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <ContextToggle />
          <button 
            onClick={() => { vibrate([5]); setSortOrder(sortOrder === "desc" ? "asc" : "desc"); }} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 rounded-full font-bold text-[11px] active:scale-95 transition-transform"
          >
            <ArrowUpDown size={12} />
            {sortOrder === 'desc' ? 'Decrescente' : 'Crescente'}
          </button>
        </div>

        {showSearch && (
          <div className="mb-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700/50 rounded-[18px] px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
              <Search size={18} className="text-gray-400" />
              <input type="text" placeholder="Buscar financiamento..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-transparent text-[14px] outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 font-medium" autoFocus />
              {search && <button onClick={() => setSearch('')} className="p-1 text-gray-400 hover:text-gray-600"><X size={14}/></button>}
            </div>
          </div>
        )}

        {!loading && sortedFinancings.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 snap-x mb-2">
            {[
              { key: 'updated_at', label: 'Mais Recentes' },
              { key: 'total_amount', label: 'Valor Total' },
              { key: 'start_date', label: 'Data Início' },
            ].map(f => (
              <button 
                type="button" 
                key={f.key} 
                onClick={() => { vibrate([5]); setSortBy(f.key); }}
                className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all border snap-start shrink-0 ${sortBy === f.key ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-md scale-105' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={scrollRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="flex-1 overflow-y-auto px-4 pt-4 pb-24 custom-scrollbar">
        {loading ? (
          <div className="space-y-4">
            <Skeleton count={3} height="140px" borderRadius="28px" />
          </div>
        ) : sortedFinancings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
               <Percent size={32} className="opacity-30 text-gray-500" />
            </div>
            <p className="text-[16px] font-bold text-gray-800 dark:text-gray-200 tracking-tight">Nenhum financiamento</p>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-500">
            {sortedFinancings.map((fin: any) => {
              const installments = installmentsByFinancing[fin.id] || []
              const paidInstallments = installments.filter((i: Installment) => i.paid)
              const totalPaid = paidInstallments.reduce((sum: number, i: Installment) => sum + (i.amount || 0), 0)
              const remaining = (fin.total_amount || 0) - totalPaid
              const isExpanded = expandedId === fin.id

              return (
                <div key={fin.id} className="bg-white dark:bg-slate-800 rounded-[28px] border border-gray-100 dark:border-slate-700/50 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                  <button onClick={() => { vibrate([5]); router.push(`/financings/details?id=${fin.id}`); }} className="w-full p-5 text-left hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-[14px] bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                            {getAssetIcon(fin.asset_type)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-100 truncate tracking-tight">{fin.description || "Financiamento"}</h3>
                            {fin.asset && <p className="text-[12px] font-medium text-gray-400 dark:text-gray-500 truncate mt-0.5">{fin.asset}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          {getStatusBadge(fin.status)}
                          <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500">{formatDate(fin.start_date)}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-black text-[18px] text-gray-800 dark:text-gray-100">{formatCurrency(fin.total_amount || 0)}</p>
                        {fin.status === "active" && <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 mt-1">Falta: {formatCurrency(Math.max(0, remaining))}</p>}
                      </div>
                    </div>
                    
                    {installments.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-700/50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Parcelas ({paidInstallments.length}/{installments.length})</span>
                          <span className="text-[13px] font-black text-teal-600 dark:text-teal-400">{formatCurrency(totalPaid)}</span>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                          {installments.slice(0, isExpanded ? undefined : 3).map((inst: Installment) => (
                            <div key={inst.id} className={`flex items-center justify-between text-[12px] rounded-[12px] px-3 py-2 transition-colors ${inst.paid ? 'bg-teal-50 dark:bg-teal-900/10' : 'bg-gray-50 dark:bg-slate-700/40'}`}>
                              <div className="flex items-center gap-2.5">
                                <span className={`w-2 h-2 rounded-full ${inst.paid ? "bg-teal-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                                <span className={inst.paid ? 'text-teal-700 dark:text-teal-400 font-bold' : 'text-gray-600 dark:text-gray-400 font-medium'}>
                                  #{inst.number} — {formatDate(inst.due_date)}
                                </span>
                              </div>
                              <span className={`font-black ${inst.paid ? "text-teal-600 dark:text-teal-400" : "text-gray-500"}`}>{formatCurrency(inst.amount)}</span>
                            </div>
                          ))}
                        </div>
                        {installments.length > 3 && (
                          <button onClick={(e) => { e.stopPropagation(); vibrate([5]); setExpandedId(isExpanded ? null : fin.id); }} className="w-full text-center text-[11px] uppercase tracking-widest font-bold text-teal-600 dark:text-teal-400 mt-2 py-2 bg-teal-50 dark:bg-teal-900/10 rounded-full active:scale-95 transition-transform">
                            {isExpanded ? "Recolher parcelas" : `Ver todas (${installments.length})`}
                          </button>
                        )}
                      </div>
                    )}
                  </button>
                  <div className="px-5 pb-5 pt-0 flex gap-2">
                    <button onClick={() => { vibrate([5]); router.push(`/financings/details?id=${fin.id}`); }} className="flex-1 py-3 rounded-[16px] bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:text-teal-600 dark:hover:text-teal-400 font-bold text-[13px] transition-colors active:scale-95">
                      Ver Detalhes
                    </button>
                    <button onClick={() => { vibrate([10]); setDeleteModal(fin.id); }} className="w-12 flex items-center justify-center bg-gray-50 dark:bg-slate-700 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-[16px] transition-colors active:scale-95" aria-label="Excluir">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteModal(null)}>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-t-[32px] sm:rounded-[32px] w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Trash2 size={28} className="text-red-500" />
            </div>
            <h3 className="text-[20px] font-black text-gray-800 dark:text-gray-100 mb-2 text-center tracking-tight">Excluir Financiamento</h3>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-8 text-center font-medium px-4">
              Tem certeza que deseja excluir este financiamento e todas as suas parcelas?
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteModal(null)} className="flex-1 py-4 rounded-[20px] bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold text-[15px] hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors active:scale-95">
                Cancelar
              </button>
              <button type="button" onClick={() => { vibrate([50]); handleDelete(); }} className="flex-1 py-4 rounded-[20px] bg-red-500 hover:bg-red-600 text-white font-bold text-[15px] shadow-lg shadow-red-500/20 transition-all active:scale-95">
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
