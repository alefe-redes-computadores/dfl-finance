'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { ChevronLeft, Check, Loader2, X, Wallet, Calendar, User, FileText, Tag } from 'lucide-react'
import { ContextProvider, useContext_ } from '@/components/ContextToggle'
import IconPicker from '@/components/IconPicker'
import { getDynamicIcon } from '@/lib/iconUtils'
import BankLogo from '@/components/BankLogo'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'
import { db } from '@/lib/db' 
import { useSafeDb } from '@/hooks/useSafeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import MoneyInput from '@/components/MoneyInput'

const COLORS = ['#14b8a6', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#eab308', '#64748b', '#000000']
const CONTEXTS: Array<'dfl' | 'personal'> = ['dfl', 'personal']

function NewDebtContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { context } = useContext_()
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { safeAdd, safeUpdate } = useSafeDb()
  const editId = searchParams.get('edit')

  const [loading, setLoading] = useState(!!editId)
  const [saving, setSaving] = useState(false)

  const [personName, setPersonName] = useState('')
  const [amountNum, setAmountNum] = useState(0)
  const [amountFormatted, setAmountFormatted] = useState('0,00')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [color, setColor] = useState('#14b8a6')
  const [icon, setIcon] = useState('User')
  const [debtContext, setDebtContext] = useState<'dfl' | 'personal'>('dfl')

  const [showCatModal, setShowCatModal] = useState(false)
  const [showAccModal, setShowAccModal] = useState(false)
  const [showIconModal, setShowIconModal] = useState(false)

  const { data: localCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context, type: 'expense' },
  })

  const { data: localAccounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context },
  })

  const { data: localDebt, loading: debtLoading } = useLocalData({
    table: 'debts' as any,
    filters: { id: editId || '' },
  })

  useEffect(() => {
    if (editId && localDebt && localDebt.length > 0) {
      const data = localDebt[0] as any
      setPersonName(data.person_name)
      const numValue = Number(data.total_amount) || 0
      setAmountNum(numValue)
      setAmountFormatted(numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
      setDueDate(data.due_date || '')
      setDescription(data.description || '')
      setCategoryId(data.category_id || '')
      setAccountId(data.account_id || '')
      setColor(data.color)
      setIcon(data.icon ? data.icon.charAt(0).toUpperCase() + data.icon.slice(1) : 'User')
      setDebtContext(data.context || 'dfl')
      setLoading(false)
    } else if (!editId) {
      setLoading(false)
    }
  }, [editId, localDebt])

  const handleSave = async () => {
    if (!user?.id || !personName.trim() || amountNum <= 0) {
      errorHaptic()
      showToast('⚠️ Preencha nome e valor.', 'warning')
      return
    }
    setSaving(true)

    const payload = {
      person_name: personName.trim(),
      total_amount: amountNum,
      due_date: dueDate || null,
      description: description || null,
      category_id: categoryId || null,
      account_id: accountId || null,
      color,
      icon: icon.toLowerCase(),
      status: 'pending',
      context: debtContext,
      updated_at: new Date().toISOString(),
    }

    try {
      if (editId) {
        await db.transaction('rw', db.debts, db.syncQueue, async () => {
          const result = await safeUpdate('debts', editId, payload)
          if (!result.success) throw new Error(result.error)
        })
        success()
        showToast('✅ Empréstimo atualizado!', 'success')
      } else {
        const id = crypto.randomUUID()
        const fullPayload = {
          id,
          user_id: user.id,
          ...payload,
          paid_amount: 0,
          created_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        await db.transaction('rw', db.debts, db.syncQueue, async () => {
          const result = await safeAdd('debts', fullPayload)
          if (!result.success) throw new Error(result.error)
        })
        success()
        showToast('✅ Empréstimo registrado!', 'success')
      }
      router.push('/debts')
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading || debtLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900 transition-colors duration-300">
      <Loader2 className="animate-spin text-teal-600" size={40} />
    </div>
  )

  const selectedCat = (localCategories || []).find((c: any) => c.id === categoryId) as any
  const selectedAcc = (localAccounts || []).find((a: any) => a.id === accountId) as any
  const IconComp = getDynamicIcon(icon)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      
      <div className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-gray-50/90 dark:bg-slate-900/90 backdrop-blur-xl py-2">
        <button onClick={() => { vibrate([5]); router.back(); }} className="p-2 -ml-2 rounded-full text-gray-800 dark:text-gray-200 active:scale-95 transition-transform">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{editId ? 'Editar Empréstimo' : 'Novo Empréstimo'}</h2>
        <div className="w-10" />
      </div>

      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-3 block">Contexto</label>
          <div className="flex gap-2 bg-gray-50 dark:bg-slate-700/50 p-1 rounded-full border border-gray-100 dark:border-slate-700/50">
            {CONTEXTS.map(c => (
              <button
                key={c}
                onClick={() => { vibrate([5]); setDebtContext(c); }}
                className={`flex-1 py-3 rounded-full text-[13px] font-bold transition-all active:scale-95 ${debtContext === c ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
              >
                {c === 'dfl' ? 'Empresa' : 'Pessoal'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-2 block">Nome da pessoa / empresa</label>
          <div className="flex items-center gap-3">
            <User size={18} className="text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={personName}
              onChange={e => setPersonName(e.target.value)}
              placeholder="Ex: João Silva"
              className="w-full bg-transparent text-[16px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-2 block">Valor a Receber</label>
          <div className="flex items-center gap-2">
            <span className="text-[18px] text-gray-400 font-medium">R$</span>
            <MoneyInput
              value={amountNum}
              onChange={(num, formatted) => {
                setAmountNum(num)
                setAmountFormatted(formatted)
              }}
              placeholder="0,00"
              className="text-[28px] font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-2 block">Vencimento (Op.)</label>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="bg-transparent text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none w-full"
              />
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-2 block">Descrição (Op.)</label>
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Detalhes..."
                className="w-full bg-transparent text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
              />
            </div>
          </div>
        </div>

        <button
          onClick={() => { vibrate([5]); setShowCatModal(true); }}
          className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center shadow-sm"><Tag size={18} className="text-gray-400 dark:text-gray-500" /></div>
            <div className="text-left">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest block">Categoria</span>
              <span className="text-[15px] font-bold text-gray-800 dark:text-gray-200">{selectedCat ? selectedCat.name : 'Geral'}</span>
            </div>
          </div>
          <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180" />
        </button>

        <button
          onClick={() => { vibrate([5]); setShowAccModal(true); }}
          className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center shadow-sm"><Wallet size={18} className="text-gray-400 dark:text-gray-500" /></div>
            <div className="text-left">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest block">Conta para depósito</span>
              <span className="text-[15px] font-bold text-gray-800 dark:text-gray-200">{selectedAcc ? selectedAcc.name : 'Nenhuma'}</span>
            </div>
          </div>
          <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180" />
        </button>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-3 block">Cor</label>
          <div className="flex flex-wrap gap-3">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => { vibrate([5]); setColor(c); }}
                className={`w-9 h-9 rounded-full transition-all active:scale-90 ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ring-gray-400 shadow-sm' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <button
          onClick={() => { vibrate([5]); setShowIconModal(true); }}
          className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700/50 flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] flex items-center justify-center shadow-sm" style={{ backgroundColor: `${color}20`, color: color }}>
              <IconComp size={20} />
            </div>
            <div className="text-left">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest block">Ícone</span>
              <span className="text-[15px] font-bold text-gray-800 dark:text-gray-200">{icon}</span>
            </div>
          </div>
          <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180" />
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 dark:from-slate-900 via-gray-50/80 dark:via-slate-900/80 to-transparent z-20">
        <button onClick={() => { vibrate([10, 50]); handleSave(); }} disabled={saving} className="w-full max-w-md mx-auto bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[24px] font-bold text-[16px] shadow-lg shadow-teal-600/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 size={22} className="animate-spin" /> : <Check size={22} />}
          {editId ? 'Atualizar Empréstimo' : 'Criar Empréstimo'}
        </button>
      </div>

      {showCatModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowCatModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Selecionar Categoria</h3>
              <button onClick={() => setShowCatModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
            </div>
            <div className="space-y-2 pb-10">
              <button onClick={() => { vibrate([5]); setCategoryId(''); setShowCatModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${!categoryId ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent'}`}>
                <div className="w-12 h-12 rounded-[16px] flex items-center justify-center bg-white dark:bg-slate-800 text-gray-400 shadow-sm"><Tag size={20} /></div>
                <span className={`flex-1 text-left text-[15px] font-bold ${!categoryId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>Geral</span>
                {!categoryId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
              </button>
              {(localCategories || []).map((cat: any) => {
                const CatIconComp = getDynamicIcon(cat.icon)
                const isActive = cat.id === categoryId
                return (
                  <button key={cat.id} onClick={() => { vibrate([5]); setCategoryId(cat.id); setShowCatModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent hover:bg-gray-100'}`}>
                    <div className="w-12 h-12 rounded-[16px] flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: cat.color || '#14b8a6' }}><CatIconComp size={20} /></div>
                    <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{cat.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {showAccModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowAccModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Contas</h3>
              <button onClick={() => setShowAccModal(false)} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
            </div>
            <div className="space-y-2 pb-10">
              <button onClick={() => { vibrate([5]); setAccountId(''); setShowAccModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${!accountId ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent'}`}>
                <div className="w-12 h-12 rounded-[16px] flex items-center justify-center bg-white dark:bg-slate-800 text-gray-400 shadow-sm"><Wallet size={20} /></div>
                <span className={`flex-1 text-left text-[15px] font-bold ${!accountId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>Nenhuma (Apenas registro)</span>
                {!accountId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
              </button>
              {(localAccounts || []).map((acc: any) => {
                const isActive = acc.id === accountId
                return (
                  <button key={acc.id} onClick={() => { vibrate([5]); setAccountId(acc.id); setShowAccModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'bg-gray-50 dark:bg-slate-700/40 border border-transparent hover:bg-gray-100'}`}>
                    <div className="w-12 h-12 rounded-[16px] flex items-center justify-center text-white text-[14px] font-black shadow-sm" style={{ backgroundColor: acc.color || '#14b8a6' }}>{acc.name.substring(0, 2).toUpperCase()}</div>
                    <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{acc.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <IconPicker
        isOpen={showIconModal}
        onClose={() => setShowIconModal(false)}
        selectedIcon={icon}
        onSelect={(i) => { setIcon(i); vibrate([5]); }}
      />
    </div>
  )
}

export default function NewDebtPage() {
  return (
    <ContextProvider>
      <NewDebtContent />
    </ContextProvider>
  )
}
