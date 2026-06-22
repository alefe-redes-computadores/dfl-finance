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

  // Estados do Modal de Edição
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLORS[0])
  const [displayBalance, setDisplayBalance] = useState('')
  const [balanceNum, setBalanceNum] = useState(0)

  const monthLabel = format(currentDate, 'MMMM \'De\' yyyy', { locale: ptBR })

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const { data: accData } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single()
    
    if (accData) setAccount(accData)

    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    const { data: txsData } = await supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('account_id', id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })

    const txs = txsData || []
    setTransactions(txs)

    const income = txs.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
    const expense = txs.filter(t => t.type === 'expense' || t.type === 'sangria').reduce((a, t) => a + Number(t.amount), 0)
    
    setSummary({ income, expense })
    setLoading(false)
  }, [id, currentDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Lógica de Máscara e Salvamento do Modal
  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    const num = Number(rawValue) / 100
    setBalanceNum(num)
    setDisplayBalance(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setLoading(true)
    const { error } = await supabase
      .from('accounts')
      .update({ name: name.trim(), balance: balanceNum, color })
      .eq('id', id)
    
    if (!error) {
      setShowForm(false)
      loadData() // Recarrega os dados da tela para mostrar a cor/nome novos
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin text-teal-600" size={40} />
    </div>
  )

  if (!account) return <div className="p-6 text-center">Conta não encontrada.</div>

  const initials = account.name ? account.name.substring(0, 2).toUpperCase() : '??'

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20 font-sans relative">
      
      {/* Top Bar */}
      <div className="flex justify-between items-center p-4 bg-white">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-700">
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-4 text-gray-700">
          <button><ArrowRightLeft size={20} /></button>
          <button><Scale size={20} /></button>
          <button onClick={openEditModal}><Edit2 size={20} /></button>
        </div>
      </div>

      {/* Header da Conta */}
      <div className="bg-white px-4 pb-6 flex flex-col items-center border-b border-gray-100 shadow-sm">
        <div 
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white mb-3 shadow-md transition-colors"
          style={{ backgroundColor: account.color || '#f97316' }}
        >
          {initials}
        </div>
        <h1 className="text-xl font-light text-gray-600 mb-1">{account.name}</h1>
        <p className="text-[15px] text-gray-800 mb-6">
          Saldo atual: <span className="font-bold">{formatCurrency(Number(account.balance))}</span>
        </p>

        {/* Seletor de Mês */}
        <div className="flex items-center justify-between w-full max-w-[240px] bg-gray-100 rounded-full p-1 mb-6">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1.5 text-teal-700"><ChevronLeft size={18} /></button>
          <span className="text-[13px] font-medium text-teal-800 capitalize">{monthLabel}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1.5 text-teal-700"><ChevronRight size={18} /></button>
        </div>

        {/* Resumo de Entradas e Saídas */}
        <div className="flex w-full justify-between px-6 pt-2">
          <div className="text-center">
            <p className="text-[11px] text-gray-500 font-medium mb-1">Entradas do mês</p>
            <p className="text-[15px] font-bold text-emerald-600">{formatCurrency(summary.income)}</p>
          </div>
          <div className="w-[1px] bg-gray-200"></div>
          <div className="text-center">
            <p className="text-[11px] text-gray-500 font-medium mb-1">Saídas do mês</p>
            <p className="text-[15px] font-bold text-red-500">{formatCurrency(summary.expense)}</p>
          </div>
        </div>
      </div>

      {/* Lista de Transações */}
      <div className="px-4 pt-6">
        {transactions.length === 0 ? (
          <p className="text-center text-sm text-gray-400 mt-10">Nenhuma movimentação neste mês.</p>
        ) : (
          <div className="space-y-4">
            {transactions.map(tx => (
              <div key={tx.id} className="flex justify-between items-center cursor-pointer hover:bg-gray-100/50 p-2 -mx-2 rounded-xl transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.status === 'done' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                    {tx.status === 'done' ? '✓' : '◷'}
                  </div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: `${tx.categories?.color || '#cbd5e1'}20` }}>
                    {tx.categories?.icon || '💸'}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-gray-800 uppercase tracking-tight">{tx.description || tx.categories?.name}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{tx.categories?.name || 'Geral'} · {account.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 mb-0.5">{format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })}</p>
                  <p className={`text-[14px] font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-gray-800'}`}>
                    {formatCurrency(Number(tx.amount))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Edição (Abre ao clicar no Lápis) */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h2 className="font-bold text-xl text-gray-800">Editar Conta</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Nome da Conta" 
              className="w-full bg-gray-50 p-4 rounded-2xl mb-4 font-bold text-gray-800 outline-none focus:ring-2 focus:ring-teal-500" 
            />
            
            <div className="flex flex-wrap gap-3 mb-6 items-center">
                {DEFAULT_COLORS.map(c => (
                <button 
                  key={c} 
                  onClick={() => setColor(c)} 
                  className={`w-10 h-10 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'}`} 
                  style={{ backgroundColor: c }} 
                />
              ))}

              <label className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                <Plus size={18} className="text-gray-400" />
                <input type="color" className="hidden" onChange={(e) => setColor(e.target.value)} />
              </label>
            </div>

            <input 
              type="text" 
              inputMode="numeric"
              value={displayBalance} 
              onChange={handleBalanceChange} 
              placeholder="R$ 0,00" 
              className="w-full bg-gray-50 p-4 rounded-2xl mb-6 font-bold text-lg text-gray-800 outline-none focus:ring-2 focus:ring-teal-500" 
            />
            
            <button 
              onClick={handleSave} 
              className="w-full bg-teal-700 hover:bg-teal-800 transition-colors text-white py-4 rounded-2xl font-bold flex justify-center items-center"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
