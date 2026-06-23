'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Edit2, ArrowRightLeft, Scale, ChevronRight, X, Loader2, Check, Clock } from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const DEFAULT_COLORS = ['#dc2626', '#16a34a', '#0284c7', '#8b5cf6', '#111827', '#f59e0b', '#ec4899', '#64748b']

export default function AccountStatementPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  
  const [account, setAccount] = useState<any>(null)
  const [allAccounts, setAllAccounts] = useState<any[]>([]) 
  const [transactions, setTransactions] = useState<any[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [summary, setSummary] = useState({ income: 0, expense: 0 })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showBalanceModal, setShowBalanceModal] = useState(false)

  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLORS[0])
  const [displayBalance, setDisplayBalance] = useState('')
  const [balanceNum, setBalanceNum] = useState(0)

  const [adjustBalanceDisplay, setAdjustBalanceDisplay] = useState('')

  const [destAccountId, setDestAccountId] = useState('')
  const [transferAmountDisplay, setTransferAmountDisplay] = useState('')
  const [transferDate, setTransferDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [transferDesc, setTransferDesc] = useState('')

  const monthLabel = format(currentDate, 'MMMM \'De\' yyyy', { locale: ptBR })

  const loadData = useCallback(async () => {
    if (!id || !user) return
    setLoading(true)

    try {
      const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
      const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

      const { data: accData } = await supabase
        .from('accounts')
        .select('*')
        .match({ user_id: user.id, id: id })
        .single()

      if (accData) setAccount(accData)

      if (accData) {
        const { data: allAccs } = await supabase
          .from('accounts')
          .select('*')
          .match({ user_id: user.id, context: accData.context })
        setAllAccounts((Array.isArray(allAccs) ? allAccs : []).filter(a => a.id !== id))
      }

      const { data: txsData } = await supabase
        .from('transactions')
        .select('*, categories(name, icon, color)')
        .match({ user_id: user.id, account_id: id })
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })

      const txs = Array.isArray(txsData) ? txsData : []
      setTransactions(txs)

      const income = txs.filter(t => t.type === 'income' || (t.type === 'transfer' && t.description?.includes('de '))).reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const expense = txs.filter(t => t.type === 'expense' || t.type === 'sangria' || (t.type === 'transfer' && t.description?.includes('para '))).reduce((a, t) => a + (Number(t.amount) || 0), 0)
      
      setSummary({ income, expense })

    } catch (err) {
      console.error("Erro inesperado:", err)
    } finally {
      setLoading(false)
    }
  }, [id, currentDate, user])

  useEffect(() => { loadData() }, [loadData])

  const formatMoneyInput = (value: string) => {
    const rawValue = value.replace(/\D/g, '')
    const num = Number(rawValue) / 100
    return { num, display: num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
  }

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { num, display } = formatMoneyInput(e.target.value)
    setBalanceNum(num); setDisplayBalance(display)
  }

  const handleAdjustBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdjustBalanceDisplay(formatMoneyInput(e.target.value).display)
  }

  const handleTransferAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTransferAmountDisplay(formatMoneyInput(e.target.value).display)
  }

  const handleSaveAccountInfo = async () => {
    if (!name.trim() || !user) return
    setActionLoading(true)
    await supabase.from('accounts').update({ name: name.trim(), balance: balanceNum, color }).eq('id', id)
    setShowForm(false)
    router.refresh()
    loadData()
    setActionLoading(false)
  }

  const handleAdjustBalanceSubmit = async () => {
    if (!user) return
    setActionLoading(true)
    const rawAmount = parseFloat(adjustBalanceDisplay.replace(/\./g, '').replace(',', '.')) || 0;
    await supabase.from('accounts').update({ balance: rawAmount }).eq('id', id);
    setShowBalanceModal(false);
    router.refresh()
    loadData();
    setActionLoading(false)
  }

  const handleTransferSubmit = async () => {
    if (!destAccountId || !transferAmountDisplay) return alert("Preencha o destino e o valor.")
    if (!user) return
    setActionLoading(true)
    
    const rawAmount = parseFloat(transferAmountDisplay.replace(/\./g, '').replace(',', '.')) || 0;
    const destAcc = allAccounts.find(a => a.id === destAccountId);

    if (!destAcc) return;

    try {
      await supabase.from('accounts').update({ balance: Number(account.balance) - rawAmount }).eq('id', id);
      await supabase.from('accounts').update({ balance: Number(destAcc.balance) + rawAmount }).eq('id', destAccountId);

      await supabase.from('transactions').insert({
        account_id: id,
        type: 'transfer',
        amount: rawAmount,
        description: transferDesc || `Transferência para ${destAcc.name}`,
        date: transferDate,
        status: 'done',
        context: account.context,
        user_id: user.id
      });

      await supabase.from('transactions').insert({
        account_id: destAccountId,
        type: 'transfer',
        amount: rawAmount,
        description: transferDesc || `Transferência de ${account.name}`,
        date: transferDate,
        status: 'done',
        context: account.context,
        user_id: user.id
      });

      setShowTransferModal(false);
      setTransferAmountDisplay('');
      setTransferDesc('');
      router.refresh()
      loadData();
    } catch (error) {
      console.error(error)
      alert("Erro ao transferir.")
    } finally {
      setActionLoading(false)
    }
  }

  const openEditModal = () => {
    if (!account) return
    setName(account.name)
    setColor(account.color)
    const safeBalance = Number(account.balance) || 0
    setBalanceNum(safeBalance)
    setDisplayBalance(safeBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
    setShowForm(true)
  }

  const openBalanceModal = () => {
    const safeBalance = Number(account.balance) || 0
    setAdjustBalanceDisplay(safeBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
    setShowBalanceModal(true)
  }

  const formatCurrency = (val: number) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (loading && !account) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin text-teal-600" size={40} />
    </div>
  )

  if (!account) return <div className="p-6 text-center text-gray-500">Conta não encontrada.</div>

  const initials = account.name ? account.name.substring(0, 2).toUpperCase() : '??'
  const safeBalance = Number(account.balance) || 0

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] pb-20 font-sans relative">
      
      <div className="flex justify-between items-center p-4 bg-white sticky top-0 z-10 border-b border-gray-50">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 hover:text-gray-500 transition-colors"><ChevronLeft size={24} /></button>
        <h1 className="font-bold text-[17px] text-gray-800">Detalhes da Conta</h1>
        <div className="flex items-center gap-3 text-teal-700">
          <button onClick={() => setShowTransferModal(true)} className="p-1 hover:text-teal-800 transition-colors"><ArrowRightLeft size={20} /></button>
          <button onClick={openBalanceModal} className="p-1 hover:text-teal-800 transition-colors"><Scale size={20} /></button>
          <button onClick={openEditModal} className="p-1 hover:text-teal-800 transition-colors"><Edit2 size={20} /></button>
        </div>
      </div>

      <div className="bg-white px-4 pt-6 pb-8 flex flex-col items-center shadow-[0_2px_10px_rgba(0,0,0,0.02)] border-b border-gray-50 mb-6">
        <div className="w-14 h-14 rounded-[16px] flex items-center justify-center text-xl font-bold text-white mb-4 shadow-sm" style={{ backgroundColor: account.color || '#f97316' }}>{initials}</div>
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-1">{account.name}</p>
        <p className="text-[32px] font-light text-gray-800 mb-6">{formatCurrency(safeBalance)}</p>

        <div className="flex items-center justify-between w-full max-w-[240px] bg-white border border-gray-100 shadow-sm rounded-full p-1.5 mb-8">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 text-gray-400 hover:text-gray-800 transition-colors"><ChevronLeft size={16} /></button>
          <span className="text-[13px] font-bold text-gray-800 capitalize">{monthLabel}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 text-gray-400 hover:text-gray-800 transition-colors"><ChevronRight size={16} /></button>
        </div>

        <div className="flex w-full justify-center gap-10 px-6">
          <div className="text-center">
            <p className="text-[11px] text-gray-400 font-bold tracking-wider uppercase mb-1">Entradas</p>
            <p className="text-[15px] font-bold text-emerald-600">{formatCurrency(summary.income)}</p>
          </div>
          <div className="w-[1px] bg-gray-100"></div>
          <div className="text-center">
            <p className="text-[11px] text-gray-400 font-bold tracking-wider uppercase mb-1">Saídas</p>
            <p className="text-[15px] font-bold text-red-500">{formatCurrency(summary.expense)}</p>
          </div>
        </div>
      </div>

      <div className="px-4">
        <h3 className="text-[15px] font-bold text-gray-800 mb-3 px-1">Extrato do Mês</h3>
        {transactions.length === 0 ? (
          <div className="bg-white rounded-[24px] border border-gray-50 p-10 text-center shadow-sm">
             <p className="text-sm text-gray-400">Nenhuma movimentação neste mês.</p>
          </div>
        ) : (
          <div className="bg-white rounded-[24px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-50 overflow-hidden py-2">
            {transactions.map((tx, index) => {
               const isTransferIn = tx.type === 'transfer' && tx.description?.includes('de ');
               const isIncomeVisual = tx.type === 'income' || isTransferIn;
               const isPending = tx.status === 'pending';

               return (
                <div 
                  key={tx.id} 
                  onClick={() => router.push(`/transactions/${tx.id}`)}
                  className={`flex items-center justify-between px-4 py-4 cursor-pointer hover:bg-gray-50 transition-colors gap-3 ${index !== transactions.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  {isPending ? (
                    <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                      <Clock size={12} className="text-red-400" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <Check size={12} className="text-emerald-500" />
                    </div>
                  )}

                  <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                    <div className="w-10 h-10 rounded-[12px] flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: `${tx.categories?.color || '#cbd5e1'}20` }}>
                      {tx.type === 'transfer' ? '🔄' : (tx.categories?.icon || '💸')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-800 uppercase tracking-tight truncate">{tx.description || tx.categories?.name}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })}</p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className={`text-[14px] font-bold ${isIncomeVisual ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isIncomeVisual ? '+' : '-'} {formatCurrency(Number(tx.amount) || 0)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: EDITAR CONTA */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-[24px] w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-6">
              <h2 className="font-bold text-xl text-gray-800">Editar Conta</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da Conta" className="w-full bg-gray-50 p-4 rounded-[16px] mb-4 font-bold text-gray-800 outline-none focus:border-teal-600 border-2 border-transparent transition-colors" />
            <div className="flex flex-wrap gap-3 mb-8 items-center justify-center">
              {DEFAULT_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} className={`w-10 h-10 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
            <button onClick={handleSaveAccountInfo} disabled={actionLoading} className="w-full bg-teal-700 hover:bg-teal-800 transition-colors text-white py-4 rounded-[16px] font-bold flex justify-center items-center shadow-lg shadow-teal-700/20">
              {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: BALANÇA */}
      {showBalanceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowBalanceModal(false)}>
          <div className="bg-white rounded-t-[32px] sm:rounded-[24px] w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-8">
              <div>
                <h2 className="font-bold text-xl text-gray-800">Ajustar Saldo</h2>
                <p className="text-[12px] text-gray-500 mt-1">Atualize o saldo real da conta no banco.</p>
              </div>
              <button onClick={() => setShowBalanceModal(false)} className="text-gray-400"><X size={20}/></button>
            </div>
            <div className="bg-gray-50 p-4 rounded-[20px] mb-8 flex items-center gap-2 border border-gray-100">
               <span className="text-xl text-gray-400 font-light">R$</span>
               <input type="text" inputMode="numeric" value={adjustBalanceDisplay} onChange={handleAdjustBalanceChange} className="w-full bg-transparent text-3xl font-light text-gray-800 outline-none" />
            </div>
            <button onClick={handleAdjustBalanceSubmit} disabled={actionLoading} className="w-full bg-gray-900 text-white py-4 rounded-[20px] font-bold flex justify-center items-center shadow-lg">
              {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Confirmar Novo Saldo'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: TRANSFERÊNCIA */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowTransferModal(false)}>
          <div className="bg-white rounded-t-[32px] sm:rounded-[24px] w-full max-w-sm p-6 shadow-2xl overflow-y-auto max-h-[90vh] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-8">
              <div>
                <h2 className="font-bold text-xl text-gray-800">Transferência</h2>
                <p className="text-[12px] text-gray-500 mt-1">Saindo de: <span className="font-bold text-gray-700">{account.name}</span></p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-gray-400"><X size={20}/></button>
            </div>

            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Conta de Destino</label>
            <select value={destAccountId} onChange={(e) => setDestAccountId(e.target.value)} className="w-full bg-white border border-gray-100 p-4 rounded-[16px] mb-4 text-[14px] font-bold text-gray-800 outline-none appearance-none shadow-sm">
              <option value="">Selecione o destino...</option>
              {allAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>

            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 mt-4">Valor da Transferência</label>
            <div className="bg-gray-50 p-4 rounded-[16px] mb-4 flex items-center gap-2 border border-gray-100">
               <span className="text-xl text-gray-400 font-light">R$</span>
               <input type="text" inputMode="numeric" value={transferAmountDisplay} onChange={handleTransferAmountChange} placeholder="0,00" className="w-full bg-transparent text-2xl font-light text-gray-800 outline-none" />
            </div>

            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 mt-4">Data</label>
            <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="w-full bg-white border border-gray-100 p-4 rounded-[16px] mb-4 text-[14px] font-bold text-gray-800 outline-none shadow-sm" />

            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 mt-4">Descrição (Opcional)</label>
            <input type="text" value={transferDesc} onChange={(e) => setTransferDesc(e.target.value)} placeholder="Ex: Pagamento" className="w-full bg-white border border-gray-100 p-4 rounded-[16px] mb-8 text-[14px] font-bold text-gray-800 outline-none shadow-sm" />

            <button onClick={handleTransferSubmit} disabled={actionLoading} className="w-full bg-teal-700 hover:bg-teal-800 text-white py-4 rounded-[20px] font-bold flex justify-center items-center shadow-lg shadow-teal-700/20">
              {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Efetuar Transferência'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}