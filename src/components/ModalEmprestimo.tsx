'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { X, Check, Loader2, Wallet, Calendar, User, FileText, Tag, ChevronLeft } from 'lucide-react'
import { useContext_ } from '@/components/ContextToggle'
import IconPicker from '@/components/IconPicker'
import { getDynamicIcon } from '@/lib/iconUtils'
import BankLogo from '@/components/BankLogo'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import MoneyInput from '@/components/MoneyInput'

const COLORS = ['#14b8a6', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#eab308', '#64748b', '#000000']

interface ModalEmprestimoProps {
  isOpen: boolean
  onClose: () => void
  onSave: (id: string) => void
}

export default function ModalEmprestimo({ isOpen, onClose, onSave }: ModalEmprestimoProps) {
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()
  const { vibrate, success, error: hapticError } = useHapticFeedback()

  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])

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

  useEffect(() => {
    if (!isOpen || !user?.id) return
    const loadData = async () => {
      const [{ data: cats }, { data: accs }] = await Promise.all([
        supabase.from('categories').select('id, name, color, icon').match({ user_id: user.id, context }).eq('type', 'expense'),
        supabase.from('accounts').select('id, name, color').match({ user_id: user.id, context })
      ])
      setCategories(Array.isArray(cats) ? cats : [])
      setAccounts(Array.isArray(accs) ? accs : [])
      setDebtContext(context === 'dfl' ? 'dfl' : 'personal')
    }
    loadData()
  }, [isOpen, user, context])

  const handleSave = async () => {
    if (!user?.id || !personName.trim() || amountNum <= 0) {
      showToast('⚠️ Preencha nome e valor.', 'warning')
      hapticError()
      return
    }
    setSaving(true)

    const payload = {
      user_id: user.id,
      context: debtContext,
      person_name: personName.trim(),
      total_amount: amountNum,
      due_date: dueDate || null,
      description: description || null,
      category_id: categoryId || null,
      account_id: accountId || null,
      color,
      icon,
      status: 'pending'
    }

    try {
      const { data, error } = await supabase.from('debts').insert(payload).select('id').single()
      if (error) throw error
      success()
      showToast('✅ Empréstimo registrado!', 'success')
      onSave(data.id)
      onClose()
    } catch (err: any) {
      hapticError()
      showToast('❌ Erro ao salvar empréstimo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const selectedCat = categories.find(c => c.id === categoryId)
  const selectedAcc = accounts.find(a => a.id === accountId)
  const IconComp = getDynamicIcon(icon)

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
      <div className="relative bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-6 h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-8 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]" onClick={e => e.stopPropagation()}>
        
        {/* Puxador */}
        <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />

        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Novo Empréstimo</h3>
          <button onClick={() => { vibrate([10]); onClose(); }} className="text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 p-2 rounded-full active:scale-95 transition-colors"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          {/* Contexto */}
          <div className="bg-gray-50 dark:bg-slate-700/30 rounded-[24px] p-4 border border-gray-100 dark:border-slate-700/50">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-3 block">Contexto</label>
            <div className="flex bg-white dark:bg-slate-800 p-1 rounded-full border border-gray-100 dark:border-slate-700">
              {(['dfl', 'personal'] as const).map(c => (
                <button key={c} onClick={() => { vibrate([5]); setDebtContext(c); }} className={`flex-1 py-2.5 rounded-full text-[13px] font-bold transition-all active:scale-[0.98] ${debtContext === c ? 'bg-teal-700 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                  {c === 'dfl' ? 'Empresa' : 'Pessoal'}
                </button>
              ))}
            </div>
          </div>

          {/* Nome da pessoa */}
          <div className="bg-gray-50 dark:bg-slate-700/30 rounded-[24px] p-4 border border-gray-100 dark:border-slate-700/50">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-2 block">Nome da pessoa</label>
            <div className="flex items-center gap-3">
              <User size={18} className="text-gray-400 dark:text-gray-500 shrink-0" />
              <input type="text" value={personName} onChange={e => setPersonName(e.target.value)} placeholder="Ex: João Silva" className="w-full bg-transparent text-[16px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600" autoFocus />
            </div>
          </div>

          {/* Valor */}
          <div className="bg-gray-50 dark:bg-slate-700/30 rounded-[24px] p-4 border border-gray-100 dark:border-slate-700/50">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-2 block">Valor emprestado</label>
            <div className="flex items-center gap-2">
              <span className="text-xl text-gray-400 dark:text-gray-500 font-medium">R$</span>
              <MoneyInput
                value={amountNum}
                onChange={(num, formatted) => {
                  setAmountNum(num)
                  setAmountFormatted(formatted)
                }}
                className="text-[28px] font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Data de vencimento */}
          <div className="bg-gray-50 dark:bg-slate-700/30 rounded-[24px] p-4 border border-gray-100 dark:border-slate-700/50">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-2 block">Vencimento (opcional)</label>
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-gray-400 dark:text-gray-500 shrink-0" />
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-transparent text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none w-full" />
            </div>
          </div>

          {/* Descrição */}
          <div className="bg-gray-50 dark:bg-slate-700/30 rounded-[24px] p-4 border border-gray-100 dark:border-slate-700/50">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-2 block">Descrição (opcional)</label>
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-gray-400 dark:text-gray-500 shrink-0" />
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Empréstimo rápido" className="w-full bg-transparent text-[16px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600" />
            </div>
          </div>

          {/* Categoria */}
          <button onClick={() => { vibrate([10]); setShowCatModal(true); }} className="w-full bg-gray-50 dark:bg-slate-700/30 rounded-[24px] p-4 border border-gray-100 dark:border-slate-700/50 flex items-center justify-between active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm"><Tag size={18} className="text-gray-400 dark:text-gray-500" /></div>
              <div className="text-left">
                <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest block">Categoria</span>
                <span className="text-[15px] font-bold text-gray-800 dark:text-gray-200">{selectedCat ? selectedCat.name : 'Geral'}</span>
              </div>
            </div>
            <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180" />
          </button>

          {/* Conta */}
          <button onClick={() => { vibrate([10]); setShowAccModal(true); }} className="w-full bg-gray-50 dark:bg-slate-700/30 rounded-[24px] p-4 border border-gray-100 dark:border-slate-700/50 flex items-center justify-between active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm"><Wallet size={18} className="text-gray-400 dark:text-gray-500" /></div>
              <div className="text-left">
                <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest block">Conta (p/ depósitos)</span>
                <span className="text-[15px] font-bold text-gray-800 dark:text-gray-200">{selectedAcc ? selectedAcc.name : 'Nenhuma conta'}</span>
              </div>
            </div>
            <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180" />
          </button>

          {/* Cor */}
          <div className="bg-gray-50 dark:bg-slate-700/30 rounded-[24px] p-4 border border-gray-100 dark:border-slate-700/50">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-3 block">Cor</label>
            <div className="flex flex-wrap gap-3">
              {COLORS.map(c => (
                <button key={c} onClick={() => { vibrate([5]); setColor(c); }} className={`w-9 h-9 rounded-full transition-all active:scale-90 ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ring-gray-400 shadow-md' : 'hover:scale-110 shadow-sm'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Ícone */}
          <button onClick={() => { vibrate([10]); setShowIconModal(true); }} className="w-full bg-gray-50 dark:bg-slate-700/30 rounded-[24px] p-4 border border-gray-100 dark:border-slate-700/50 flex items-center justify-between active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] flex items-center justify-center shadow-sm bg-white dark:bg-slate-800" style={{ color: color }}>
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

        <button
          onClick={() => { vibrate([10, 50]); handleSave(); }}
          disabled={saving}
          className="w-full mt-8 bg-teal-700 text-white py-4 rounded-[24px] font-bold hover:bg-teal-800 transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center shadow-lg shadow-teal-700/30"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : 'Salvar Empréstimo'}
        </button>

        {/* Modal Categorias */}
        {showCatModal && (
          <div className="fixed inset-0 z-[300] flex items-end justify-center" onClick={() => setShowCatModal(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
            <div className="relative bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-6 h-[70vh] overflow-y-auto animate-in slide-in-from-bottom-8" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
                <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Categorias</h3>
                <button onClick={() => setShowCatModal(false)} className="text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
              </div>
              <div className="space-y-2">
                <button onClick={() => { vibrate([5]); setCategoryId(''); setShowCatModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${!categoryId ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'}`}>
                  <div className="w-12 h-12 rounded-[16px] flex items-center justify-center bg-white dark:bg-slate-800 text-gray-400 shadow-sm"><Tag size={20} /></div>
                  <span className={`flex-1 text-left text-[15px] font-bold ${!categoryId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>Geral</span>
                  {!categoryId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                </button>
                {categories.map(cat => {
                  const CatIconComp = getDynamicIcon(cat.icon)
                  const isActive = cat.id === categoryId
                  return (
                    <button key={cat.id} onClick={() => { vibrate([5]); setCategoryId(cat.id); setShowCatModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'}`}>
                      <div className="w-12 h-12 rounded-[16px] flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm" style={{ color: cat.color }}><CatIconComp size={20} /></div>
                      <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{cat.name}</span>
                      {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Modal Contas */}
        {showAccModal && (
          <div className="fixed inset-0 z-[300] flex items-end justify-center" onClick={() => setShowAccModal(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
            <div className="relative bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-6 h-[70vh] overflow-y-auto animate-in slide-in-from-bottom-8" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
                <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Contas</h3>
                <button onClick={() => setShowAccModal(false)} className="text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
              </div>
              <div className="space-y-2">
                <button onClick={() => { vibrate([5]); setAccountId(''); setShowAccModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${!accountId ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'}`}>
                  <div className="w-12 h-12 rounded-[16px] flex items-center justify-center bg-white dark:bg-slate-800 text-gray-400 shadow-sm"><Wallet size={20} /></div>
                  <span className={`flex-1 text-left text-[15px] font-bold ${!accountId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>Nenhuma conta</span>
                  {!accountId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                </button>
                {accounts.map(acc => {
                  const isActive = acc.id === accountId
                  return (
                    <button key={acc.id} onClick={() => { vibrate([5]); setAccountId(acc.id); setShowAccModal(false); }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-transform active:scale-[0.98] ${isActive ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50' : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'}`}>
                      <BankLogo color={acc.color || '#14b8a6'} name={acc.name} size="md" />
                      <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{acc.name}</span>
                      {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <IconPicker isOpen={showIconModal} onClose={() => setShowIconModal(false)} selectedIcon={icon} onSelect={(i) => { setIcon(i); vibrate([5]) }} />
      </div>
    </div>
  )
}
