'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import * as Icons from 'lucide-react'
import { ChevronLeft, Check, Loader2, X, Wallet, Calendar } from 'lucide-react'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import IconPicker from '@/components/IconPicker' // Importando o novo seletor!

const COLORS = ['#14b8a6', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#eab308', '#64748b', '#000000']

function NewGoalContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { context } = useContext_()
  const editId = searchParams.get('edit')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])

  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('0,00')
  const [targetAmountNum, setTargetAmountNum] = useState(0)
  const [deadline, setDeadline] = useState('')
  const [accountId, setAccountId] = useState('')
  const [color, setColor] = useState('#14b8a6')
  const [icon, setIcon] = useState('Target') // Agora usando PascalCase para bater com o lucide-react

  const [showAccModal, setShowAccModal] = useState(false)
  const [showIconModal, setShowIconModal] = useState(false)

  const loadAccounts = async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('accounts')
      .select('id, name, color')
      .match({ user_id: user.id, context: context })
    setAccounts(Array.isArray(data) ? data : [])
  }

  const loadGoal = async () => {
    if (!editId || !user?.id) return
    setLoading(true)
    const { data } = await supabase.from('goals').select('*').match({ id: editId, user_id: user.id }).single()
    if (data) {
      setName(data.name)
      setTargetAmountNum(Number(data.target_amount))
      setTargetAmount(Number(data.target_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
      setDeadline(data.deadline || '')
      setAccountId(data.account_id || '')
      setColor(data.color)
      // Ajuste para garantir que a primeira letra seja maiúscula caso venha do modelo antigo
      const iconName = data.icon.charAt(0).toUpperCase() + data.icon.slice(1)
      setIcon(iconName)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAccounts()
    if (editId) loadGoal()
  }, [user, context, editId])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setTargetAmount('0,00')
      setTargetAmountNum(0)
      return
    }
    const num = parseFloat(digits) / 100
    setTargetAmountNum(num)
    setTargetAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
  }

  const handleSave = async () => {
    if (!user?.id || !name.trim() || targetAmountNum <= 0) {
      alert('Preencha todos os campos obrigatórios.')
      return
    }
    setSaving(true)

    const payload = {
      user_id: user.id,
      context,
      name: name.trim(),
      target_amount: targetAmountNum,
      deadline: deadline || null,
      account_id: accountId || null,
      color,
      icon
    }

    try {
      if (editId) {
        await supabase.from('goals').update(payload).eq('id', editId)
      } else {
        await supabase.from('goals').insert(payload)
      }
      router.push('/goals')
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
      <Loader2 className="animate-spin text-teal-700" size={40} />
    </div>
  )

  const selectedAcc = accounts.find(a => a.id === accountId)
  
  // Renderização dinâmica do ícone selecionado
  const IconComp = (Icons as any)[icon] || Icons.Target

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{editId ? 'Editar Meta' : 'Nova Meta'}</h2>
        <button onClick={handleSave} disabled={saving} className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center">
          {saving ? <Loader2 size={20} className="text-white animate-spin" /> : <Check size={22} className="text-white" />}
        </button>
      </div>

      <div className="space-y-5">
        {/* Nome */}
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Nome da meta</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Viagem, Carro, Reserva..."
            className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500"
          />
        </div>

        {/* Valor alvo */}
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Valor alvo</label>
          <div className="flex items-center gap-2">
            <span className="text-xl text-gray-400 dark:text-gray-500 font-light">R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={targetAmount}
              onChange={handleAmountChange}
              placeholder="0,00"
              className="text-2xl font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>

        {/* Prazo */}
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Prazo (opcional)</label>
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-gray-400 dark:text-gray-500" />
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="bg-transparent text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none"
            />
          </div>
        </div>

        {/* Conta vinculada */}
        <button
          onClick={() => setShowAccModal(true)}
          className="w-full bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Wallet size={18} className="text-gray-400 dark:text-gray-500" />
            <div className="text-left">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider block">Conta vinculada</span>
              <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{selectedAcc ? selectedAcc.name : 'Nenhuma conta'}</span>
            </div>
          </div>
          <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180" />
        </button>

        {/* Cor */}
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-3 block">Cor</label>
          <div className="flex flex-wrap gap-3">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-9 h-9 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ring-gray-400' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Ícone */}
        <button
          onClick={() => setShowIconModal(true)}
          className="w-full bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20`, color: color }}>
              <IconComp size={18} />
            </div>
            <div className="text-left">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider block">Ícone</span>
              <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{icon}</span>
            </div>
          </div>
          <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180" />
        </button>
      </div>

      {/* Modal Contas */}
      {showAccModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowAccModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Contas</h3>
              <button onClick={() => setShowAccModal(false)} className="text-gray-400 dark:text-gray-500 p-2"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { setAccountId(''); setShowAccModal(false) }}
                className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${!accountId ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-200 dark:bg-slate-700 text-gray-400">
                  <Wallet size={20} />
                </div>
                <span className={`flex-1 text-left font-medium ${!accountId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>Nenhuma conta</span>
                {!accountId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
              </button>
              {accounts.map(acc => {
                const isActive = acc.id === accountId
                return (
                  <button
                    key={acc.id}
                    onClick={() => { setAccountId(acc.id); setShowAccModal(false) }}
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

      {/* Novo Componente de Seleção de Ícone */}
      <IconPicker
        isOpen={showIconModal}
        onClose={() => setShowIconModal(false)}
        selectedIcon={icon}
        onSelect={setIcon}
      />

    </div>
  )
}

export default function NewGoalPage() {
  return (
    <ContextProvider>
      <NewGoalContent />
    </ContextProvider>
  )
}
