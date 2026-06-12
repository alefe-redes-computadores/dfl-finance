'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

function HomeContent() {
  const { user } = useAuth()
  const { context } = useContext_()
  const [hideBalance, setHideBalance] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })
  const monthLabel2 = format(currentDate, 'yyyy-MM')

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user, context, currentDate])

  async function loadData() {
    setLoading(true)
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user!.uid)
      .eq('context', context)
      .gte('date', `${monthLabel2}-01`)
      .lte('date', `${monthLabel2}-31`)

    const income = transactions?.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0) ?? 0
    const expense = transactions?.filter(t => t.type === 'expense' || t.type === 'sangria').reduce((a, t) => a + Number(t.amount), 0) ?? 0
    setSummary({ income, expense, balance: income - expense })

    const { data: accs } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user!.uid)
      .eq('context', context)

    setAccounts(accs ?? [])
    setLoading(false)
  }

  const bankLogos: Record<string, string> = {
    inter: 'https://logo.clearbit.com/inter.co',
    stone: 'https://logo.clearbit.com/stone.com.br',
    nubank: 'https://logo.clearbit.com/nubank.com.br',
    itau: 'https://logo.clearbit.com/itau.com.br',
    bradesco: 'https://logo.clearbit.com/bradesco.com.br',
    infinitpay: 'https://logo.clearbit.com/infinitpay.io',
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
          <span className="text-white font-black text-xs tracking-wider">DFL</span>
        </div>
        <ContextToggle />
        <button className="w-10 h-10" />
      </div>

      {/* Navegação mês */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-gray-800 dark:text-white capitalize">{monthLabel}</span>
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>

      {/* Saldo total */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 mb-3 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">Saldo total</span>
          <button onClick={() => setHideBalance(!hideBalance)}>
            {hideBalance
              ? <EyeOff size={16} className="text-gray-400" />
              : <Eye size={16} className="text-gray-400" />
            }
          </button>
        </div>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">
          {hideBalance ? '••••••' : `R$ ${summary.balance.toFixed(2).replace('.', ',')}`}
        </p>
      </div>

      {/* Receitas / Despesas */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-xs">↑</span>
            </div>
            <span className="text-xs text-gray-500">Receitas</span>
          </div>
          <p className="text-lg font-bold text-green-600">
            {hideBalance ? '••••' : `R$ ${summary.income.toFixed(2).replace('.', ',')}`}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <span className="text-red-600 text-xs">↓</span>
            </div>
            <span className="text-xs text-gray-500">Despesas</span>
          </div>
          <p className="text-lg font-bold text-red-600">
            {hideBalance ? '••••' : `R$ ${summary.expense.toFixed(2).replace('.', ',')}`}
          </p>
        </div>
      </div>

      {/* Contas */}
      {accounts.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm mb-3">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm text-gray-800 dark:text-white">Contas</span>
          </div>
          <div className="space-y-3">
            {accounts.map(acc => (
              <div key={acc.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {acc.bank_slug && bankLogos[acc.bank_slug] ? (
                    <img
                      src={bankLogos[acc.bank_slug]}
                      alt={acc.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gray-200 dark:bg-zinc-700 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-500">{acc.name[0]}</span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">{acc.name}</p>
                    <p className="text-xs text-gray-400">Saldo atual</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                  {hideBalance ? '••••' : `R$ ${Number(acc.balance).toFixed(2).replace('.', ',')}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

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
