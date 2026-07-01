'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Plus, Loader2,
  Repeat, Calendar, Pause, Play, RefreshCw,
  AlertTriangle, Clock, CheckCircle2
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'

// ============================================================
// SKELETON LOADER
// ============================================================
const SubscriptionsSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {/* Card Total Mensal */}
    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700" />
          <div className="space-y-2">
            <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-6 w-28 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
        </div>
        <div className="text-right space-y-2">
          <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded ml-auto" />
          <div className="h-6 w-10 bg-gray-100 dark:bg-slate-700/50 rounded ml-auto" />
        </div>
      </div>
    </div>

    {/* Cards de Assinatura */}
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-slate-700" />
            <div className="space-y-2">
              <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
            </div>
          </div>
          <div className="text-right space-y-2">
            <div className="h-4 w-16 bg-gray-200 dark:bg-slate-700 rounded ml-auto" />
            <div className="h-3 w-12 bg-gray-100 dark:bg-slate-700/50 rounded ml-auto" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 h-9 bg-gray-200 dark:bg-slate-700 rounded-full" />
          <div className="flex-1 h-9 bg-gray-100 dark:bg-slate-700/50 rounded-full" />
          <div className="w-20 h-9 bg-gray-200 dark:bg-slate-700 rounded-full" />
        </div>
      </div>
    ))}
  </div>
)

function SubscriptionsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { context } = useContext_()
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [totalMonthly, setTotalMonthly] = useState(0)

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
      loadSubscriptions().finally(() => setRefreshing(false))
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

  const loadSubscriptions = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    const { data } = await supabase
      .from('subscriptions')
      .select('*, categories(name, icon, color), accounts(name)')
      .match({ user_id: user.id, context: context })
      .order('due_day', { ascending: true })

    const subs = Array.isArray(data) ? data : []
    setSubscriptions(subs)

    const total = subs
      .filter(s => s.status === 'active')
      .reduce((a, s) => a + (Number(s.amount) || 0), 0)
    setTotalMonthly(total)

    setLoading(false)
  }, [user, context])

  useEffect(() => { loadSubscriptions() }, [loadSubscriptions])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleToggleStatus = async (sub: any) => {
    const newStatus = sub.status === 'active' ? 'paused' : 'active'
    await supabase.from('subscriptions').update({ status: newStatus }).eq('id', sub.id)
    loadSubscriptions()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta assinatura?')) return
    await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('id', id)
    loadSubscriptions()
  }

  const handleGenerate = async (sub: any) => {
    if (!user?.id) return

    const today = new Date()
    const dueDate = new Date(today.getFullYear(), today.getMonth(), sub.due_day)
    
    if (sub.last_generated) {
      const lastGen = new Date(sub.last_generated + 'T12:00:00')
      if (lastGen.getMonth() === today.getMonth() && lastGen.getFullYear() === today.getFullYear()) {
        alert('Esta assinatura já foi gerada este mês.')
        return
      }
    }

    const dateStr = format(dueDate, 'yyyy-MM-dd')
    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'expense',
      amount: sub.amount,
      description: `${sub.name} (Assinatura)`,
      category_id: sub.category_id,
      account_id: sub.account_id,
      date: dateStr,
      status: 'pending',
      context: sub.context
    })

    await supabase.from('subscriptions').update({ last_generated: format(today, 'yyyy-MM-dd') }).eq('id', sub.id)

    loadSubscriptions()
    alert(`Transação gerada para "${sub.name}"!`)
  }

  const daysUntil = (dueDay: number) => {
    const today = new Date()
    const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay)
    const diff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const getUrgencyInfo = (days: number) => {
    if (days < 0) return { color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', icon: <AlertTriangle size={10} />, label: 'Venceu!' }
    if (days === 0) return { color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', icon: <Clock size={10} />, label: 'Vence hoje' }
    if (days <= 3) return { color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', icon: <Clock size={10} />, label: `em ${days} dia(s)` }
    if (days <= 7) return { color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', icon: <Calendar size={10} />, label: `em ${days} dia(s)` }
    return { color: 'text-gray-400 dark:text-gray-500', bg: 'bg-transparent', icon: <Calendar size={10} />, label: `em ${days} dia(s)` }
  }

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      
      {/* Pull to refresh */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <ContextToggle />
        <button
          onClick={() => router.push('/subscriptions/new')}
          className="w-9 h-9 bg-teal-700 dark:bg-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-700/20 active:scale-90 transition-transform"
        >
          <Plus size={20} className="text-white" />
        </button>
      </div>

      <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 mb-4 px-1">Assinaturas</h2>

      {loading ? (
        <SubscriptionsSkeleton />
      ) : subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Repeat size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Nenhuma assinatura</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[250px]">
            Cadastre suas contas fixas mensais e receba alertas antes do vencimento.
          </p>
          <button
            onClick={() => router.push('/subscriptions/new')}
            className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors"
          >
            Criar assinatura
          </button>
        </div>
      ) : (
        <div className="animate-in fade-in duration-300">
          {/* Card Total Mensal */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                  <Repeat size={20} className="text-teal-700 dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase">Total mensal</p>
                  <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{formatCurrency(totalMonthly)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase">Ativas</p>
                <p className="text-xl font-bold text-teal-700 dark:text-teal-400">
                  {subscriptions.filter(s => s.status === 'active').length}
                </p>
              </div>
            </div>
          </div>

          {/* Lista de Assinaturas */}
          <div className="space-y-3">
            {subscriptions.map(sub => {
              const IconComp = getDynamicIcon(sub.icon || 'repeat')
              const isPaused = sub.status === 'paused'
              const isCancelled = sub.status === 'cancelled'
              const isActive = sub.status === 'active'
              const days = daysUntil(sub.due_day)
              const urgency = getUrgencyInfo(days)

              return (
                <div
                  key={sub.id}
                  className={`bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border transition-all active:scale-[0.98] ${
                    isCancelled ? 'opacity-50 border-gray-50 dark:border-slate-700' :
                    isPaused ? 'border-amber-200 dark:border-amber-800' :
                    days < 0 ? 'border-red-200 dark:border-red-800' :
                    days <= 3 ? 'border-orange-200 dark:border-orange-800' :
                    'border-gray-50 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isCancelled ? 'opacity-50' : ''
                      }`} style={{ backgroundColor: `${sub.color}20`, color: sub.color }}>
                        <IconComp size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">{sub.name}</p>
                        <div className="flex items-center gap-1.5">
                          {isPaused && <Pause size={12} className="text-amber-500" />}
                          {isCancelled && <CheckCircle2 size={12} className="text-gray-400" />}
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">
                            {sub.categories?.name || 'Geral'} • Vence dia {sub.due_day}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-[14px] ${isCancelled ? 'text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                        {formatCurrency(Number(sub.amount))}
                      </p>
                      {!isCancelled && !isPaused && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${urgency.color} ${urgency.bg} px-2 py-0.5 rounded-full mt-0.5`}>
                          {urgency.icon}
                          {urgency.label}
                        </span>
                      )}
                      {isPaused && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full mt-0.5">
                          <Pause size={10} />
                          Pausada
                        </span>
                      )}
                      {isCancelled && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full mt-0.5">
                          <CheckCircle2 size={10} />
                          Cancelada
                        </span>
                      )}
                    </div>
                  </div>

                  {!isCancelled && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGenerate(sub)}
                        className="flex-1 bg-teal-700 text-white py-2 rounded-full text-xs font-bold hover:bg-teal-800 transition-colors active:scale-95"
                      >
                        Gerar agora
                      </button>
                      <button
                        onClick={() => handleToggleStatus(sub)}
                        className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors active:scale-95 flex items-center justify-center gap-1 ${
                          isPaused 
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        {isPaused ? <Play size={12} /> : <Pause size={12} />}
                        {isPaused ? 'Reativar' : 'Pausar'}
                      </button>
                      <button
                        onClick={() => handleDelete(sub.id)}
                        className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors active:scale-95"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SubscriptionsPage() {
  return (
    <ContextProvider>
      <SubscriptionsContent />
    </ContextProvider>
  )
}