"use client"

import { useState, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Search, Plus, X, RefreshCw, Trash2, User, Building2, Mail, Phone, ChevronRight, ChevronLeft
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"
import { useSafeDb } from '@/hooks/useSafeDb'

export default function ContactsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { user } = useAuth()
  const { appMode, context } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  const { safeDelete } = useSafeDb()

  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [typeFilter, setTypeFilter] = useState("all")
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  
  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: contacts, loading, reload } = useLocalData({
    table: 'contacts' as any,
    filters: { context: effectiveContext },
  })

  const { data: transactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext },
  })

  const transactionCountByContact = (transactions || []).reduce((acc: Record<string, number>, tx: any) => {
    if (tx.contact_id) acc[tx.contact_id] = (acc[tx.contact_id] || 0) + 1
    return acc
  }, {})

  const { groupedContacts, sortedLetters } = useMemo(() => {
    const filteredContacts = (contacts || []).filter((c: any) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false
      if (!search) return true
      const s = search.toLowerCase()
      return (
        (c.name && c.name.toLowerCase().includes(s)) ||
        (c.email && c.email.toLowerCase().includes(s)) ||
        (c.phone && c.phone.toLowerCase().includes(s)) ||
        (c.company && c.company.toLowerCase().includes(s))
      )
    })

    const grouped = filteredContacts.reduce((acc: Record<string, any[]>, c: any) => {
      const letter = (c.name || "?").charAt(0).toUpperCase()
      if (!acc[letter]) acc[letter] = []
      acc[letter].push(c)
      return acc
    }, {})

    const sorted = Object.keys(grouped).sort()
    return { groupedContacts: grouped, sortedLetters: sorted }
  }, [contacts, typeFilter, search])

  const handleDelete = async () => {
    if (!deleteModal || !user) return
    vibrate([10, 50])
    try {
      const result = await safeDelete('contacts', deleteModal)
      if (!result.success) throw new Error(result.error)
      
      success()
      showToast("✅ Contato excluído!", "success")
      setDeleteModal(null)
      reload()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, "error")
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

  const formatInitials = (name: string) => {
    if (!name) return "?"
    const parts = name.split(" ")
    if (parts.length >= 2) return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
    return name.substring(0, 2).toUpperCase()
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

      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl pt-6 pb-4 px-4 shadow-sm border-b border-gray-100 dark:border-slate-800/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => { vibrate([5]); router.push('/more'); }} className="p-1 -ml-1 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors active:scale-95">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-[26px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">Contatos</h1>
              <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Gestão de Pessoas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { vibrate([5]); setShowSearch(!showSearch); }} className="w-10 h-10 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 active:scale-95">
              {showSearch ? <X size={18} /> : <Search size={18} />}
            </button>
            <button onClick={() => { vibrate([10]); router.push("/contacts/new"); }} className="w-10 h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-teal-600/20 transition-all active:scale-95">
              <Plus size={20} />
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="mb-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700/50 rounded-[18px] px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
              <Search size={18} className="text-gray-400" />
              <input type="text" placeholder="Nome, email, telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-transparent text-[14px] outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 font-medium" autoFocus />
              {search && <button onClick={() => setSearch('')} className="p-1 text-gray-400 hover:text-gray-600"><X size={14}/></button>}
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 snap-x">
          <button onClick={() => { vibrate([5]); setTypeFilter("all"); }} className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all border snap-start shrink-0 ${typeFilter === "all" ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-md scale-105" : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-slate-700 hover:bg-gray-50"}`}>
            Todos
          </button>
          <button onClick={() => { vibrate([5]); setTypeFilter("individual"); }} className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all border snap-start shrink-0 flex items-center gap-1.5 ${typeFilter === "individual" ? "bg-teal-600 text-white border-transparent shadow-md scale-105" : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-slate-700 hover:bg-gray-50"}`}>
            <User size={14} /> Pessoas
          </button>
          <button onClick={() => { vibrate([5]); setTypeFilter("company"); }} className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all border snap-start shrink-0 flex items-center gap-1.5 ${typeFilter === "company" ? "bg-blue-600 text-white border-transparent shadow-md scale-105" : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-slate-700 hover:bg-gray-50"}`}>
            <Building2 size={14} /> Empresas
          </button>
        </div>
      </div>

      <div ref={scrollRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className="flex-1 overflow-y-auto px-4 pt-2 pb-24 custom-scrollbar">
        {loading ? (
          <div className="space-y-4 pt-4">
             <Skeleton count={5} height="90px" borderRadius="24px" />
          </div>
        ) : Object.keys(groupedContacts).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
               <User size={32} className="opacity-30 text-gray-500" />
            </div>
            <p className="text-[16px] font-bold text-gray-800 dark:text-gray-200 tracking-tight">{search ? "Nenhum contato encontrado" : "Nenhum contato"}</p>
            <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1 font-medium">{search ? "Tente outro termo" : "Toque no + para adicionar"}</p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            {sortedLetters.map((letter) => (
              <div key={letter}>
                <div className="sticky top-0 bg-gray-50/90 dark:bg-slate-900/90 backdrop-blur-md py-2 z-10">
                  <span className="text-[12px] font-black text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-3 py-1 rounded-[10px]">
                    {letter}
                  </span>
                </div>
                <div className="space-y-3 mt-2">
                  {groupedContacts[letter].map((c: any) => {
                    const txCount = (transactionCountByContact[c.id] || 0)
                    return (
                      <div key={c.id} className="bg-white dark:bg-slate-800 rounded-[28px] border border-gray-100 dark:border-slate-700/50 overflow-hidden shadow-sm hover:shadow-md transition-all">
                        <button onClick={() => { vibrate([5]); router.push(`/contacts/details?id=${c.id}`); }} className="w-full p-4 flex items-start gap-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]">
                          <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center flex-shrink-0 shadow-sm ${c.type === "company" ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"}`}>
                            {c.type === "company" ? <Building2 size={22} /> : <span className="text-[16px] font-black">{formatInitials(c.name)}</span>}
                          </div>
                          <div className="flex-1 min-w-0 text-left pt-0.5">
                            <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-100 truncate tracking-tight">{c.name}</h3>
                            <div className="flex flex-col gap-1 mt-1.5">
                              {c.email && <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><Mail size={12} className="opacity-70"/> <span className="truncate">{c.email}</span></span>}
                              {c.phone && <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><Phone size={12} className="opacity-70"/> {c.phone}</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0 mt-1">
                            {txCount > 0 && <span className="text-[10px] font-bold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">{txCount} txs</span>}
                            <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
                          </div>
                        </button>
                        <div className="px-4 pb-3 flex justify-end">
                          <button onClick={() => { vibrate([10]); setDeleteModal(c.id); }} className="p-2 bg-gray-50 dark:bg-slate-700/50 rounded-[14px] text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors active:scale-95" aria-label="Excluir">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setDeleteModal(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <h3 className="text-[20px] font-black text-gray-800 dark:text-gray-100 mb-2 text-center">Excluir Contato</h3>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-8 text-center px-4 font-medium">As transações vinculadas continuarão existindo sem contato associado.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} className="flex-1 py-4 rounded-[20px] bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold text-[15px] hover:bg-gray-200 transition-colors active:scale-95">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 py-4 rounded-[20px] bg-red-500 hover:bg-red-600 text-white font-bold text-[15px] shadow-lg shadow-red-500/20 transition-all active:scale-95">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
