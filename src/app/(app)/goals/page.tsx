'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, ChevronRight, Plus, Loader2, Target,
  Home, Utensils, Car, HeartPulse, GraduationCap, Gamepad2, Shirt,
  Smile, Repeat, Wrench, Dog, FileText, Shield, Gift, MoreHorizontal,
  Briefcase, Laptop, TrendingUp as TrendingUpIcon, ShoppingCart, ReceiptIcon, Zap, Music,
  PiggyBank, TrendingUp
} from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

const ICON_MAP: Record<string, React.ElementType> = {
  home: Home, utensils: Utensils, car: Car, heart: HeartPulse,
  graduation: GraduationCap, gamepad: Gamepad2, shirt: Shirt,
  smile: Smile, repeat: Repeat, wrench: Wrench, dog: Dog,
  file: FileText, shield: Shield, gift: Gift, briefcase: Briefcase,
  laptop: Laptop, trending: TrendingUpIcon, shopping: ShoppingCart,
  receipt: ReceiptIcon, zap: Zap, music: Music, other: MoreHorizontal,
  target: Target, piggybank: PiggyBank
}

function GoalsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { context } = useContext_()
  const [goals, setGoals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [totalSaved, setTotalSaved] = useState(0)
  const [overallProgress, setOverallProgress] = useState(0)

  const loadGoals = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    const { data: goalsData } = await supabase
      .from('goals')
      .select('*')
      .match({ user_id: user.id, context: context, status: 'active' })
      .order('created_at', { ascending: false })

    const goalsArray = Array.isArray(goalsData) ? goalsData : []

    // Calcula depósitos para cada meta
    const goalsWithProgress = await Promise.all(goalsArray.map(async (goal) => {
      const { data: deposits } = await supabase
        .from('goal_deposits')
        .select('amount')
        .eq('goal_id', goal.id)

      const currentAmount = (deposits || []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0)
      const percent = Number(goal.target_amount) > 0 ? (currentAmount / Number(goal.target_amount)) * 100 : 0

      // Atualiza o current_amount no banco
      await supabase.from('goals').update({ current_amount: currentAmount }).eq('id', goal.id)

      return { ...goal, current_amount: currentAmount, percent: Math.min(percent, 100) }
    }))

    setGoals(goalsWithProgress)

    // Totais
    const total = goalsWithProgress.reduce((a, g) => a + (g.current_amount || 0), 0)
    const totalTarget = goalsWithProgress.reduce((a, g) => a + Number(g.target_amount || 0), 0)
    setTotalSaved(total)
    setOverallProgress(totalTarget > 0 ? (total / totalTarget) * 100 : 0)

    setLoading(false)
  }, [user, context])

  useEffect(() => { loadGoals() }, [loadGoals])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      
      <div className="flex items-center justify-between mb-6">
        <ContextToggle />
        <button
          onClick={() => router.push('/goals/new')}
          className="w-9 h-9 bg-teal-700 dark:bg-teal-600 rounded-full flex items-center justify-center"
        >
          <Plus size={20} className="text-white" />
        </button>
      </div>

      <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 mb-4 px-1">Metas</h2>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-teal-700" size={32} /></div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Target size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Nenhuma meta definida</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[250px]">
            Crie metas financeiras para acompanhar seus objetivos e realizar seus sonhos.
          </p>
          <button
            onClick={() => router.push('/goals/new')}
            className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm"
          >
            Criar meta
          </button>
        </div>
      ) : (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
                <PiggyBank size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Total guardado</p>
              <p className="text-[15px] font-bold text-emerald-600">{formatCurrency(totalSaved)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
              <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mx-auto mb-2">
                <TrendingUp size={16} className="text-teal-700 dark:text-teal-400" />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Progresso geral</p>
              <p className="text-[15px] font-bold text-teal-700 dark:text-teal-400">{overallProgress.toFixed(1)}%</p>
            </div>
          </div>

          {/* Lista de Metas */}
          <div className="space-y-3">
            {goals.map(goal => {
              const IconComp = ICON_MAP[goal.icon] || ICON_MAP['target']
              return (
                <div
                  key={goal.id}
                  onClick={() => router.push(`/goals/${goal.id}`)}
                  className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${goal.color}20`, color: goal.color }}>
                        <IconComp size={18} />
                      </div>
                      <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">{goal.name}</span>
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500">{goal.percent.toFixed(0)}%</span>
                  </div>

                  <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(goal.percent, 100)}%`, backgroundColor: goal.color }}
                    />
                  </div>

                  <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                    {formatCurrency(goal.current_amount)} de {formatCurrency(Number(goal.target_amount))}
                  </p>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function GoalsPage() {
  return (
    <ContextProvider>
      <GoalsContent />
    </ContextProvider>
  )
}
