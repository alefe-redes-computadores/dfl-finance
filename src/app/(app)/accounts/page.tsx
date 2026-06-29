'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Wallet } from 'lucide-react'
import BankLogo from '@/components/BankLogo'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'

export default function AccountsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    loadAccounts()
  }, [user?.id, context])

  const loadAccounts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
      .order('name')

    setAccounts(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/home')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Contas</h1>
          <button onClick={() => router.push('/accounts/new')} className="p-2 -mr-2 text-teal-700 dark:text-teal-400">
            <Plus size={24} />
          </button>
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton variant="card" height="72px" count={5} />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-16">
            <Wallet size={56} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Nenhuma conta</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Adicione contas para gerenciar seu dinheiro.</p>
            <button onClick={() => router.push('/accounts/new')}
              className="bg-teal-700 text-white px-6 py-3 rounded-2xl font-bold hover:bg-teal-800 transition-colors">
              Criar primeira conta
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map(acc => (
              <div key={acc.id} onClick={() => router.push(`/accounts/${acc.id}`)}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <BankLogo color={acc.color} name={acc.name} size="md" />
                  <div>
                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{acc.name}</p>
                    <p className="text-[11px] text-gray-400">Saldo disponível</p>
                  </div>
                </div>
                <p className={`font-bold text-sm ${Number(acc.balance) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(Number(acc.balance) || 0)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}