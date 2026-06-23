'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, ChevronRight, ChevronLeft, ArrowDown, ArrowUp, Settings2, Loader2, Plus } from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

function BankInitials({ color, name }: { color: string, name: string }) {
  const initials = name ? name.substring(0, 2).toUpperCase() : '??';
  return (
    <div 
      className="w-10 h-10 rounded-[14px] flex items-center justify-center text-xs font-bold text-white shadow-sm"
      style={{ backgroundColor: color || '#64748b' }}
    >
      {initials}
    </div>
  )
}

function HomeContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { context } = useContext_()
  const [hideBalance, setHideBalance] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [pendings, setPendings] = useState({ toPay: 0, toReceive: 0, faturas: 0 })
  const [accounts, setAccounts] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [recentExpenses, setRecentExpenses] = useState<any[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  const getBalanceStyle = (val: number) => {
    if (val > 0) return 'text-emerald-600 font-bold';
    if (val < 0) return 'text-red-500 font-bold';
    return 'text-gray-800 font-bold';
  }

  const loadData = useCallback(async () => {
    setDataLoading(true)
    
    try {
      const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
      const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

      // Busca Transações do Mês
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*, categories(name, icon, color)')
        .eq('context', context)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })

      const txs = transactions || []

      // Cálculos Gerais
      const income = txs.filter(t => t.type === 'income' && t.status === 'done').reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const expense = txs.filter(t => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((a, t) => a + (Number(t.amount) || 0), 0)
      
      // Contas a pagar normais (ISOLAMOS os cartões de crédito aqui usando !t.credit_card_id)
      const toPay = txs.filter(t => (t.type === 'expense' || t.type === 'sangria') && t.status === 'pending' && !t.credit_card_id).reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const toReceive = txs.filter(t => t.type === 'income' && t.status === 'pending').reduce((a, t) => a + (Number(t.amount) || 0), 0)

      setSummary({ income, expense, balance: income - expense })
      setRecentExpenses(txs.filter(t => (t.type === 'expense' || t.type === 'sangria')).slice(0, 5))

      // Busca Contas
      const { data: accsData } = await supabase.from('accounts').select('*').eq('context', context).order('name') 
      const accsWithPrevisto = (accsData || []).map(acc => {
        const accTxs = txs.filter(t => t.account_id === acc.id && t.status === 'pending');
        const pendingIncome = accTxs.filter(t => t.type === 'income').reduce((a, t) => a + (Number(t.amount) || 0), 0);
        const pendingExpense = accTxs.filter(t => (t.type === 'expense' || t.type === 'sangria')).reduce((a, t) => a + (Number(t.amount) || 0), 0);
        const previsto = (Number(acc.balance) || 0) + pendingIncome - pendingExpense;
        return { ...acc, previsto };
      });
      setAccounts(accsWithPrevisto)

      // Busca Cartões e Calcula a Fatura
      const { data: creditCards } = await supabase.from('credit_cards').select('*').eq('context', context).eq('is_archived', false).order('created_at', { ascending: false })
      
      const cardsWithInvoice = (creditCards || []).map(card => {
        // Soma as despesas vinculadas a este cartão no mês
        const cardTxs = txs.filter(t => t.credit_card_id === card.id);
        const faturaAtual = cardTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
        return { ...card, faturaAtual };
      });

      const totalFaturas = cardsWithInvoice.reduce((acc, c) => acc + c.faturaAtual, 0);
      
      setCards(cardsWithInvoice)
      setPendings({ toPay, toReceive, faturas: totalFaturas }) // Atualiza o state com o total das faturas
      
    } catch (err) {
      console.error("Erro na Home:", err)
    } finally {
      setDataLoading(false)
    }
  }, [context, currentDate])

  useEffect(() => { loadData() }, [loadData])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const totalAccountsBalance = accounts.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0)
  const totalPrevistoBalance = accounts.reduce((acc, curr) => acc + (curr.previsto || 0), 0)
  const somaFaturasGeral = pendings.faturas

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-teal-700 bg-[#f4f6f8]">
        <Loader2 className="animate-spin" size={40} />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f4f6f8] pb-28 font-sans relative px-4 pt-4">
      
      <div className="flex justify-between items-center mb-6">
        <ContextToggle />
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 text-gray-400 hover:text-gray-600">
            <ChevronLeft size={20} />
          </button>
          <span className="text-[15px] font-bold text-gray-800 capitalize tracking-wide">{monthLabel}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 text-gray-400 hover:text-gray-600">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] mb-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Saldo total</span>
          <button onClick={() => setHideBalance(!hideBalance)} className="text-gray-400 p-1">
            {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <h1 className={`text-[32px] font-light text-gray-800 ${hideBalance ? 'tracking-widest' : ''}`}>
          {hideBalance ? '••••••' : formatCurrency(totalAccountsBalance)}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div onClick={() => router.push('/transactions?filter=income')} className="bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] rounded-[20px] p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ArrowUp size={14} className="text-emerald-500" />
              <span className="text-[12px] text-gray-500 font-bold">Receitas</span>
            </div>
            <p className="text-[15px] font-bold text-emerald-600">
              {hideBalance ? '••••' : formatCurrency(summary.income)}
            </p>
        </div>
        <div onClick={() => router.push('/transactions?filter=expense')} className="bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] rounded-[20px] p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ArrowDown size={14} className="text-red-400" />
              <span className="text-[12px] text-gray-500 font-bold">Despesas</span>
            </div>
            <p className="text-[15px] font-bold text-red-500">
              {hideBalance ? '••••' : formatCurrency(summary.expense)}
            </p>
        </div>
      </div>

      {/* PENDÊNCIAS COM A FATURA DINÂMICA */}
      <div className="mb-8">
        <h3 className="text-[15px] font-bold text-gray-800 mb-3 px-1">Pendências</h3>
        <div className="grid grid-cols-3 gap-3">
          <div onClick={() => router.push('/transactions?filter=expense')} className="bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] rounded-[16px] p-3 text-center cursor-pointer hover:bg-gray-50">
            <div className="flex justify-center mb-1"><ArrowDown size={14} className="text-red-400 opacity-50" /></div>
            <p className="text-[11px] text-gray-400 font-bold mb-0.5">Pagar</p>
            <p className="text-[13px] font-bold text-red-500">{hideBalance ? '•••' : formatCurrency(pendings.toPay)}</p>
          </div>
          <div onClick={() => router.push('/transactions?filter=income')} className="bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] rounded-[16px] p-3 text-center cursor-pointer hover:bg-gray-50">
            <div className="flex justify-center mb-1"><ArrowUp size={14} className="text-emerald-500 opacity-50" /></div>
            <p className="text-[11px] text-gray-400 font-bold mb-0.5">Receber</p>
            <p className="text-[13px] font-bold text-emerald-600">{hideBalance ? '•••' : formatCurrency(pendings.toReceive)}</p>
          </div>
          <div onClick={() => router.push('/cards')} className="bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] rounded-[16px] p-3 text-center cursor-pointer hover:bg-gray-50">
            <div className="flex justify-center mb-1"><div className="w-3.5 h-3.5 border-2 border-orange-300 rounded-[4px] opacity-50" /></div>
            <p className="text-[11px] text-gray-400 font-bold mb-0.5">Faturas</p>
            <p className="text-[13px] font-bold text-orange-400">{hideBalance ? '•••' : formatCurrency(pendings.faturas)}</p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-center mb-3 px-1 cursor-pointer" onClick={() => router.push('/accounts')}>
          <h3 className="text-[15px] font-bold text-gray-800">Contas</h3>
          <ChevronRight size={18} className="text-gray-400" />
        </div>
        <div className="bg-white rounded-[24px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden p-2">
          {accounts.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">Nenhuma conta.</div>
          ) : (
            accounts.map((acc) => (
              <div 
                key={acc.id} 
                onClick={() => router.push(`/accounts/${acc.id}`)} 
                className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-50 rounded-[16px] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <BankInitials color={acc.color} name={acc.name} />
                  <div>
                    <p className="text-[14px] font-bold text-gray-800">{acc.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Previsto</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-[14px] ${getBalanceStyle(Number(acc.balance) || 0)}`}>
                    {hideBalance ? '••••' : formatCurrency(Number(acc.balance) || 0)}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${(acc.previsto || 0) >= 0 ? 'text-gray-400' : 'text-red-400'}`}>
                    {hideBalance ? '••••' : formatCurrency(acc.previsto || 0)}
                  </p>
                </div>
              </div>
            ))
          )}
          {accounts.length > 0 && (
            <div className="flex justify-between items-center p-3 mt-1 border-t border-gray-50">
              <div>
                <p className="text-[14px] font-bold text-gray-800">Total</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Previsto</p>
              </div>
              <div className="text-right">
                <p className="text-[14px] font-bold text-gray-800">
                  {hideBalance ? '••••' : formatCurrency(totalAccountsBalance)}
                </p>
                <p className={`text-[11px] mt-0.5 ${totalPrevistoBalance >= 0 ? 'text-gray-400' : 'text-red-400'}`}>
                  {hideBalance ? '••••' : formatCurrency(totalPrevistoBalance)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CARTÕES COM A FATURA DINÂMICA */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3 px-1">
          <h3 className="text-[15px] font-bold text-gray-800 cursor-pointer" onClick={() => router.push('/cards')}>Cartões</h3>
          <button onClick={() => router.push('/cards/new')} className="p-1 text-teal-700 hover:bg-teal-50 rounded-full transition-colors">
            <Plus size={20} />
          </button>
        </div>
        
        <div className="bg-white rounded-[24px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden p-2">
          {cards.length === 0 ? (
            <div className="p-2">
              <button 
                onClick={() => router.push('/cards/new')} 
                className="w-full p-4 text-center text-teal-700 bg-teal-50/50 hover:bg-teal-50 rounded-[16px] font-bold text-[14px] transition-colors border border-teal-100/50"
              >
                Cadastrar primeiro cartão
              </button>
            </div>
          ) : (
            cards.map((card) => (
              <div 
                key={card.id} 
                onClick={() => router.push(`/cards/${card.id}`)} 
                className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-50 rounded-[16px] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[14px] flex items-center justify-center text-white font-bold text-xs shadow-sm" style={{ backgroundColor: card.color }}>
                    {card.name.substring(0, 2).toUpperCase()}
                  </div>
                  <p className="text-[14px] font-bold text-gray-800">{card.name}</p>
                </div>
                <div className="text-right flex items-center gap-1">
                   {/* Se tiver fatura > 0, exibe o valor em laranja. Senão, fica verde com OK */}
                   {card.faturaAtual > 0 ? (
                     <p className="text-[14px] font-bold text-orange-500">{hideBalance ? '•••' : formatCurrency(card.faturaAtual)}</p>
                   ) : (
                     <p className="text-[14px] font-bold text-gray-800">R$ 0,00 <span className="text-emerald-500 ml-1">✓</span></p>
                   )}
                </div>
              </div>
            ))
          )}
          {cards.length > 0 && (
            <div className="flex justify-between items-center p-3 mt-1 border-t border-gray-50">
              <div>
                <p className="text-[14px] font-bold text-gray-800">Total Faturas</p>
              </div>
              <p className="text-[14px] font-bold text-gray-800">{hideBalance ? '••••' : formatCurrency(somaFaturasGeral)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mb-10">
        <div className="flex justify-between items-center mb-3 px-1 cursor-pointer" onClick={() => router.push('/transactions')}>
          <h3 className="text-[15px] font-bold text-gray-800">Despesas recentes</h3>
          <ChevronRight size={18} className="text-gray-400" />
        </div>
        <div className="bg-white rounded-[24px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden p-2">
          {recentExpenses.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">Nenhuma transação recente.</div>
          ) : (
            recentExpenses.map((tx) => (
              <div 
                key={tx.id} 
                onClick={() => router.push(`/transactions/${tx.id}`)}
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 rounded-[16px] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-[14px] flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${tx.categories?.color || '#cbd5e1'}20` }}
                  >
                    {tx.categories?.icon || '💸'}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-gray-800 uppercase tracking-tight">{tx.description || tx.categories?.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })} • {tx.categories?.name || 'Geral'}
                    </p>
                  </div>
                </div>
                <p className="text-[14px] font-bold text-red-500">
                  {hideBalance ? '••••' : formatCurrency(Number(tx.amount) || 0)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex justify-center mb-4">
        <button className="flex items-center gap-2 text-[12px] font-bold text-gray-500 hover:text-gray-700 transition-colors">
          <Settings2 size={14} /> Gerenciar tela inicial
        </button>
      </div>

    </div>
  )
}

export default function HomePage() {
  return (
    <ContextProvider>
      <HomeContent />
    </ContextProvider>
  )
}
