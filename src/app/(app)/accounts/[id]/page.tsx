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

  // Estados dos Modais
  const [showEditAccount, setShowEditAccount] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false) // Novo: Modal de Transferência
  const [showEditBalance, setShowEditBalance] = useState(false) // Novo: Modal de Saldo
  
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLORS[0])
  const [displayBalance, setDisplayBalance] = useState('')
  const [balanceNum, setBalanceNum] = useState(0)

  const monthLabel = format(currentDate, 'MMMM \'De\' yyyy', { locale: ptBR })

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const { data: accData } = await supabase.from('accounts').select('*').eq('id', id).single()
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

  useEffect(() => { loadData() }, [loadData])

  const formatCurrency = (val: number) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // --- Funções de Ação ---
  const handleEditAccount = () => {
    setName(account.name)
    setColor(account.color)
    setShowEditAccount(true)
  }

  // A lógica de "Transferir" e "Ajustar Saldo" será conectada na próxima etapa
  // aqui apenas abrimos os modais para manter a estrutura do seu projeto.

  if (loading && !account) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-teal-600" size={40} /></div>
  if (!account) return <div className="p-6 text-center">Conta não encontrada.</div>

  const initials = account.name ? account.name.substring(0, 2).toUpperCase() : '??'

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20 font-sans relative">
      
      {/* Header com 3 Botões */}
      <div className="flex justify-between items-center p-4 bg-white">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-700"><ChevronLeft size={24} /></button>
        <div className="flex items-center gap-4 text-gray-700">
          <button onClick={() => setShowTransfer(true)}><ArrowRightLeft size={20} /></button>
          <button onClick={() => setShowEditBalance(true)}><Scale size={20} /></button>
          <button onClick={handleEditAccount}><Edit2 size={20} /></button>
        </div>
      </div>

      {/* Card da Conta */}
      <div className="bg-white px-4 pb-6 flex flex-col items-center border-b border-gray-100 shadow-sm">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white mb-3 shadow-md" style={{ backgroundColor: account.color || '#f97316' }}>{initials}</div>
        <h1 className="text-xl font-light text-gray-600 mb-1">{account.name}</h1>
        <p className="text-[15px] text-gray-800 mb-6">Saldo: <span className="font-bold">{formatCurrency(Number(account.balance))}</span></p>
        
        {/* Seletor de Mês */}
        <div className="flex items-center justify-between w-full max-w-[240px] bg-gray-100 rounded-full p-1 mb-6">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1.5 text-teal-700"><ChevronLeft size={18} /></button>
          <span className="text-[13px] font-medium text-teal-800 capitalize">{monthLabel}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1.5 text-teal-700"><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* Lista de Transações */}
      <div className="px-4 pt-6 space-y-4">
        {transactions.map(tx => (
          <div key={tx.id} onClick={() => router.push(`/transactions/${tx.id}`)} className="flex justify-between items-center cursor-pointer hover:bg-gray-100/50 p-2 -mx-2 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: `${tx.categories?.color || '#cbd5e1'}20` }}>{tx.categories?.icon || '💸'}</div>
              <div>
                <p className="text-[13px] font-bold text-gray-800">{tx.description || tx.categories?.name}</p>
                <p className="text-[11px] text-gray-500">{tx.categories?.name || 'Geral'}</p>
              </div>
            </div>
            <p className={`text-[14px] font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-gray-800'}`}>
              {formatCurrency(Number(tx.amount))}
            </p>
          </div>
        ))}
      </div>

      {/* Modais (apenas estrutura aberta para evitar quebra) */}
      {showEditAccount && (/* ... seu código original do modal de editar conta ... */)}
      
      {showTransfer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <h2 className="font-bold text-lg mb-4">Transferência (Em breve)</h2>
            <button onClick={() => setShowTransfer(false)} className="w-full bg-teal-700 text-white py-3 rounded-xl font-bold">Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}
