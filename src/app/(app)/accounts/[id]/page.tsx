'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Edit2, ArrowRightLeft, Scale, ChevronRight, X, Plus, Loader2 } from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const DEFAULT_COLORS = ['#dc2626', '#16a34a', '#0284c7', '#8b5cf6', '#111827', '#f59e0b', '#ec4899', '#64748b']

export default function AccountStatementPage() {
  const { id } = useParams()
  const router = useRouter()
  
  const [account, setAccount] = useState<any>(null)
  const [allAccounts, setAllAccounts] = useState<any[]>([]) // Para o select de transferência
  const [transactions, setTransactions] = useState<any[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [summary, setSummary] = useState({ income: 0, expense: 0 })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Modais
  const [showForm, setShowForm] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showBalanceModal, setShowBalanceModal] = useState(false)

  // Estados - Editar Conta
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLORS[0])
  const [displayBalance, setDisplayBalance] = useState('')
  const [balanceNum, setBalanceNum] = useState(0)

  // Estados - Ajuste de Saldo (Balança)
  const [adjustBalanceDisplay, setAdjustBalanceDisplay] = useState('')

  // Estados - Transferência
  const [destAccountId, setDestAccountId] = useState('')
  const [transferAmountDisplay, setTransferAmountDisplay] = useState('')
  const [transferDate, setTransferDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [transferDesc, setTransferDesc] = useState('')

  const monthLabel = format(currentDate, 'MMMM \'De\' yyyy', { locale: ptBR })

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)

    try {
      const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
      const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

      // Busca a conta atual
      const { data: accData } = await supabase.from('accounts').select('*').eq('id', id).single()
      if (accData) setAccount(accData)

      // Busca todas as contas para o select de transferência (excluindo a atual)
      if (accData) {
        const { data: allAccs } = await supabase.from('accounts').select('*').eq('context', accData.context)
        setAllAccounts((allAccs || []).filter(a => a.id !== id))
      }

      // Busca as transações
      const { data: txsData } = await supabase
        .from('transactions')
        .select('*, categories(name, icon, color)')
        .eq('account_id', id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })

      const txs = txsData || []
      setTransactions(txs)

      // Calcula resumo
      const income = txs.filter(t => t.type === 'income' || (t.type === 'transfer' && t.description?.includes('de '))).reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const expense = txs.filter(t => t.type === 'expense' || t.type === 'sangria' || (t.type === 'transfer' && t.description?.includes('para '))).reduce((a, t) => a + (Number(t.amount) || 0), 0)
      
      setSummary({ income, expense })

    } catch (err) {
      console.error("Erro inesperado:", err)
    } finally {
      setLoading(false)
    }
  }, [id, currentDate])

  useEffect(() => { loadData() }, [loadData])

  // --- Handlers de Input de Moeda ---
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

  // --- Ações de Banco de Dados ---
  const handleSaveAccountInfo = async () => {
    if (!name.trim()) return
    setActionLoading(true)
    await supabase.from('accounts').update({ name: name.trim(), balance: balanceNum, color }).eq('id', id)
    setShowForm(false)
    loadData()
    setActionLoading(false)
  }

  const handleAdjustBalanceSubmit = async () => {
    setActionLoading(true)
    const rawAmount = parseFloat(adjustBalanceDisplay.replace(/\./g, '').replace(',', '.')) || 0;
    await supabase.from('accounts').update({ balance: rawAmount }).eq('id', id);
    setShowBalanceModal(false);
    loadData();
    setActionLoading(false)
  }

  const handleTransferSubmit = async () => {
    if (!destAccountId || !transferAmountDisplay) return alert("Preencha o destino e o valor.")
    setActionLoading(true)
    
    const rawAmount = parseFloat(transferAmountDisplay.replace(/\./g, '').replace(',', '.')) || 0;
    const destAcc = allAccounts.find(a => a.id === destAccountId);

    if (!destAcc) return;

    try {
      // 1. Atualiza saldos
      await supabase.from('accounts').update({ balance: Number(account.balance) - rawAmount }).eq('id', id);
      await supabase.from('accounts').update({ balance: Number(destAcc.balance) + rawAmount }).eq('id', destAccountId);

      // 2. Insere transação de saída (Origem)
      await supabase.from('transactions').insert({
        account_id: id,
        type: 'transfer',
        amount: rawAmount,
        description: transferDesc || `Transferência para ${destAcc.name}`,
        date: transferDate,
        status: 'done',
        context: account.context
      });

      // 3. Insere transação de entrada (Destino)
      await supabase.from('transactions').insert({
        account_id: destAccountId,
        type: 'transfer',
        amount: rawAmount,
        description: transferDesc || `Transferência de ${account.name}`,
        date: transferDate,
        status: 'done',
        context: account.context
      });

      setShowTransferModal(false);
      setTransferAmountDisplay('');
      setTransferDesc('');
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
    <div className="max-w-md mx-auto min-h-screen bg-[#f4f6f8] pb-20 font-sans relative">
      
      {/* Header com os 3 Botões */}
      <div className="flex justify-between items-center p-4 bg-white">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-700"><ChevronLeft size={24} /></button>
        <div className="flex items-center gap-4 text-gray-700">
          <button onClick={() => setShowTransferModal(true)} className="hover:text-teal-700 transition-colors"><ArrowRightLeft size={20} /></button>
          <button onClick={openBalanceModal} className="hover:text-teal-700 transition-colors"><Scale size={20} /></button>
          <button onClick={openEditModal} className="hover:text-teal-700 transition-colors"><Edit2 size={20} /></button>
        </div>
      </div>

      <div className="bg-white px-4 pb-6 flex flex-col items-center border-b border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="w-16 h-16 rounded-[20px] flex items-center justify-center text-xl font-bold text-white mb-3 shadow-md transition-colors" style={{ backgroundColor: account.color || '#f97316' }}>{initials}</div>
        <h1 className="text-xl font-light text-gray-600 mb-1">{account.name}</h1>
        <p className="text-[15px] text-gray-800 mb-6">Saldo atual: <span className="font-bold">{formatCurrency(safeBalance)}</span></p>

        <div className="flex items-center justify-between w-full max-w-[240px] bg-gray-100 rounded-full p-1 mb-6">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1.5 text-teal-700"><ChevronLeft size={18} /></button>
          <span className="text-[13px] font-medium text-teal-800 capitalize">{monthLabel}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1.5 text-teal-700"><ChevronRight size={18} /></button>
        </div>

        <div className="flex w-full justify-between px-6 pt-2">
          <div className="text-center">
            <p className="text-[11px] text-gray-500 font-bold tracking-wider uppercase mb-1">Entradas</p>
            <p className="text-[15px] font-bold text-emerald-600">{formatCurrency(summary.income)}</p>
          </div>
          <div className="w-[1px] bg-gray-200"></div>
          <div className="text-center">
            <p className="text-[11px] text-gray-500 font-bold tracking-wider uppercase mb-1">Saídas</p>
            <p className="text-[15px] font-bold text-red-500">{formatCurrency(summary.expense)}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-6">
        {transactions.length === 0 ? (
          <p className="text-center text-sm text-gray-400 mt-10">Nenhuma movimentação neste mês.</p>
        ) : (
          <div className="space-y-4">
            {transactions.map(tx => {
               // Define se a transferência foi de entrada ou saída visualmente
               const isTransferIn = tx.type === 'transfer' && tx.description?.includes('de ');
               const isIncomeVisual = tx.type === 'income' || isTransferIn;

               return (
                <div 
                  key={tx.id} 
                  onClick={() => router.push(`/transactions/${tx.id}`)}
                  className="flex justify-between items-center bg-white shadow-sm p-4 rounded-[20px] cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[14px] flex items-center justify-center text-lg" style={{ backgroundColor: `${tx.categories?.color || '#cbd5e1'}20` }}>
                      {tx.type === 'transfer' ? '🔄' : (tx.categories?.icon || '💸')}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-gray-800 uppercase tracking-tight truncate max-w-[140px]">{tx.description || tx.categories?.name}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[14px] font-bold ${isIncomeVisual ? 'text-emerald-600' : 'text-gray-800'}`}>
                      {isIncomeVisual ? '+' : '-'} {formatCurrency(Number(tx.amount) || 0)}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{tx.status === 'done' ? '✅ Pago' : '⏳ Pendente'}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: EDITAR CONTA (Lápis) */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-[24px] w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-6">
              <h2 className="font-bold text-xl text-gray-800">Editar Conta</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da Conta" className="w-full bg-gray-50 p-4 rounded-[16px] mb-4 font-bold text-gray-800 outline-none focus:ring-2 focus:ring-teal-500" />
            <div className="flex flex-wrap gap-3 mb-6 items-center">
              {DEFAULT_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} className={`w-10 h-10 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
            <button onClick={handleSaveAccountInfo} disabled={actionLoading} className="w-full bg-teal-700 hover:bg-teal-800 transition-colors text-white py-4 rounded-[16px] font-bold flex justify-center items-center">
              {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: BALANÇA (Ajuste de Saldo) */}
      {showBalanceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 pb-0 sm:pb-4" onClick={() => setShowBalanceModal(false)}>
          <div className="bg-white rounded-t-[32px] sm:rounded-[24px] w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-6">
              <div>
                <h2 className="font-bold text-xl text-gray-800">Ajustar Saldo</h2>
                <p className="text-[12px] text-gray-500 mt-1">Atualize o saldo real da conta no banco.</p>
              </div>
              <button onClick={() => setShowBalanceModal(false)} className="text-gray-400"><X size={20}/></button>
            </div>
            <div className="bg-gray-50 p-4 rounded-[20px] mb-6 flex items-center gap-2">
               <span className="text-xl text-gray-400 font-light">R$</span>
               <input type="text" inputMode="numeric" value={adjustBalanceDisplay} onChange={handleAdjustBalanceChange} className="w-full bg-transparent text-3xl font-light text-gray-800 outline-none" />
            </div>
            <button onClick={handleAdjustBalanceSubmit} disabled={actionLoading} className="w-full bg-gray-900 text-white py-4 rounded-[16px] font-bold flex justify-center items-center">
              {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Confirmar Novo Saldo'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: TRANSFERÊNCIA */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 pb-0 sm:pb-4" onClick={() => setShowTransferModal(false)}>
          <div className="bg-white rounded-t-[32px] sm:rounded-[24px] w-full max-w-sm p-6 shadow-2xl overflow-y-auto max-h-[90vh] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-6">
              <div>
                <h2 className="font-bold text-xl text-gray-800">Transferência</h2>
                <p className="text-[12px] text-gray-500 mt-1">Saindo de: <span className="font-bold text-gray-700">{account.name}</span></p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-gray-400"><X size={20}/></button>
            </div>

            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Conta de Destino</label>
            <select value={destAccountId} onChange={(e) => setDestAccountId(e.target.value)} className="w-full bg-gray-50 p-4 rounded-[16px] mb-4 text-[14px] font-bold text-gray-800 outline-none appearance-none">
              <option value="">Selecione o destino...</option>
              {allAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>

            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 mt-2">Valor da Transferência</label>
            <div className="bg-gray-50 p-4 rounded-[16px] mb-4 flex items-center gap-2">
               <span className="text-xl text-gray-400 font-light">R$</span>
               <input type="text" inputMode="numeric" value={transferAmountDisplay} onChange={handleTransferAmountChange} placeholder="0,00" className="w-full bg-transparent text-2xl font-light text-gray-800 outline-none" />
            </div>

            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 mt-2">Data</label>
            <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="w-full bg-gray-50 p-4 rounded-[16px] mb-4 text-[14px] font-bold text-gray-800 outline-none" />

            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 mt-2">Descrição (Opcional)</label>
            <input type="text" value={transferDesc} onChange={(e) => setTransferDesc(e.target.value)} placeholder="Ex: Pagamento do empréstimo" className="w-full bg-gray-50 p-4 rounded-[16px] mb-6 text-[14px] font-bold text-gray-800 outline-none" />

            <button onClick={handleTransferSubmit} disabled={actionLoading} className="w-full bg-teal-700 hover:bg-teal-800 text-white py-4 rounded-[16px] font-bold flex justify-center items-center">
              {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Efetuar Transferência'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
