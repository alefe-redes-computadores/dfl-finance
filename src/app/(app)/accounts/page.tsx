'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
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
  ChevronLeft,
  Landmark,
  Briefcase,
  Settings2,
  GripVertical,
  Check,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useAccountsList } from "@/hooks/useAccountsList"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import ContextToggle from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"
import { useSafeDb } from '@/hooks/useSafeDb'
import BankLogo from '@/components/BankLogo'
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd'

const ACCOUNT_LABELS: Record<string, string> = {
  checking: "Conta Corrente",
  savings: "Poupança",
  investment: "Investimento",
  credit_card: "Cartão de Crédito",
  wallet: "Carteira Física",
  other: "Outros",
}

// ========== CHAVE PARA LOCALSTORAGE ==========
const STORAGE_KEY = 'dfl_accounts_order'

function sortAccountsByOrder(accounts: any[], order: string[]) {
  if (order.length === 0) return accounts

  return [...accounts].sort((a, b) => {
    const idxA = order.indexOf(a.id)
    const idxB = order.indexOf(b.id)

    if (idxA === -1 && idxB === -1) return 0
    if (idxA === -1) return 1
    if (idxB === -1) return -1

    return idxA - idxB
  })
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
  
  // ========== PERSONALIZAÇÃO DA ORDEM (ITENS DA LISTA) ==========
  const [showPersonalizeModal, setShowPersonalizeModal] = useState(false)
  const [accountOrder, setAccountOrder] = useState<string[]>([])

  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // USANDO HOOK ESPECÍFICO
  const { data: accounts, loading } = useAccountsList(effectiveContext)

  // ========== CARREGAR ORDEM SALVA POR CONTEXTO ==========
  useEffect(() => {
    try {
      const contextKey = `${STORAGE_KEY}:${effectiveContext}`
      const saved =
        localStorage.getItem(contextKey) ||
        localStorage.getItem(STORAGE_KEY)

      if (!saved) {
        setAccountOrder([])
        return
      }

      const parsed = JSON.parse(saved)

      if (parsed.order && Array.isArray(parsed.order)) {
        setAccountOrder(parsed.order)
      } else {
        setAccountOrder([])
      }
    } catch (e) {
      console.warn('Erro ao carregar ordem de contas:', e)
      setAccountOrder([])
    }
  }, [effectiveContext])

  // ========== SALVAR ORDEM POR CONTEXTO ==========
  const saveOrder = useCallback((order: string[]) => {
    setAccountOrder(order)

    try {
      const contextKey = `${STORAGE_KEY}:${effectiveContext}`
      localStorage.setItem(contextKey, JSON.stringify({ order }))
    } catch (e) {
      console.warn('Erro ao salvar ordem de contas:', e)
    }
  }, [effectiveContext])

  // ========== HANDLER DO DRAG & DROP ==========
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const sourceIndex = result.source.index
    const destIndex = result.destination.index

    if (sourceIndex === destIndex) return

    const orderedItems = sortAccountsByOrder(
      accounts || [],
      accountOrder
    )

    const newItems = Array.from(orderedItems)
    const [removed] = newItems.splice(sourceIndex, 1)

    if (!removed) return

    newItems.splice(destIndex, 0, removed)

    const newOrder = newItems.map(item => item.id)
    saveOrder(newOrder)
  }

  const openPersonalize = () => {
    setShowPersonalizeModal(true)
    vibrate([5])
  }

  const handleSavePersonalize = () => {
    setShowPersonalizeModal(false)
    showToast('Ordem personalizada!', 'success')
    success()
    vibrate([10])
  }

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
        setTimeout(() => setRefreshing(false), 600)
      }
    }
  }, [refreshing, vibrate])

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

  // ========== APLICAR ORDEM PERSONALIZADA ==========
  const sortedAccounts = useMemo(
    () => sortAccountsByOrder(filteredAccounts, accountOrder),
    [filteredAccounts, accountOrder]
  )

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)

  const totalBalance = (accounts || []).reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0)

  // ========== MODAL DE PERSONALIZAÇÃO (REORDENAR CONTAS) ==========
  const PersonalizeOrderModal = () => {
    if (!showPersonalizeModal) return null

    const orderedItems = sortAccountsByOrder(
      accounts || [],
      accountOrder
    )

    return createPortal(
      <div className="fixed inset-0 z-[99999] flex items-end justify-center" onClick={() => setShowPersonalizeModal(false)}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[32px] shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-8 duration-300"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex-shrink-0 flex justify-center pt-4 pb-2">
            <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-slate-700" />
          </div>

          <div className="flex-shrink-0 bg-white dark:bg-slate-800 px-6 pt-2 pb-4 border-b border-gray-100 dark:border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-[20px] text-gray-800 dark:text-gray-100 tracking-tight">
                  Reordenar Contas
                </h2>
                <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">
                  Arraste para reorganizar a ordem das contas
                </p>
              </div>
              <button
                onClick={() => setShowPersonalizeModal(false)}
                className="p-2.5 bg-gray-50 dark:bg-slate-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full transition-colors active:scale-95"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="accounts">
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`space-y-2 transition-colors duration-200 ${
                      snapshot.isDraggingOver ? 'bg-teal-50/30 dark:bg-teal-900/10 rounded-[24px] p-1' : ''
                    }`}
                  >
                    {orderedItems.map((acc: any, index: number) => (
                      <Draggable key={acc.id} draggableId={acc.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center gap-3 p-3 rounded-[20px] transition-all ${
                              snapshot.isDragging
                                ? 'bg-white dark:bg-slate-800 shadow-lg ring-2 ring-teal-500/30 scale-[1.02]'
                                : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                            } border border-gray-100 dark:border-slate-700/50`}
                          >
                            <div
                              {...provided.dragHandleProps}
                              className="shrink-0 p-1.5 rounded-full cursor-grab text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                            >
                              <GripVertical size={18} />
                            </div>

                            <BankLogo color={acc.color} name={acc.name} size="md" />

                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {acc.name}
                              </p>
                              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                {ACCOUNT_LABELS[acc.type] || acc.type}
                              </p>
                            </div>

                            <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500">
                              #{index + 1}
                            </span>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          <div className="flex-shrink-0 bg-white dark:bg-slate-800 px-6 pt-4 pb-6 border-t border-gray-100 dark:border-slate-700/50">
            <button
              onClick={handleSavePersonalize}
              className="w-full py-3.5 rounded-[20px] bg-teal-600 hover:bg-teal-700 text-white font-bold text-[14px] shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Check size={18} />
              Guardar Ordem
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#f6f7f8] font-sans transition-colors duration-300 dark:bg-slate-950">
      
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

      {/* HEADER UNIFICADO COM BOTÃO DE VOLTAR */}
      <div className="sticky top-0 z-40 border-b border-black/5 bg-[#f6f7f8]/92 px-4 pb-3 pt-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/92">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => { vibrate([5]); router.push('/more'); }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-black/5 bg-white text-gray-500 shadow-sm transition-all active:scale-95 dark:border-white/10 dark:bg-slate-900 dark:text-gray-300"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="text-[22px] font-semibold tracking-tight text-gray-950 dark:text-white">
                  Contas
                </h1>
                <p className="mt-0.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                  {appMode === "personal_only" ? "Visão pessoal" : "Visão global"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => { vibrate([5]); setShowSearch(!showSearch); }}
                className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-black/5 bg-white text-gray-600 shadow-sm transition-all active:scale-95 dark:border-white/10 dark:bg-slate-900 dark:text-gray-300"
              >
                {showSearch ? <X size={18} /> : <Search size={18} />}
              </button>

              <button
                type="button"
                onClick={() => { vibrate([10]); router.push("/accounts/new"); }}
                className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-teal-600 text-white shadow-sm shadow-teal-600/20 transition-all active:scale-95"
              >
                <Plus size={20} />
              </button>

              {/*  BOTÃO PERSONALIZAR - REORDENAR CONTAS (ITENS) */}
              <button
                type="button"
                onClick={openPersonalize}
                className="h-11 w-11 rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/40 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
              >
                <Settings2 size={20} />
              </button>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <ContextToggle />
            </div>

            <span className="shrink-0 rounded-full border border-black/5 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-400">
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
        className="custom-scrollbar flex-1 overflow-y-auto px-4 pb-28 pt-3"
      >
        {/* CARD DE SALDO CONSOLIDADO */}
        {!loading && (
          <div className="mx-auto mb-3 w-full max-w-2xl overflow-hidden rounded-[22px] bg-slate-950 px-5 py-4 text-white shadow-sm dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-medium text-slate-400">
                  Saldo consolidado
                </p>
                <p className="text-[29px] font-semibold leading-none tracking-tight text-white">
                  {formatCurrency(totalBalance)}
                </p>
                <p className="mt-2 text-[11px] font-medium text-slate-400">
                  Compondo {accounts?.length || 0} {(accounts?.length || 0) === 1 ? 'conta' : 'contas'}
                </p>
              </div>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white/10">
                <Wallet size={22} className="text-teal-300" />
              </div>
            </div>
          </div>
        )}

        {/* FILTROS RÁPIDOS */}
        {!loading && accounts?.length > 0 && (
          <div className="scrollbar-hide mx-auto mb-1 flex w-full max-w-2xl gap-2 overflow-x-auto pb-3">
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
                className={`h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-[12px] font-semibold transition-all active:scale-[0.97] ${
                  accountFilter === f.key
                    ? 'border-transparent bg-gray-950 text-white shadow-sm dark:bg-white dark:text-gray-950'
                    : 'border-black/5 bg-white text-gray-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* LISTAGEM DE CONTAS - ORDEM PERSONALIZADA */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton count={1} height="120px" borderRadius="24px" />
            <Skeleton count={3} height="80px" borderRadius="18px" />
          </div>
        ) : sortedAccounts.length === 0 ? (
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
          <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-[22px] border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="flex flex-col">
              {sortedAccounts.map((acc: any, index: number) => {
                const isPositive = (acc.balance || 0) >= 0
                return (
                  <div
                    key={acc.id}
                    onClick={() => { vibrate([5]); router.push(`/accounts/details?id=${acc.id}`); }}
                    className={`flex cursor-pointer items-center justify-between px-4 py-3.5 transition-colors active:bg-gray-50 dark:active:bg-slate-800 ${
                      index !== sortedAccounts.length - 1 ? "border-b border-gray-100 dark:border-slate-700/50" : ""
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <BankLogo color={acc.color} name={acc.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-gray-950 dark:text-gray-100">
                          {acc.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-gray-400 dark:text-gray-500">
                          <span className="truncate max-w-[120px]">
                            {ACCOUNT_LABELS[acc.type] || acc.type}
                          </span>
                          {acc.bank && (
                            <>
                              <span className="text-gray-300 dark:text-slate-600">•</span>
                              <span className="truncate">{acc.bank}</span>
                            </>
                          )}
                        </div>
                        <p className={`mt-1 text-[14px] font-semibold tracking-tight ${
                          isPositive
                            ? "text-teal-600 dark:text-teal-400"
                            : "text-red-500 dark:text-red-400"
                        }`}>
                          {formatCurrency(acc.balance || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          vibrate([10])
                          setDeleteModal(acc.id)
                        }}
                        className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-[0.98]"
                        aria-label="Excluir conta"
                      >
                        <Trash2 size={16} />
                      </button>
                      <ChevronRight size={16} className="text-gray-400 dark:text-gray-500" />
                    </div>
                  </div>
                )
              })}
            </div>
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

      {/*  MODAL DE REORDENAÇÃO (ITENS DA LISTA) */}
      <PersonalizeOrderModal />
    </div>
  )
}

export default function AccountsPage() {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => setIsClient(true), [])
  if (!isClient) return <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900" />
  return <AccountsContent />
}