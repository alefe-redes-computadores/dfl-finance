'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Check, Loader2, X, Tag, Wallet,
  Calendar, Repeat
} from 'lucide-react'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import BankLogo from '@/components/BankLogo'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'

const ICON_NAMES = [
  'repeat', 'home', 'utensils', 'car', 'heart', 'graduation-cap', 'gamepad-2', 'shirt',
  'smile', 'wrench', 'dog', 'file-text', 'shield', 'gift', 'briefcase',
  'laptop', 'trending-up', 'shopping-cart', 'receipt', 'zap', 'music', 'more-horizontal',
  'target', 'piggy-bank'
]

const COLORS = ['#14b8a6', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#eab308', '#64748b', '#000000']

function NewSubscriptionContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { context } = useContext_()
  const { showToast } = useToast()
  const editId = searchParams.get('edit')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('0,00')
  const [amountNum, setAmountNum] = useState(0)
  const [dueDay, setDueDay] = useState('1')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [color, setColor] = useState('#14b8a6')
  const [icon, setIcon] = useState('repeat')

  const [showCatModal, setShowCatModal] = useState(false)
  const [showAccModal, setShowAccModal] = useState(false)

  // ============================================================
  // 🔥 BUSCAS LOCAIS (INDEXEDDB)
  // ============================================================
  const { data: localCategories, reload: reloadCategories } = useLocalData({
    table: 'categories',
    filters: { context, type: 'expense' },
    realtime: false,
  })

  const { data: localAccounts, reload: reloadAccounts } = useLocalData({
    table: 'accounts',
    filters: { context },
    realtime: false,
  })

  const { data: localSubscription, loading: subLoading, reload: reloadSubscription } = useLocalData({
    table: 'subscriptions',
    filters: { id: editId || '' },
    realtime: false,
  })

  // ============================================================
  // LOAD DATA
  // ============================================================
  useEffect(() => {
    if (localCategories) setCategories(localCategories)
    if (localAccounts) setAccounts(localAccounts)
  }, [localCategories, localAccounts])

  useEffect(() => {
    if (editId && localSubscription && localSubscription.length > 0) {
      const data = localSubscription[0]
      setName(data.name)
      setAmountNum(Number(data.amount))
      setAmount(Number(data.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
      setDueDay(String(data.due_day))
      setCategoryId(data.category_id || '')
      setAccountId(data.account_id || '')
      setColor(data.color)
      setIcon(data.icon)
      setLoading(false)
    } else if (!editId) {
      setLoading(false)
    }
  }, [editId, localSubscription])

  useEffect(() => {
    if (user?.id) {
      reloadCategories()
      reloadAccounts()
      if (editId) reloadSubscription()
    }
  }, [user?.id, editId])

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setAmount('0,00')
      setAmountNum(0)
      return
    }
    const num = parseFloat(digits) / 100
    setAmountNum(num)
    setAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
  }

  const handleSave = async () => {
    if (!user?.id || !name.trim() || amountNum <= 0) {
      showToast('Preencha todos os campos obrigatórios.', 'warning')
      return
    }
    setSaving(true)

    const payload = {
      user_id: user.id,
      context,
      name: name.trim(),
      amount: amountNum,
      due_day: parseInt(dueDay),
      category_id: categoryId || null,
      account_id: accountId || null,
      color,
      icon,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    try {
      const { create, update } = useLocalData({ table: 'subscriptions' })
      
      if (editId) {
        await update(editId, payload)
        showToast('Assinatura atualizada!', 'success')
      } else {
        await create(payload)
        showToast('Assinatura criada!', 'success')
      }
      router.push('/subscriptions')
    } catch (err: any) {
      showToast(`Erro ao salvar: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
      <Loader2 className="animate-spin text-teal-700" size={40} />
    </div>
  )

  const selectedCat = categories.find(c => c.id === categoryId)
  const selectedAcc = accounts.find(a => a.id === accountId)
  const days = Array.from({ length: 31 }, (_, i) => i + 1)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">

      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{editId ? 'Editar Assinatura' : 'Nova Assinatura'}</h2>
        <button onClick={handleSave} disabled={saving} className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center">
          {saving ? <Loader2 size={20} className="text-white animate-spin" /> : <Check size={22} className="text-white" />}
        </button>
      </div>

      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Nome</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Netflix, Aluguel, Spotify..."
            className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500"
          />
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Valor mensal</label>
          <div className="flex items-center gap-2">
            <span className="text-xl text-gray-400 dark:text-gray-500 font-light">R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0,00"
              className="text-2xl font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Dia do vencimento</label>
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-gray-400 dark:text-gray-500" />
            <select
              value={dueDay}
              onChange={e => setDueDay(e.target.value)}
              className="bg-transparent text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none appearance-none cursor-pointer pr-4"
            >
              {days.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <span className="text-[14px] text-gray-400 dark:text-gray-500">de cada mês</span>
          </div>
        </div>

        <button
          onClick={() => setShowCatModal(true)}
          className="w-full bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Tag size={18} className="text-gray-400 dark:text-gray-500" />
            <div className="text-left">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider block">Categoria</span>
              <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{selectedCat ? selectedCat.name : 'Geral'}</span>
            </div>
          </div>
          <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180" />
        </button>

        <button
          onClick={() => setShowAccModal(true)}
          className="w-full bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Wallet size={18} className="text-gray-400 dark:text-gray-500" />
            <div className="text-left">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider block">Conta</span>
              <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{selectedAcc ? selectedAcc.name : 'Nenhuma conta'}</span>
            </div>
          </div>
          <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180" />
        </button>

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

        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-3">Ícone</p>
          <div className="flex flex-wrap gap-3">
            {ICON_NAMES.map(iconName => {
              const Ico = getDynamicIcon(iconName)
              const isSelected = icon === iconName
              return (
                <button
                  key={iconName}
                  onClick={() => setIcon(iconName)}
                  className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all ${isSelected ? 'scale-110 shadow-md' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                  style={isSelected ? { backgroundColor: `${color}20`, color: color } : { backgroundColor: '#f9fafb', color: '#9ca3af' }}
                >
                  <Ico size={22} />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {showCatModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCatModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Categorias</h3>
              <button onClick={() => setShowCatModal(false)} className="text-gray-400 dark:text-gray-500 p-2"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { setCategoryId(''); setShowCatModal(false) }}
                className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${!categoryId ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-200 dark:bg-slate-700 text-gray-400"><Tag size={20} /></div>
                <span className={`flex-1 text-left font-medium ${!categoryId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>Geral</span>
                {!categoryId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
              </button>
              {categories.map((cat: any) => {
                const CatIconComp = getDynamicIcon(cat.icon)
                const isActive = cat.id === categoryId
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setCategoryId(cat.id); setShowCatModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                      <CatIconComp size={20} />
                    </div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{cat.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

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
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-200 dark:bg-slate-700 text-gray-400"><Wallet size={20} /></div>
                <span className={`flex-1 text-left font-medium ${!accountId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>Nenhuma conta</span>
                {!accountId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
              </button>
              {accounts.map((acc: any) => {
                const isActive = acc.id === accountId
                return (
                  <button
                    key={acc.id}
                    onClick={() => { setAccountId(acc.id); setShowAccModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    <BankLogo color={acc.color || '#14b8a6'} name={acc.name} size="md" />
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

export default function NewSubscriptionPage() {
  return (
    <ContextProvider>
      <NewSubscriptionContent />
    </ContextProvider>
  )
}