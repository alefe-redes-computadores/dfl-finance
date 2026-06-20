'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, ChevronRight, ChevronLeft, ArrowDown, ArrowUp, CreditCard, SlidersHorizontal, Settings2 } from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

// Componente visual profissional de Iniciais
function BankInitials({ color, name }: { color: string, name: string }) {
  const initials = name ? name.substring(0, 2).toUpperCase() : '??';
  return (
    <div 
      className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm"
      style={{ backgroundColor: color || '#64748b' }}
    >
      {initials}
    </div>
  )
}

function HomeContent() {
  const { user } = useAuth()
  const { context } = useContext_()
  const [hideBalance, setHideBalance] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [pendings, setPendings] = useState({ toPay: 0, toReceive: 0 })
  const [accounts, setAccounts] = useState<any[]>([])
  const [recentExpenses, setRecentExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Estado do Modal de Cartões
  const [isCartaoModalOpen, setIsCartaoModalOpen] = useState(false)

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  const getBalanceStyle = (val: number) => {
    if (val > 0) return 'text-emerald-600 font-bold';
    if (val < 0) return 'text-red-500 font-bold';
    return 'text-gray-600 font-bold';
  }

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('user_id', user.id)
      .eq('context', context)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })

    const txs = transactions || []

    const income = txs.filter(t => t.type === 'income' && t.status === 'done').reduce((a, t) => a + Number(t.amount), 0)
    const expense = txs.filter(t => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((a, t) => a + Number(t.amount), 0)
    
    const toPay = txs.filter(t => (t.type === 'expense' || t.type === 'sangria') && t.status === 'pending').reduce((a, t) => a + Number(t.amount), 0)
    const toReceive = txs.filter(t => t.type === 'income' && t.status === 'pending').reduce((a, t) => a + Number(t.amount), 0)

    setSummary({ income, expense, balance: income - expense })
    setPendings({ toPay, toReceive })
    setRecentExpenses(txs.filter(t => (t.type === 'expense' || t.type === 'sangria')).slice(0, 4))

    const { data: accs } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
      .order('name') 

    setAccounts(accs ?? [])
    setLoading(false)
  }, [user, context, currentDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatCurrency = (val: number) => `R$ ${val.toFixed(2).replace('.', ',')}`
  const totalAccountsBalance = accounts.reduce((acc, curr) => acc + Number(curr.balance), 0)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] pb-28 font-sans relative">
      
      {/* Modal de Cartões - "Em Breve" */}
      {isCartaoModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" 
          onClick={() => setIsCartaoModalOpen(false)}
        >
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard size={32} className="text-gray-400" />
            </div>
            <h3 className="font-bold text-xl mb-2 text-gray-800">Cartões de Crédito</h3>
            <p className="text-gray-500 mb-6 text-sm">O gerenciamento de limites e faturas está no forno e sairá em breve!</p>
            <button onClick={() => setIsCartaoModalOpen(false)} className="w-full bg-emerald-900 text-white py-3 rounded-xl font-bold">
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* Header e Saldo Total */}
      <div className="pt-6 px-4 bg-white rounded-b-[32px] pb-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] mb-6">
        
        <div className="flex justify-between items-center mb-6">
          <ContextToggle />
        </div>

        <div className="flex justify-between items-center mb-6 px-4">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 text-gray-400 hover:text-gray-600">
            <ChevronLeft size={20} />
          </button>
          <span className="text-[15px] font-semibold text-gray-800 capitalize tracking-wide">{monthLabel}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 text-gray-400 hover:text-gray-600">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="text-center mb-6 relative">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Saldo total</span>
            <button onClick={() => setHideBalance(!hideBalance)} className="text-gray-400 p-1">
              {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <h1 className={`text-3xl font-light text-gray-800 ${hideBalance ? 'tracking-widest mt-2' : ''}`}>
            {hideBalance ? '••••••' : formatCurrency(totalAccountsBalance)}
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-3 px-2">
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col items-center justify-center">
             <div className="flex items-center gap-1.5 mb-1.5">
               <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center">
                 <ArrowUp size={12} className="text-emerald-500" />
               </div>
               <span className="text-[11px] text-gray-500 font-medium">Receitas</span>
             </div>
             <p className="text-[15px] font-bold text-emerald-600">
               {hideBalance ? '••••' : formatCurrency(summary.income)}
             </p>
          </div>
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col items-center justify-center">
             <div className="flex items-center gap-1.5 mb-1.5">
               <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center">
                 <ArrowDown size={12} className="text-red-400" />
               </div>
               <span className="text-[11px] text-gray-500 font-medium">Despesas</span>
             </div>
             <p className="text-[15px] font-bold text-red-500">
               {hideBalance ? '••••' : formatCurrency(summary.expense)}
             </p>
          </div>
        </div>
      </div>

      {/* Pendências */}
      <div className="px-4 mb-8">
        <h3 className="text-[15px] font-bold text-gray-800 mb-4 px-1">Pendências</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 text-center">
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Pagar</p>
            <p className="text-[13px] font-bold text-red-500">{hideBalance ? '•••' : formatCurrency(pendings.toPay)}</p>
          </div>
          
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 text-center">
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Receber</p>
            <p className="text-[13px] font-bold text-emerald-600">{hideBalance ? '•••' : formatCurrency(pendings.toReceive)}</p>
          </div>

          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 text-center opacity-60">
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Faturas</p>
            <p className="text-[13px] font-bold text-orange-400">{hideBalance ? '•••' : 'R$ 0,00'}</p>
          </div>
        </div>
      </div>

      {/* Contas */}
      <div className="px-4 mb-8">
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-[15px] font-bold text-gray-800">Contas</h3>
        </div>
        
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          {accounts.length === 0 ? (
             <div className="p-6 text-center text-gray-400 text-sm">Nenhuma conta cadastrada.</div>
          ) : (
            accounts.map((acc, index) => {
              const currentBalance = Number(acc.balance)
              
              return (
                <div key={acc.id} className={`flex justify-between items-center p-4 ${index !== accounts.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <BankInitials color={acc.color} name={acc.name} />
                    <div>
                      <p className="text-[14px] font-medium text-gray-800">{acc.name}</p>
                      <p className="text-[11px] text-gray-400">Conta</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[14px] ${getBalanceStyle(currentBalance)}`}>
                      {hideBalance ? '••••' : formatCurrency(currentBalance)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Seção de Cartões - Esqueleto visual */}
      <div className="px-4 mb-8">
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-[15px] font-bold text-gray-800">Cartões</h3>
        </div>
        <div 
          onClick={() => setIsCartaoModalOpen(true)}
          className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-4 opacity-60">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <CreditCard size={24} className="text-gray-400" />
            </div>
            <div>
              <div className="h-3 w-20 bg-gray-200 rounded mb-2"></div>
              <div className="h-2 w-32 bg-gray-100 rounded"></div>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-300" />
        </div>
      </div>

      {/* Últimas Transações */}
      <div className="px-4 mb-10">
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-[15px] font-bold text-gray-800">Últimas transações</h3>
        </div>
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          {recentExpenses.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">Nenhuma transação recente neste mês.</div>
          ) : (
            recentExpenses.map((tx, index) => (
              <div key={tx.id} className={`flex items-center justify-between p-4 ${index !== recentExpenses.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${tx.categories?.color || '#cbd5e1'}20` }}
                  >
                    {tx.categories?.icon || '💸'}
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-gray-800">{tx.description || tx.categories?.name}</p>
                    <p className="text-[11px] text-gray-400">
                      {format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })} • {tx.categories?.name || 'Geral'}
                    </p>
                  </div>
                </div>
                <p className="text-[14px] font-bold text-red-500">
                  {hideBalance ? '••••' : formatCurrency(Number(tx.amount))}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Botão Flutuante/Inferior de Reordenar */}
      <div className="px-4 flex justify-center mb-8">
        <button className="flex items-center gap-2 text-[13px] font-bold text-gray-400 hover:text-gray-600 bg-gray-200/50 hover:bg-gray-200 px-5 py-2.5 rounded-full transition-colors">
          <Settings2 size={16} /> Reordenar painel
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
