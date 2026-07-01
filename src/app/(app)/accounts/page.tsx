'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Wallet, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import BankLogo from '@/components/BankLogo'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'

// ============================================================
// SKELETON LOADER
// ============================================================
const AccountsSkeleton = () => (
  <div className="space-y-2 animate-pulse">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-slate-700" />
          <div className="space-y-2">
            <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
        </div>
        <div className="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
      </div>
    ))}
  </div>
)

export default function AccountsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Pull to refresh
  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY > 10 || loading) return
    pullStartY.current = e.touches[0].clientY
    isPulling.current = true
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const pullDistance = e.touches[0].clientY - pullStartY.current
    if (pullDistance > 60) {
      setRefreshing(true)
      isPulling.current = false
      loadAccounts().finally(() => setRefreshing(false))
    }
  }

  const handleTouchEnd = () => {
    isPulling.current = false
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [loading, refreshing])

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

  const getBalanceColor = (val: number) => {
    if (val > 0) return 'text-emerald-600 dark:text-emerald-400'
    if (val < 0) return 'text-red-600 dark:text-red-400'
    return 'text-gray-400 dark:text-gray-500'
  }

  const getBalanceIcon = (val: number) => {
    if (val > 0) return <TrendingUp size={14} className="text-emerald-500 shrink-0" />
    if (val < 0) return <TrendingDown size={14} className="text-red-500 shrink-0" />
    return <Minus size={14} className="text-gray-400 shrink-0" />
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0)

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      {/* Pull to refresh indicator */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

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

        {/* Card de saldo total */}
        {!loading && accounts.length > 0 && (
          <div className="mt-4 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950 dark:to-emerald-950 rounded-2xl p-4 border border-teal-100 dark:border-teal-900 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Saldo Total</p>
              <p className={`text-xl font-bold ${getBalanceColor(totalBalance)}`}>
                {formatCurrency(totalBalance)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center">
              <Wallet size={20} className="text-teal-600 dark:text-teal-400" />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <AccountsSkeleton />
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
            {accounts.map(acc => {
              const balance = Number(acc.balance) || 0
              const isZero = balance === 0
              return (
                <div key={acc.id} onClick={() => router.push(`/accounts/${acc.id}`)}
                  className={`bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all flex items-center justify-between ${
                    isZero ? 'opacity-70 hover:opacity-100' : ''
                  }`}>
                  <div className="flex items-center gap-4">
                    <BankLogo color={acc.color} name={acc.name} size="md" />
                    <div>
                      <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{acc.name}</p>
                      <div className="flex items-center gap-1.5">
                        {getBalanceIcon(balance)}
                        <p className={`text-[11px] font-medium ${getBalanceColor(balance)}`}>
                          {isZero ? 'Saldo zerado' : balance > 0 ? 'Saldo positivo' : 'Saldo negativo'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className={`font-bold text-sm ${getBalanceColor(balance)}`}>
                    {formatCurrency(balance)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}