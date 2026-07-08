'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { 
  Search, SlidersHorizontal, ChevronLeft, ChevronRight, ReceiptText, 
  Download, ArrowLeftRight, ArrowDown, ArrowUp, Layers, Clock, ChevronDown 
} from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { TransactionItem } from '@/components/transactions/TransactionItem'
import { useLocalData } from '@/hooks/useLocalData'
import { db, addToSyncQueue } from '@/lib/db'
import { useToast } from '@/contexts/ToastContext'

type Filter = 'all' | 'income' | 'expense' | 'transfer'
type StatusFilter = 'all' | 'pending' | 'done'

const safeNum = (val: any) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(',', '.').replace(/[^0-9.-]+/g,""));
  return isNaN(parsed) ? 0 : parsed;
}

function groupByDate(transactions: any[]) {
  const groups: Record<string, any[]> = {}
  transactions.forEach(t => {
    const key = t.date || 'Sem Data'
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  })
  return groups
}

function dateLabel(dateStr: string) {
  if (dateStr === 'Sem Data') return dateStr;
  const d = new Date(dateStr + 'T12:00:00')
  if (isToday(d)) return 'HOJE'
  if (isYesterday(d)) return 'ONTEM'
  return format(d, "dd 'DE' MMMM", { locale: ptBR }).toUpperCase()
}

// ----------------------------------------------------------------------
// COMPONENTE DE CARD DE PENDENTES (AGORA SUPORTA O SWIPE)
// ----------------------------------------------------------------------
function PendingCard({ txs, loading, onToggleStatus, onDelete }: { txs: any[]; loading: boolean; onToggleStatus: any; onDelete: any }) {
  const [collapsed, setCollapsed] = useState(false)

  if (loading) {
    return (
      <div className="mb-6 animate-pulse">
        <div className="h-[60px] bg-amber-100/60 dark:bg-amber-900/20 rounded-[20px]" />
      </div>
    )
  }

  if (txs.length === 0) return null

  const totalExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + safeNum(t.amount), 0)
  const totalIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + safeNum(t.amount), 0)
  const fmt = (v: number) => `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="mb-6">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-[20px] mb-3 transition-all active:scale-[0.99]"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center">
            <Clock size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-[13px] font-bold text-amber-800 dark:text-amber-300 leading-tight">
              {txs.length} {txs.length === 1 ? 'transação pendente' : 'transações pendentes'}
            </p>
            <p className="text-[11px] font-medium mt-0.5">
              {totalExpense > 0 && <span className="text-red-500 dark:text-red-400">−{fmt(totalExpense)}</span>}
              {totalExpense > 0 && totalIncome > 0 && <span className="text-gray-300 mx-1">·</span>}
              {totalIncome > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{fmt(totalIncome)}</span>}
            </p>
          </div>
        </div>
        <ChevronDown size={18} className={`text-amber-500 dark:text-amber-400 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
      </button>

      {!collapsed && (
        <div className="space-y-0 animate-in fade-in slide-in-from-top-1 duration-200">
          {txs.map((t) => (
            <TransactionItem key={t.id} transaction={t} onToggleStatus={onToggleStatus} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------
// PÁGINA PRINCIPAL DE TRANSAÇÕES
// ----------------------------------------------------------------------
export default function TransactionsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { effectiveContext } = useContext_() 
  const { showToast } = useToast()

  // 🔥 O filtro agora vem setado como 'all' para resolver o visual vazio
  const [filter, setFilter] = useState<Filter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())

  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)

  const startMonth = format(startOfMonth(currentDate), 'yyyy-MM-dd')
  const endMonth = format(endOfMonth(currentDate), 'yyyy-MM-dd')
  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) setShowExportMenu(false)
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) setShowStatusMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filtros Locais com Blindagem de Contexto
  const localFilters: Record<string, any> = { context: effectiveContext }
  if (filter !== 'all') localFilters.type = filter
  if (statusFilter !== 'all') localFilters.status = statusFilter

  // Busca Local First (Dexie)
  const { data: localTransactions, loading, syncing, reload: reloadTransactions } = useLocalData({ table: 'transactions' as any, filters: localFilters })
  const { data: localCategories } = useLocalData({ table: 'categories' as any, filters: { context: effectiveContext } })
  const { data: localAccounts } = useLocalData({ table: 'accounts' as any, filters: { context: effectiveContext } })

  // Processamento e JOIN em Memória
  const transactionsWithJoin = (localTransactions || []).map((tx: any) => {
    const category = (localCategories || []).find((c: any) => c.id === tx.category_id) as any
    const account = (localAccounts || []).find((a: any) => a.id === tx.account_id) as any
    return { 
      ...tx, 
      categories: category ? { name: category.name, icon: category.icon, color: category.color } : null, 
      accounts: account ? { name: account.name, color: account.color } : null 
    }
  })

  const filtered = transactionsWithJoin.filter((t: any) => {
    if (t.date < startMonth || t.date > endMonth) return false
    if (search) {
      const desc = String(t.description || '').toLowerCase()
      const cat = String(t.categories?.name || '').toLowerCase()
      const term = search.toLowerCase()
      if (!desc.includes(term) && !cat.includes(term)) return false
    }
    return true
  })

  const pendingTxs = filtered.filter((t: any) => t.status === 'pending')
  const doneTxs = filtered.filter((t: any) => t.status === 'done')
  const displayTxs = statusFilter === 'pending' ? pendingTxs : doneTxs
  const grouped = groupByDate(displayTxs)
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  useEffect(() => { 
    if (user?.id && effectiveContext) reloadTransactions() 
  }, [user?.id, effectiveContext, currentDate, filter, statusFilter, reloadTransactions])

  // 🔥 LÓGICA DE SWIPE: Efetivar/Pendente e Atualizar Saldo
        const handleToggleStatus = async (tx: any) => {
    if (!user?.id) return;
    
    // 1. CHECAGEM DE IDENTIDADE
    if (!tx.id || !tx.account_id) {
       showToast(`Erro: Falta ID (${tx.id}) ou Conta (${tx.account_id})`, "error");
       return;
    }

    try {
      const newStatus = tx.status === 'pending' ? 'done' : 'pending';
      const amount = safeNum(tx.amount);
      
      // 2. BUSCA A CONTA ATUAL
      const acc = await db.table('accounts').get(tx.account_id);
      if (!acc) {
        showToast("Erro: Conta não encontrada no banco local", "error");
        return;
      }

      // 3. CÁLCULO
      let currentBalance = safeNum(acc.balance);
      let newBalance = newStatus === 'done' 
        ? (tx.type === 'income' ? currentBalance + amount : currentBalance - amount)
        : (tx.type === 'income' ? currentBalance - amount : currentBalance + amount);

      // 4. ESCRITA FORÇADA (Sem Transaction para evitar travamento)
      await db.table('accounts').update(acc.id, { balance: newBalance });
      await db.table('transactions').update(tx.id, { status: newStatus });
      
      // 5. SINCRONIZAÇÃO
      await addToSyncQueue(user.id, 'accounts', 'update', acc.id, { balance: newBalance });
      await addToSyncQueue(user.id, 'transactions', 'update', tx.id, { status: newStatus });

      showToast(`Sucesso: ${newStatus === 'done' ? 'Efetivado' : 'Pendente'}. Novo saldo: ${newBalance.toFixed(2)}`, "success");
      
      // 6. FORÇA O REACT A ATUALIZAR A LISTA
      await reloadTransactions();
      
    } catch (e: any) {
      showToast(`Erro crítico: ${e.message}`, "error");
    }
  };




  // 🔥 LÓGICA DE SWIPE: Excluir e Estornar Saldo
  const handleDelete = async (tx: any) => {
    if (!user?.id) return
    try {
      if (tx.status === 'done' && tx.account_id) {
        const acc = await db.table('accounts').get(tx.account_id)
        if (acc) {
          let newBalance = Number(acc.balance)
          newBalance = tx.type === 'income' ? newBalance - Number(tx.amount) : newBalance + Number(tx.amount)
          await db.table('accounts').update(acc.id, { balance: newBalance })
          await addToSyncQueue(user.id, 'accounts', 'update', acc.id, { balance: newBalance })
        }
      }
      await db.table('transactions').delete(tx.id)
      await addToSyncQueue(user.id, 'transactions', 'delete', tx.id, { id: tx.id })
      showToast('Transação excluída.', 'info')
      reloadTransactions()
    } catch(e) {
      showToast('Erro ao excluir transação.', 'error')
    }
  }

  const handleExport = (range: string) => {
    setShowExportMenu(false)
    if (!user) return
    window.open(`/api/export-transactions?userId=${user.id}&context=${effectiveContext}&range=${range}`, '_blank')
  }

  const filterButtons: { key: Filter; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'Todas', icon: <Layers size={14} /> },
    { key: 'income', label: 'Receitas', icon: <ArrowUp size={14} /> },
    { key: 'expense', label: 'Despesas', icon: <ArrowDown size={14} /> },
    { key: 'transfer', label: 'Transferências', icon: <ArrowLeftRight size={14} /> },
  ]

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-950 pb-24 font-sans relative transition-colors duration-300">
      
      {syncing && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {/* HEADER E MENUS SUPERIORES */}
      <div className="sticky top-0 z-50 bg-[#f8f9fa]/85 dark:bg-slate-950/85 backdrop-blur-xl pt-2 pb-2 px-4 mb-0 shadow-sm border-b border-gray-200/50 dark:border-slate-800/50">
        <div className="flex items-center justify-between mb-2 mt-1">
          <h1 className="text-[22px] font-bold text-gray-800 dark:text-gray-100">Transações</h1>
          
          <div className="flex items-center gap-2">
            {/* Menu de Exportação */}
            <div className="relative" ref={exportMenuRef}>
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="w-9 h-9 bg-white dark:bg-slate-900 shadow-sm border border-gray-100 dark:border-slate-800 rounded-full flex items-center justify-center transition-colors hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                <Download size={18} className="text-gray-700 dark:text-gray-300" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-[42px] w-40 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-2 z-40 animate-in fade-in zoom-in-95 duration-200">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 py-2">Exportar extrato</p>
                  {[{ key: '7', label: '7 dias' }, { key: '14', label: '14 dias' }, { key: '30', label: '30 dias' }, { key: 'total', label: 'Todo período' }].map(opt => (
                    <button key={opt.key} onClick={() => handleExport(opt.key)} className="w-full text-left px-3 py-2 rounded-xl text-[13px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700">{opt.label}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Navegação de Mês */}
            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 shadow-sm border border-gray-100 dark:border-slate-800 px-3 py-1.5 rounded-full">
              <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"><ChevronLeft size={18} /></button>
              <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200 capitalize w-24 text-center">{monthLabel}</span>
              <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>

        <div className="mb-2">
          <ContextToggle />
        </div>

        <div className="flex gap-2 mb-2 relative">
          <div className="flex-1 flex items-center gap-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-[16px] px-4 py-3 shadow-sm">
            <Search size={18} className="text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar transação..."
              className="flex-1 bg-transparent text-[14px] outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 font-medium" />
          </div>

          <div className="relative" ref={statusMenuRef}>
            <button 
              onClick={() => setShowStatusMenu(!showStatusMenu)} 
              className={`w-[48px] h-[48px] rounded-[16px] flex items-center justify-center transition-colors shadow-sm border ${showStatusMenu || statusFilter !== 'all' ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-400' : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
            >
              <SlidersHorizontal size={20} />
            </button>

            {showStatusMenu && (
              <div className="absolute right-0 top-[54px] w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-2 z-40 animate-in fade-in zoom-in-95 duration-200">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 py-2">Filtrar por Status</p>
                <button onClick={() => { setStatusFilter('all'); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold ${statusFilter === 'all' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Todas</button>
                <button onClick={() => { setStatusFilter('pending'); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold ${statusFilter === 'pending' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Pendentes</button>
                <button onClick={() => { setStatusFilter('done'); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold ${statusFilter === 'done' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Efetivadas</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filterButtons.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-5 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all shadow-sm flex items-center gap-1.5 ${filter === f.key ? 'bg-teal-700 text-white border border-teal-700' : 'bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ÁREA DE LISTAGEM */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center p-10"><div className="w-8 h-8 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" /></div>
        ) : displayTxs.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-400 dark:text-gray-500 animate-in fade-in duration-300">
            <ReceiptText size={48} className="mb-4 opacity-20" />
            <p className="text-[15px] font-bold">Nenhuma transação</p>
            <p className="text-[13px] mt-1">Nenhum resultado encontrado.</p>
          </div>
        ) : (
          <>
            {/* CARDS DE PENDENTES RESTAURADO E INTEGRADO */}
            {statusFilter !== 'pending' && pendingTxs.length > 0 && (
              <PendingCard 
                txs={pendingTxs} 
                loading={false} 
                onToggleStatus={handleToggleStatus} 
                onDelete={handleDelete} 
              />
            )}

            {/* LISTA PRINCIPAL COM SWIPE */}
            <div className="space-y-6 pb-10 animate-in fade-in duration-300">
              {sortedDates.map(date => (
                <div key={date}>
                  <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 mb-3 px-1 tracking-wider uppercase">{dateLabel(date)}</p>
                  <div className="space-y-0">
                    {grouped[date].map((t) => (
                      <TransactionItem
                        key={t.id}
                        transaction={t}
                        onToggleStatus={handleToggleStatus}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
