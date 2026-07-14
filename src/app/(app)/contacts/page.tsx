'use client'

import { useState, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createPortal } from "react-dom" // ✅ ADICIONADO
import {
  Search, Plus, X, RefreshCw, Trash2, User, Building2, Mail, Phone, ChevronRight, ChevronLeft
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
    <div className="flex flex-col h-[100dvh] bg-[#f8f9fa] dark:bg-slate-900 transition-colors duration-300">
      
      {/* Ponto de Luz */}
      {(loadingPulse || loading || pendingCount > 0) && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-sm rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200/70 dark:border-slate-700">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-semibold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* HEADER UNIFICADO */}
      <div className="sticky top-0 z-30 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => { vibrate([5]); router.push('/more'); }}
                className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98] shrink-0"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="text-[24px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                  Contatos
                </h1>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Gestão de pessoas e empresas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { vibrate([5]); setShowSearch(!showSearch); }}
                className="h-11 w-11 rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/40 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
              >
                {showSearch ? <X size={18} /> : <Search size={18} />}
              </button>

              <button
                onClick={() => { vibrate([10]); router.push("/contacts/new"); }}
                className="h-11 w-11 rounded-[18px] bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98]"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {showSearch && (
            <div className="mb-3 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
                <Search size={18} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Nome, email, telefone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-[14px] outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400"
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

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => { vibrate([5]); setTypeFilter("all"); }}
              className={`h-10 px-3.5 rounded-[18px] border whitespace-nowrap shrink-0 text-[13px] font-semibold transition-colors active:scale-[0.98] ${
                typeFilter === "all"
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-sm"
                  : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200/70 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700"
              }`}
            >
              Todos
            </button>

            <button
              onClick={() => { vibrate([5]); setTypeFilter("individual"); }}
              className={`h-10 px-3.5 rounded-[18px] border whitespace-nowrap shrink-0 flex items-center gap-1.5 text-[13px] font-semibold transition-colors active:scale-[0.98] ${
                typeFilter === "individual"
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-sm"
                  : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200/70 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700"
              }`}
            >
              <User size={13} />
              Pessoas
            </button>

            <button
              onClick={() => { vibrate([5]); setTypeFilter("company"); }}
              className={`h-10 px-3.5 rounded-[18px] border whitespace-nowrap shrink-0 flex items-center gap-1.5 text-[13px] font-semibold transition-colors active:scale-[0.98] ${
                typeFilter === "company"
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-sm"
                  : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200/70 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700"
              }`}
            >
              <Building2 size={13} />
              Empresas
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className="flex-1 overflow-y-auto px-4 pt-3 pb-24 custom-scrollbar"
      >
        {loading ? (
          <div className="space-y-3">
            <Skeleton count={5} height="80px" borderRadius="24px" />
          </div>
        ) : Object.keys(groupedContacts).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full border border-gray-200/70 dark:border-slate-700 shadow-sm flex items-center justify-center mb-4">
              <User size={28} className="opacity-30 text-gray-500" />
            </div>
            <p className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">
              {search ? "Nenhum contato encontrado" : "Nenhum contato"}
            </p>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1">
              {search ? "Tente outro termo" : "Toque no + para adicionar"}
            </p>
          </div>
        ) : (
          <div className="space-y-5 animate-in fade-in duration-500">
            {sortedLetters.map((letter) => (
              <div key={letter}>
                <div className="mb-2">
                  <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-slate-800 px-3 py-1 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                    {letter}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {groupedContacts[letter].map((c: any) => {
                    const txCount = (transactionCountByContact[c.id] || 0)

                    return (
                      <div
                        key={c.id}
                        className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2"
                      >
                        <div className="rounded-[18px] p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => { vibrate([5]); router.push(`/contacts/details?id=${c.id}`); }}
                              className="flex items-start gap-3 flex-1 min-w-0 text-left"
                            >
                              <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0 shadow-sm ${
                                c.type === "company"
                                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                                  : "bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400"
                              }`}>
                                {c.type === "company" ? (
                                  <Building2 size={18} />
                                ) : (
                                  <span className="text-[13px] font-bold">
                                    {formatInitials(c.name)}
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                                  {c.name}
                                </p>

                                <div className="mt-1 space-y-1">
                                  {c.email && (
                                    <span className="text-[12px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                                      <Mail size={12} className="opacity-70 shrink-0" />
                                      <span className="truncate">{c.email}</span>
                                    </span>
                                  )}

                                  {c.phone && (
                                    <span className="text-[12px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                                      <Phone size={12} className="opacity-70 shrink-0" />
                                      <span>{c.phone}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>

                            <div className="flex flex-col items-end gap-2 shrink-0">
                              {txCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400">
                                  {txCount} txs
                                </span>
                              )}

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => { vibrate([10]); setDeleteModal(c.id); }}
                                  className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors active:scale-[0.98]"
                                  aria-label="Excluir"
                                >
                                  <Trash2 size={15} />
                                </button>

                                <button
                                  onClick={() => { vibrate([5]); router.push(`/contacts/details?id=${c.id}`); }}
                                  className="h-8 w-8 rounded-full bg-gray-50 dark:bg-slate-700 flex items-center justify-center text-gray-400 dark:text-gray-500"
                                >
                                  <ChevronRight size={15} />
                                </button>
                              </div>
                            </div>
                          </div>
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

      {/* ✅ MODAL DE EXCLUSÃO COM PORTAL */}
      {deleteModal && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setDeleteModal(null)}
        >
          <div
            className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <h3 className="text-[20px] font-black text-gray-800 dark:text-gray-100 mb-2 text-center">
              Excluir Contato
            </h3>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-8 text-center px-4 font-medium">
              As transações vinculadas continuarão existindo sem contato associado.
            </p>
            <div className="flex gap-3 pb-safe">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 py-4 rounded-[20px] bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold text-[15px] active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-4 rounded-[20px] bg-red-500 text-white font-bold text-[15px] shadow-lg shadow-red-500/20 active:scale-[0.98]"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}