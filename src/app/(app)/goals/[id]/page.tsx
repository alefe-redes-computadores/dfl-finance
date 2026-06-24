'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Edit2, Loader2, Check, Trash2, Plus, X, Wallet, Calendar,
  Home, Utensils, Car, HeartPulse, GraduationCap, Gamepad2, Shirt,
  Smile, Repeat, Wrench, Dog, FileText, Shield, Gift, MoreHorizontal,
  Briefcase, Laptop, TrendingUp, ShoppingCart, ReceiptIcon, Zap, Music,
  Target, PiggyBank, TrendingUp as TrendingUpIcon
} from 'lucide-react'
import { format, differenceInMonths, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

const ICON_MAP: Record<string, React.ElementType> = {
  home: Home, utensils: Utensils, car: Car, heart: HeartPulse,
  graduation: GraduationCap, gamepad: Gamepad2, shirt: Shirt,
  smile: Smile, repeat: Repeat, wrench: Wrench, dog: Dog,
  file: FileText, shield: Shield, gift: Gift, briefcase: Briefcase,
  laptop: Laptop, trending: TrendingUpIcon, shopping: ShoppingCart,
  receipt: ReceiptIcon, zap: Zap, music: Music, other: MoreHorizontal,
  target: Target, piggybank: PiggyBank
}

export default function GoalDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()

  const [goal, setGoal] = useState<any>(null)
  const [deposits, setDeposits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  // Depósito
  const [depAmount, setDepAmount] = useState('0,00')
  const [depAmountNum, setDepAmountNum] = useState(0)
  const [depNote, setDepNote] = useState('')
  const [depAccountId, setDepAccountId] = useState('')
  const [depTransfer, setDepTransfer] = useState(false) // false = já está na conta, true = somar ao saldo

  const [showAccModal, setShowAccModal] = useState(false)

  const loadData = useCallback(async () => {
    if (!id || !user?.id) return
    setLoading(true)

    // Carrega a meta
    const { data: goalData } = await supabase
      .from('goals')
      .select('*')
      .match({ id: id, user_id: user.id })
      .single()

    if (goalData) setGoal(goalData)

    // Carrega depósitos
    const { data: depData } = await supabase
      .from('goal_deposits')
      .select('*')
      .eq('goal_id', id)
      .order('date', { ascending: false })

    setDeposits(Array.isArray(depData) ? depData : [])

    // Carrega contas para o modal de depósito
    const { data: accData } = await supabase
      .from('accounts')
      .select('id, name, color, balance')
      .match({ user_id: user.id, context: goalData?.context || 'dfl' })

    setAccounts(Array.isArray(accData) ? accData : [])

    // Sincroniza current_amount
    if (goalData) {
      const totalDeposited = (depData || []).reduce((a, d) => a + (Number(d.amount) || 0), 0)
      if (totalDeposited !== Number(goalData.current_amount)) {
        await supabase.from('goals').update({ current_amount: totalDeposited }).eq('id', id)
        setGoal({ ...goalData, current_amount: totalDeposited })
      }
    }

    setLoading(false)
  }, [id, user])

  useEffect(() => { loadData() }, [loadData])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleDeleteGoal = async () => {
    if (!confirm('Tem certeza que deseja excluir esta meta?')) return
    await supabase.from('goals').delete().eq('id', id)
    router.push('/goals')
  }

  const handleCompleteGoal = async () => {
    if (!confirm('Marcar esta meta como concluída?')) return
    await supabase.from('goals').update({ status: 'completed' }).eq('id', id)
    router.push('/goals')
  }

  const handleDepAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setDepAmount('0,00')
      setDepAmountNum(0)
      return
    }
    const num = parseFloat(digits) / 100
    setDepAmountNum(num)
    setDepAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
  }

  const handleDeposit = async () => {
    if (!user?.id || depAmountNum <= 0) return
    setSaving(true)

    try {
      // Insere o depósito
      const { error: depError } = await supabase.from('goal_deposits').insert({
        goal_id: id,
        amount: depAmountNum,
        date: format(new Date(), 'yyyy-MM-dd'),
        note: depNote || null,
        account_origin_id: depAccountId || null
      })

      if (depError) throw depError

      // Se for transferência real (somar ao saldo)
      if (depTransfer && depAccountId) {
        const acc = accounts.find(a => a.id === depAccountId)
        if (acc && goal?.account_id) {
          // Subtrai da conta de origem
          await supabase
            .from('accounts')
            .update({ balance: Number(acc.balance) - depAmountNum })
            .eq('id', depAccountId)

          // Se a meta tem conta vinculada, soma nela
          const { data: goalAcc } = await supabase
            .from('accounts')
            .select('balance')
            .eq('id', goal.account_id)
            .single()

          if (goalAcc) {
            await supabase
              .from('accounts')
              .update({ balance: Number(goalAcc.balance) + depAmountNum })
              .eq('id', goal.account_id)
          }
        }
      }

      // Atualiza current_amount da meta
      const totalDeposited = deposits.reduce((a, d) => a + (Number(d.amount) || 0), 0) + depAmountNum
      await supabase.from('goals').update({ current_amount: totalDeposited }).eq('id', id)

      setShowDepositModal(false)
      setDepAmount('0,00')
      setDepAmountNum(0)
      setDepNote('')
      setDepAccountId('')
      setDepTransfer(false)
      loadData()
    } catch (err: any) {
      alert('Erro ao registrar depósito: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteDeposit = async (depositId: string, amount: number) => {
    if (!confirm('Excluir este depósito?')) return
    await supabase.from('goal_deposits').delete().eq('id', depositId)

    // Recalcula o total
    const totalDeposited = deposits
      .filter(d => d.id !== depositId)
      .reduce((a, d) => a + (Number(d.amount) || 0), 0)
    await supabase.from('goals').update({ current_amount: totalDeposited }).eq('id', id)

    loadData()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
      <Loader2 className="animate-spin text-teal-700" size={40} />
    </div>
  )

  if (!goal) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
      <p className="text-gray-500 dark:text-gray-400">Meta não encontrada.</p>
    </div>
  )

  const IconComp = ICON_MAP[goal.icon] || ICON_MAP['target']
  const percent = Number(goal.target_amount) > 0 ? ((Number(goal.current_amount) || 0) / Number(goal.target_amount)) * 100 : 0
  const remaining = Number(goal.target_amount) - (Number(goal.current_amount) || 0)
  const isCompleted = goal.status === 'completed'

  // Previsão: média dos últimos 3 depósitos
  const last3Deposits = deposits.slice(0, 3)
  const avgDeposit = last3Deposits.length > 0
    ? last3Deposits.reduce((a, d) => a + (Number(d.amount) || 0), 0) / last3Deposits.length
    : 0
  const monthsLeft = avgDeposit > 0 ? Math.ceil(remaining / avgDeposit) : null

  const donutData = [
    { name: 'Concluído', value: Number(goal.current_amount) || 0 },
    { name: 'Restante', value: Math.max(remaining, 0) }
  ]

  const selectedAcc = accounts.find(a => a.id === depAccountId)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-32 font-sans px-4 pt-6 transition-colors duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/goals')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{goal.name}</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(`/goals/new?edit=${goal.id}`)} className="p-2 text-teal-700 dark:text-teal-400">
            <Edit2 size={20} />
          </button>
          <button onClick={handleDeleteGoal} className="p-2 text-red-500">
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Gráfico Donut */}
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-4">
        <div className="h-48 relative flex items-center justify-center">
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Concluído</p>
            <p className="text-[20px] font-bold text-gray-800 dark:text-gray-100">{percent.toFixed(1)}%</p>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={85}
                paddingAngle={2}
                stroke="none"
              >
                <Cell fill={goal.color} />
                <Cell fill="#e5e7eb" className="dark:opacity-20" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cards informativos */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Falta</p>
          <p className="text-[15px] font-bold text-gray-800 dark:text-gray-200">{formatCurrency(Math.max(remaining, 0))}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Previsão</p>
          <p className="text-[15px] font-bold text-gray-800 dark:text-gray-200">
            {monthsLeft !== null ? `${monthsLeft} mês(es)` : '—'}
          </p>
        </div>
      </div>

      {/* Botão Marcar como atingida */}
      {!isCompleted && (
        <button
          onClick={handleCompleteGoal}
          className="w-full bg-teal-700 text-white py-3 rounded-full font-bold text-sm mb-6"
        >
          Marcar como atingida
        </button>
      )}

      {/* Histórico de Depósitos */}
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Histórico de Depósitos</h3>
        {deposits.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-4">Nenhum depósito registrado.</p>
        ) : (
          <div className="space-y-2">
            {deposits.map(dep => (
              <div key={dep.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-emerald-600">+ {formatCurrency(Number(dep.amount) || 0)}</p>
                    {dep.note && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">— {dep.note}</p>}
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    {format(new Date(dep.date + 'T12:00:00'), "dd 'de' MMM yyyy", { locale: ptBR })}
                  </p>
                </div>
                <button onClick={() => handleDeleteDeposit(dep.id, Number(dep.amount))} className="p-2 text-red-400 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botão fixo Depositar */}
      <div className="fixed bottom-6 left-0 w-full flex justify-center z-40 pointer-events-none">
        <button
          onClick={() => setShowDepositModal(true)}
          className="pointer-events-auto bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 shadow-xl"
        >
          <Plus size={18} /> Depositar
        </button>
      </div>

      {/* Modal Depósito */}
      {showDepositModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowDepositModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Novo Depósito</h3>
              <button onClick={() => setShowDepositModal(false)} className="text-gray-400 dark:text-gray-500 p-2"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              {/* Valor */}
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Valor</label>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                  <span className="text-gray-400 dark:text-gray-500 font-bold">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={depAmount}
                    onChange={handleDepAmountChange}
                    className="bg-transparent text-lg font-bold text-gray-800 dark:text-gray-200 outline-none w-full"
                  />
                </div>
              </div>

              {/* Observação */}
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Observação (opcional)</label>
                <input
                  type="text"
                  value={depNote}
                  onChange={e => setDepNote(e.target.value)}
                  placeholder="Ex: Depósito do mês"
                  className="w-full bg-gray-50 dark:bg-slate-700 rounded-xl p-3 text-sm outline-none text-gray-800 dark:text-gray-200"
                />
              </div>

              {/* Conta de origem */}
              <button
                onClick={() => setShowAccModal(true)}
                className="w-full flex items-center justify-between bg-gray-50 dark:bg-slate-700 rounded-xl p-3"
              >
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-gray-400 dark:text-gray-500" />
                  <span className={`text-sm ${selectedAcc ? 'text-gray-800 dark:text-gray-200 font-bold' : 'text-gray-400 dark:text-gray-500'}`}>
                    {selectedAcc ? selectedAcc.name : 'Conta de origem (opcional)'}
                  </span>
                </div>
                <ChevronLeft size={16} className="text-gray-300 dark:text-gray-600 rotate-180" />
              </button>

              {/* Toggle Somar ao saldo */}
              <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Somar ao saldo da conta</span>
                <button
                  onClick={() => setDepTransfer(!depTransfer)}
                  className={`w-11 h-6 rounded-full relative transition-colors ${depTransfer ? 'bg-teal-700' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${depTransfer ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              <button
                onClick={handleDeposit}
                disabled={saving || depAmountNum <= 0}
                className="w-full bg-teal-700 text-white py-4 rounded-xl font-bold disabled:opacity-50"
              >
                {saving ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Confirmar Depósito'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Contas */}
      {showAccModal && (
        <div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/50" onClick={() => setShowAccModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Conta de origem</h3>
              <button onClick={() => setShowAccModal(false)} className="text-gray-400 dark:text-gray-500 p-2"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { setDepAccountId(''); setShowAccModal(false) }}
                className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${!depAccountId ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-200 dark:bg-slate-700 text-gray-400">
                  <Wallet size={20} />
                </div>
                <span className={`flex-1 text-left font-medium ${!depAccountId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>Nenhuma conta</span>
                {!depAccountId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
              </button>
              {accounts.map(acc => {
                const isActive = acc.id === depAccountId
                return (
                  <button
                    key={acc.id}
                    onClick={() => { setDepAccountId(acc.id); setShowAccModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: acc.color || '#14b8a6' }}>{acc.name.substring(0, 2).toUpperCase()}</div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{acc.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  )
                  }
