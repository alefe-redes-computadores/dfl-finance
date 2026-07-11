"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Plus,
  X,
  RefreshCw,
  Trash2,
  User,
  Building2,
  Mail,
  Phone,
  ChevronRight,
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
  const { success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { user } = useAuth()
  const { appMode, effectiveContext } = useContext_()
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
    if (tx.contact_id) {
      acc[tx.contact_id] = (acc[tx.contact_id] || 0) + 1
    }
    return acc
  }, {})

  // 🔥 CORRIGIDO: Remoção do db.transaction redundante
  const handleDelete = async () => {
    if (!deleteModal || !user) return
    try {
      const result = await safeDelete('contacts', deleteModal)
      if (!result.success) throw new Error(result.error)
      
      showToast("Contato excluído com sucesso!", "success")
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

  const filteredContacts = (contacts || []).filter((c: any) => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (c.name && c.name.toLowerCase().includes(s)) ||
      (c.email && c.email.toLowerCase().includes(s)) ||
      (c.phone && c.phone.toLowerCase().includes(s)) ||
      (c.company && c.company.toLowerCase().includes(s)) ||
      (c.notes && c.notes.toLowerCase().includes(s))
    )
  })

  const groupedContacts = filteredContacts.reduce((acc: Record<string, any[]>, c: any) => {
    const letter = (c.name || "?").charAt(0).toUpperCase()
    if (!acc[letter]) acc[letter] = []
    acc[letter].push(c)
    return acc
  }, {})

  const sortedLetters = Object.keys(groupedContacts).sort()

  const formatInitials = (name: string) => {
    if (!name) return "?"
    const parts = name.split(" ")
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
      {(loadingPulse || loading || pendingCount > 0) && (
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
        <div className="flex items-center justify-between pt-4 mb-3">
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-slate-100">
              Contatos
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Fornecedores, clientes e parceiros
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Buscar"
            >
              {showSearch ? <X size={18} /> : <Search size={18} />}
            </button>
            <button
              onClick={() => router.push("/contacts/new")}
              className="p-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white shadow-md shadow-teal-500/20 transition-all active:scale-95"
              aria-label="Novo contato"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="relative mb-2">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Buscar por nome, email, telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
            />
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setTypeFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              typeFilter === "all"
                ? "bg-teal-500 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setTypeFilter("individual")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              typeFilter === "individual"
                ? "bg-teal-500 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            <User size={12} className="inline mr-1" />
            Pessoas
          </button>
          <button
            onClick={() => setTypeFilter("company")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              typeFilter === "company"
                ? "bg-teal-500 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            <Building2 size={12} className="inline mr-1" />
            Empresas
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className="flex-1 overflow-y-auto px-4 pt-3 pb-24"
      >
        {loading ? (
          <Skeleton count={8} />
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <User size={48} className="text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-semibold">
              {search ? "Nenhum contato encontrado" : "Nenhum contato"}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              {search ? "Tente outro termo de busca" : "Toque no + para adicionar"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedLetters.map((letter) => (
              <div key={letter}>
                <div className="sticky top-0 bg-slate-50 dark:bg-slate-950 py-1 z-10">
                  <span className="text-xs font-black text-teal-500 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full">
                    {letter}
                  </span>
                </div>
                <div className="space-y-1 mt-2">
                  {groupedContacts[letter].map((c: any) => {
                    const txCount = transactionCountByContact[c.id] || 0
                    return (
                      <div
                        key={c.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                      >
                        <button
                          onClick={() => router.push(`/contacts/details?id=${c.id}`)}
                          className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            c.type === "company"
                              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                              : "bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
                          }`}>
                            {c.type === "company" ? (
                              <Building2 size={18} />
                            ) : (
                              <span className="text-sm font-black">{formatInitials(c.name)}</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0 text-left">
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 truncate">
                              {c.name}
                            </h3>
                            <div className="flex items-center gap-3 mt-0.5">
                              {c.email && (
                                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <Mail size={10} />
                                  <span className="truncate max-w-[120px]">{c.email}</span>
                                </span>
                              )}
                              {c.phone && (
                                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <Phone size={10} />
                                  {c.phone}
                                </span>
                              )}
                            </div>
                            {c.company && c.type !== "company" && (
                              <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 block">
                                {c.company}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {txCount > 0 && (
                              <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                                {txCount}
                              </span>
                            )}
                            <ChevronRight size={18} className="text-slate-300 dark:text-slate-600" />
                          </div>
                        </button>

                        <div className="px-3 pb-2 flex justify-end">
                          <button
                            onClick={() => setDeleteModal(c.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                            aria-label="Excluir contato"
                          >
                            <Trash2 size={14} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">
              Excluir Contato
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Tem certeza que deseja excluir este contato? As transações vinculadas não serão afetadas.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}