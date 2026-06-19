'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, ChevronRight, ArrowDown, ArrowUp, CalendarClock } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

function HomeContent() {
  const { user } = useAuth()
  const { context } = useContext_()
  const [hideBalance, setHideBalance] = useState(false)
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [accounts, setAccounts] = useState<any[]>([])
  const [recent, setRecent] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadData()
  }, [user, context])

  async function loadData() {
    setLoading(true)
    const monthLabel2 = format(new Date(), 'yyyy-MM')

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('user_id', user!.id)
      .eq('context', context)
      .gte('date', `${monthLabel2}-01`)
      .lte('date', `${monthLabel2}-31`)
      .order('date', { ascending: false })

    const income = transactions?.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0) ?? 0
    const expense = transactions?.filter(t => t.type === 'expense' || t.type === 'sangria').reduce((a, t) => a + Number(t.amount), 0) ?? 0
    
    setSummary({ income, expense, balance: income - expense })
    setRecent(transactions?.slice(0, 4) ?? [])

    const { data: accs } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user!.id)
      .eq('context', context)
      .order('name')

    setAccounts(accs ?? [])
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-28 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-6">
        <ContextToggle />
        <button onClick={() => setHideBalance(!hideBalance)} className="p-2 text-gray-500">
          {hideBalance ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>

      {/* Saldo e Cards de Pendências */}
      <div className="px-4 mb-6">
        <p className="text-xs text-gray-400 uppercase font-bold mb-1">Saldo Total</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          {hideBalance ? '••••••' : `R$ ${summary.balance.toFixed(2).replace('.', ',')}`}
        </h1>

        {/* Esqueleto de Pendências (Visual Referência) */}
        <div className="grid grid-cols-3 gap-2">
          {['Pagar', 'Receber', 'Faturas'].map((label) => (
            <div key={label} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 text-center">
              <p className="text-[10px] text-gray-400 font-bold uppercase">{label}</p>
              <p className="text-sm font-bold text-gray-800 mt-1">R$ 0,00</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contas (Limitado a 5) */}
      <div className="px-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-gray-900">Contas</h2>
          <ChevronRight size={18} className="text-gray-400" />
        </div>
        <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100">
          {accounts.slice(0, 5).map(acc => (
            <div key={acc.id} className="flex justify-between items-center p-3 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-700">{acc.name}</span>
              <span className="text-sm font-bold">{hideBalance ? '••••' : `R$ ${Number(acc.balance).toFixed(2).replace('.', ',')}`}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Despesas Recentes */}
      <div className="px-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-gray-900">Despesas recentes</h2>
          <ChevronRight size={18} className="text-gray-400" />
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          {recent.map(t => (
            <div key={t.id} className="flex items-center gap-3 p-4 border-b border-gray-50 last:border-0">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                {t.categories?.icon ?? '💸'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-800 truncate">{t.description || t.categories?.name}</p>
                <p className="text-[10px] text-gray-400">{format(new Date(t.date + 'T12:00:00'), "d 'de' MMM", { locale: ptBR })}</p>
              </div>
              <p className="text-sm font-bold text-red-600">- R$ {Number(t.amount).toFixed(2).replace('.', ',')}</p>
            </div>
          ))}
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
