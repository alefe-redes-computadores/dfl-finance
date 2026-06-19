'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, ChevronRight, ChevronLeft, ArrowDown, ArrowUp, CreditCard, Settings2, Plus } from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

// Componente de Iniciais (Visual Profissional)
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

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

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
    setRecentExpenses(txs.filter(t => t.type === 'expense').slice(0, 4))

    const { data: accs } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
      .order('name')

    setAccounts(accs ?? [])
    setLoading(false)
  }, [user, context, currentDate])

  useEffect(() => { loadData() }, [loadData])

  const formatCurrency = (val: number) => `R$ ${val.toFixed(2).replace('.', ',')}`
  const totalAccountsBalance = accounts.reduce((acc, curr) => acc + Number(curr.balance), 0)

  // Cor do saldo (Positivo: verde, Negativo: vermelho, Zerado: cinza)
  const getBalanceStyle = (val: number) => {
    if (val > 0) return 'text-emerald-600'
    if (val < 0) return 'text-red-500'
    return 'text-gray-600'
  }

  return (
    <div className="page-transition min-h-screen bg-slate-50 pb-28 font-sans">
      <div className="pt-6 px-4 bg-white rounded-b-[32px] pb-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] mb-6">
        <div className="flex justify-between items-center mb-6">
          <ContextToggle />
        </div>

        <div className="flex justify-between items-center mb-6 px-4">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 text-gray-400 hover:text-gray-600 transition-colors"><ChevronLeft size={20} /></button>
          <span className="text-[15px] font-semibold text-gray-800 capitalize tracking-wide">{monthLabel}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 text-gray-400 hover:text-gray-600 transition-colors"><ChevronRight size={20} /></button>
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
      </div>

      {/* LISTAGEM DE CONTAS */}
      <div className="px-4 mb-8">
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-[15px] font-bold text-gray-800">Contas</h3>
        </div>
        
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          {accounts.map((acc, index) => {
            const val = Number(acc.balance)
            return (
              <div key={acc.id} className={`flex justify-between items-center p-4 ${index !== accounts.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <BankInitials color={acc.color} name={acc.name} />
                  <p className="text-[14px] font-medium text-gray-800">{acc.name}</p>
                </div>
                <p className={`text-[14px] font-bold ${getBalanceStyle(val)}`}>
                   {hideBalance ? '••••' : formatCurrency(val)}
                </p>
              </div>
            )
          })}
          
          <div className="p-4 border-t border-gray-50 flex justify-center bg-gray-50/50 cursor-pointer hover:bg-gray-50 transition-colors">
             <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                <Plus size={16} />
             </div>
          </div>
        </div>
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
