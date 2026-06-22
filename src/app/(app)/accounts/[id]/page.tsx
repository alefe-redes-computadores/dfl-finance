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
  const [transactions, setTransactions] = useState<any[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [summary, setSummary] = useState({ income: 0, expense: 0 })
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showBalanceModal, setShowBalanceModal] = useState(false)

  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLORS[0])
  const [displayBalance, setDisplayBalance] = useState('')
  const [balanceNum, setBalanceNum] = useState(0)

  const monthLabel = format(currentDate, 'MMMM \'De\' yyyy', { locale: ptBR })

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)

    try {
      // Correção do NaN: Select '*' para trazer o balance
      const { data: accData, error: accError } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single()

      if (accError) {
        console.error("Erro na busca da conta:", accError)
      } else {
        setAccount(accData)
      }

      const { data: txsData, error: txsError } = await supabase
        .from('transactions')
        .select('*, categories(name, icon, color)')
        .eq('account_id', id)
        .order('date', { ascending: false })

      if (txsError) {
        console.error("Erro na busca de transações:", txsError)
      } else {
        const txs = txsData || []
        setTransactions(txs)
        
        // Calcula o resumo do mês atual
        const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
        const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')
        const currentMonthTxs = txs.filter(t => t.date >= start && t.date <= end && t.status === 'done')
        
        const income = currentMonthTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0)
        const expense = currentMonthTxs.filter(t => t.type === 'expense' || t.type === 'sangria').reduce((acc, t) => acc + Number(t.amount), 0)
        
        setSummary({ income, expense })
      }
    } catch (err) {
      console.error("Erro inesperado:", err)
    } finally {
      setLoading(false)
    }
  }, [id, currentDate])

  useEffect(() => { loadData() }, [loadData])

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    const num = Number(rawValue) / 100
    setBalanceNum(num)
    setDisplayBalance(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setLoading(true)
    const { error } = await supabase.from('accounts').update({ name: name.trim(), balance: balanceNum, color }).eq('id', id)
    if (!error) {
      setShowForm(false)
      loadData()
    } else {
      setLoading(false)
    }
  }

  const openEditModal = () => {
    if (!account) return
    setName(account.name)
    setColor(account.color)
    setBalanceNum(account.balance)
    setDisplayBalance(Number(account.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
    setShowForm(true)
  }

  const formatCurrency = (val: number) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (loading && !account) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
      <Loader2 className="animate-spin text-teal-700" size={40} />
    </div>
  )

  if (!account) return <div className="p-6 text-center text-gray-500">Conta não encontrada.</div>

  const initials = account.name ? account.name.substring(0, 2).toUpperCase() : '??'

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] pb-20 font-sans relative">
      
      <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800"><ChevronLeft size={24} /></button>
        <div className="flex items-center gap-4 text-teal-700">
          <button onClick={() => setShowTransferModal(true)}><ArrowRightLeft size={20} /></button>
          <button onClick={() => setShowBalanceModal(true)}><Scale size={20} /></button>
          <button onClick={openEditModal}><Edit2 size={20} /></button>
        </div>
      </div>

      <div className="bg-white px-4 pb-6 flex flex-col items-center border-b border-gray-100 shadow-sm">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white mb-3 shadow-md transition-colors mt-4" style={{ backgroundColor: account.color || '#f97316' }}>{initials}</div>
        <h1 className="text-xl font-bold text-gray-800 mb-1">{account.name}</h1>
        <p className="text-[15px] text-gray-500 mb-6">Saldo atual: <span className={`font-bold ${Number(account.balance) >= 0 ? 'text-teal-700' : 'text-red-500'}`}>{formatCurrency(Number(account.balance))}</span></p>

        <div className="flex items-center justify-between w-full max-w-[240px] bg-gray-100 rounded-full p-1 mb-6">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1.5 text-gray-500"><ChevronLeft size={18} /></button>
          <span className="text-[13px] font-bold text-gray-800 capitalize tracking-wide">{monthLabel}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1.5 text-gray-500"><ChevronRight size={18} /></button>
        </div>

        <div className="flex w-full justify-between px-6 pt-2">
          <div className="text-center">
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Entradas do mês</p>
            <p className="text-[15px] font-bold text-emerald-600">{formatCurrency(summary.income)}</p>
          </div>
          <div className="w-[1px] bg-gray-200"></div>
          <div className="text-center">
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Saídas do mês</p>
            <p className="text-[15px] font-bold text-red-500">{formatCurrency(summary.expense)}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-6">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 opacity-50">
             <p className="text-sm font-medium text-gray-500 mt-4">Nenhuma movimentação neste mês.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map(tx => (
              <div 
                key={tx.id} 
                onClick={() => router.push(`/transactions/${tx.id}`)}
                className="bg-white p-4 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-gray-50 shadow-sm border border-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm`} style={{ backgroundColor: `${tx.categories?.color || '#cbd5e1'}20` }}>
                    {tx.categories?.icon || '💸'}
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-gray-800 uppercase tracking-tight">{tx.description || tx.categories?.name}</p>
                    <p className="text-[11px] font-bold text-gray-400 mt-0.5">{tx.categories?.name || 'Geral'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-[14px] font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-gray-800'}`}>
                    {tx.type === 'income' ? '+' : '-'} {formatCurrency(Number(tx.amount))}
                  </p>
                  <p className="text-[11px] font-bold text-gray-400 mt-0.5">{format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-[24px] w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-xl text-gray-800">Editar Conta</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20}/></button>
            </div>
            
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Nome da Conta</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Nubank" className="w-full bg-gray-50 p-4 rounded-2xl mb-6 font-bold text-gray-800 outline-none focus:ring-2 focus:ring-teal-500 transition-all" />
            
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Cor</label>
            <div className="flex flex-wrap gap-3 mb-6 items-center">
              {DEFAULT_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} className={`w-10 h-10 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'}`} style={{ backgroundColor: c }} />
              ))}
              <label className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                <Plus size={18} className="text-gray-400" />
                <input type="color" className="hidden" onChange={(e) => setColor(e.target.value)} />
              </label>
            </div>

            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Saldo Atual (R$)</label>
            <input type="text" inputMode="numeric" value={displayBalance} onChange={handleBalanceChange} placeholder="0,00" className="w-full bg-gray-50 p-4 rounded-2xl mb-8 font-bold text-lg text-gray-800 outline-none focus:ring-2 focus:ring-teal-500 transition-all" />
            
            <button onClick={handleSave} className="w-full bg-teal-700 hover:bg-teal-800 transition-colors text-white py-4 rounded-2xl font-bold flex justify-center items-center">
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      )}

      {showTransferModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowTransferModal(false)}><div className="bg-white p-6 rounded-3xl font-bold text-gray-800">Transferência em breve</div></div>}
      {showBalanceModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowBalanceModal(false)}><div className="bg-white p-6 rounded-3xl font-bold text-gray-800">Ajuste de saldo em breve</div></div>}
    </div>
  )
}
