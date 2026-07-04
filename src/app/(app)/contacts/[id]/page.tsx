"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import {
  ArrowLeft,
  Trash2,
  RefreshCw,
  Pencil,
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Calendar,
  ChevronDown,
  Hash,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { LoadingSkeleton } from "@/components/Skeleton"
import { useAuth } from "@/lib/hooks/useAuth"


export default function ContactDetailPage() {
  const router = useRouter()
  const params = useParams()
  const contactId = params.id as string
  const { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { context } = useAuth()

  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedTransactions, setExpandedTransactions] = useState(false)
  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Busca dados locais
  const { data: localContacts, loading, refresh } = useLocalData({
    table: 'contacts' as any,
    filters: { context },
  })

  const contactData = (localContacts || []).find((c: any) => c.id === contactId) as any

  // Busca transações vinculadas
  const { data: allTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context, contact_id: contactId },
  })

  const transactions = allTransactions || []

  const { remove } = useLocalData({
    table: 'contacts' as any,
  })

  // Pull-to-refresh
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        refresh().finally(() => {
          setTimeout(() => setRefreshing(false), 600)
        })
      }
    }
  }, [refreshing, refresh])

  // Excluir contato
  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir este contato? As transações vinculadas não serão afetadas.")) return
    try {
      await remove(contactId)
      showToast("Contato excluído com sucesso!", "success")
      success()
      router.back()
    } catch {
      showToast("Erro ao excluir contato", "error")
      errorHaptic()
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)

  const formatDate = (date: string | null) => {
    if (!date) return ""
    return new Date(date).toLocaleDateString("pt-BR")
  }

  const formatInitials = (name: string) => {
    if (!name) return "?"
    const parts = name.split(" ")
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  // Total de transações
  const totalAmount = transactions.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)

  if (loading) {
    return (
      <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
              <ArrowLeft size={20} />
            </div>
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">Carregando...</h1>
          </div>
        </div>
        <div className="flex-1 px-4 pt-4">
          <LoadingSkeleton count={3} />
        </div>
      </div>
    )
  }

  if (!contactData) {
    return (
      <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">Contato não encontrado</h1>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
      {/* Bolinha de loading */}
      {(loadingPulse || loading || pendingCount > 0) && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {/* Pull-to-refresh */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 truncate max-w-[180px]">
              {contactData.name}
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/contacts/new?edit=${contactId}`)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Editar"
            >
              <Pencil size={18} />
            </button>
            <button
              onClick={handleDelete}
              className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
              aria-label="Excluir"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4"
      >
        {/* Card de perfil */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              contactData.type === "company"
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
            }`}>
              {contactData.type === "company" ? (
                <Building2 size={28} />
              ) : (
                <span className="text-xl font-black">{formatInitials(contactData.name)}</span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-200">
                {contactData.name}
              </h2>
              <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
                contactData.type === "company"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
              }`}>
                {contactData.type === "company" ? "Empresa" : "Pessoa Física"}
              </span>
            </div>
          </div>

          {/* Informações de contato */}
          <div className="space-y-2.5">
            {contactData.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail size={16} className="text-slate-400 flex-shrink-0" />
                <span className="text-slate-600 dark:text-slate-400">{contactData.email}</span>
              </div>
            )}
            {contactData.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone size={16} className="text-slate-400 flex-shrink-0" />
                <span className="text-slate-600 dark:text-slate-400">{contactData.phone}</span>
              </div>
            )}
            {contactData.document && (
              <div className="flex items-center gap-3 text-sm">
                <FileText size={16} className="text-slate-400 flex-shrink-0" />
                <span className="text-slate-600 dark:text-slate-400">{contactData.document}</span>
              </div>
            )}
            {contactData.address && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin size={16} className="text-slate-400 flex-shrink-0" />
                <span className="text-slate-600 dark:text-slate-400">
                  {contactData.address}
                  {contactData.city ? `, ${contactData.city}` : ""}
                  {contactData.state ? `/${contactData.state}` : ""}
                  {contactData.zip_code ? ` — ${contactData.zip_code}` : ""}
                </span>
              </div>
            )}
          </div>

          {/* Campos extras para PF */}
          {contactData.type === "individual" && (contactData.company || contactData.position) && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              {contactData.company && (
                <div className="flex items-center gap-3 text-sm">
                  <Building2 size={16} className="text-slate-400 flex-shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400">{contactData.company}</span>
                </div>
              )}
              {contactData.position && (
                <div className="flex items-center gap-3 text-sm">
                  <Hash size={16} className="text-slate-400 flex-shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400">{contactData.position}</span>
                </div>
              )}
            </div>
          )}

          {contactData.notes && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Observações</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{contactData.notes}</p>
            </div>
          )}
        </div>

        {/* Resumo financeiro */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <h3 className="font-black text-slate-800 dark:text-slate-200 mb-3">Resumo Financeiro</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Transações</p>
              <p className="text-xl font-black text-slate-800 dark:text-slate-200">{transactions.length}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Total</p>
              <p className={`text-xl font-black ${totalAmount >= 0 ? "text-teal-500" : "text-red-500"}`}>
                {formatCurrency(totalAmount)}
              </p>
            </div>
          </div>
        </div>

        {/* Transações vinculadas */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-200">Transações</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {transactions.length} transação(s) vinculada(s)
              </p>
            </div>
          </div>

          {transactions.length === 0 ? (
            <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-4">
              Nenhuma transação vinculada a este contato
            </p>
          ) : (
            <div className="space-y-2">
              {transactions
                .sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
                .slice(0, expandedTransactions ? undefined : 5)
                .map((tx: any) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {tx.description || "Sem descrição"}
                      </p>
                      <div className="flex items-center gap-2">
                        <Calendar size={10} className="text-slate-400" />
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(tx.date)}
                        </span>
                      </div>
                    </div>
                    <span className={`font-bold text-sm flex-shrink-0 ${
                      (tx.amount || 0) >= 0 ? "text-teal-600 dark:text-teal-400" : "text-red-500"
                    }`}>
                      {formatCurrency(tx.amount || 0)}
                    </span>
                  </div>
                ))}
              {transactions.length > 5 && (
                <button
                  onClick={() => setExpandedTransactions(!expandedTransactions)}
                  className="w-full text-center text-xs text-teal-500 hover:text-teal-600 font-semibold py-2"
                >
                  {expandedTransactions ? "Ver menos" : `Ver todas (${transactions.length})`}
                  <ChevronDown size={12} className={`inline ml-1 transition-transform ${expandedTransactions ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}