'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Plus, Loader2,
  Repeat, Calendar, Pause, Play
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'

function SubscriptionsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { context } = useContext_()
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [totalMonthly, setTotalMonthly] = useState(0)

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

    // Total mensal (apenas ativas)
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

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      
      <div className="flex items-center justify-between mb-6">
        <ContextToggle />
        <button
          onClick={() => router.push('/subscriptions/new')}
          className="w-9 h-9 bg-teal-700 dark:bg-teal-600 rounded-full flex items-center justify-center"
        >
          <Plus size={20} className="text-white" />
        </button>
      </div>

      <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 mb-4 px-1">Assinaturas</h2>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-teal-700" size={32} /></div>
      ) : subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Repeat size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Nenhuma assinatura</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[250px]">
            Cadastre suas contas fixas mensais e receba alertas antes do vencimento.
          </p>
          <button
            onClick={() => router.push('/subscriptions/new')}
            className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm"
          >
            Criar assinatura
          </button>
        </div>
      ) : (
        <>
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
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase">Assinaturas</p>
                <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{subscriptions.filter(s => s.status === 'active').length}</p>
              </div>
            </div>
          </div>

          {/* Lista de Assinaturas */}
          <div className="space-y-3">
            {subscriptions.map(sub => {
              const IconComp = getDynamicIcon(sub.icon || 'repeat')
              const isPaused = sub.status === 'paused'
              const isCancelled = sub.status === 'cancelled'
              const days = daysUntil(sub.due_day)
              const urgencyColor = days <= 3 ? 'text-red-500' : days <= 7 ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'

              return (
                <div
                  key={sub.id}
                  className={`bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 ${isCancelled ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${sub.color}20`, color: sub.color }}>
                        <IconComp size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">{sub.name}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                          {sub.categories?.name || 'Geral'} • Vence dia {sub.due_day}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">{formatCurrency(Number(sub.amount))}</p>
                      {!isCancelled && !isPaused && (
                        <p className={`text-[10px] font-bold ${urgencyColor}`}>
                          {days < 0 ? 'Venceu!' : days === 0 ? 'Vence hoje' : `em ${days} dia(s)`}
                        </p>
                      )}
                      {isPaused && <p className="text-[10px] font-bold text-orange-500">Pausada</p>}
                      {isCancelled && <p className="text-[10px] font-bold text-red-500">Cancelada</p>}
                    </div>
                  </div>

                  {!isCancelled && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGenerate(sub)}
                        className="flex-1 bg-teal-700 text-white py-2 rounded-full text-xs font-bold"
                      >
                        Gerar agora
                      </button>
                      <button
                        onClick={() => handleToggleStatus(sub)}
                        className={`flex-1 py-2 rounded-full text-xs font-bold ${isPaused ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400'}`}
                      >
                        {isPaused ? 'Reativar' : 'Pausar'}
                      </button>
                      <button
                        onClick={() => handleDelete(sub.id)}
                        className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full text-xs font-bold"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
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