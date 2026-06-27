'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { X, Check, Loader2, Wallet, Calendar, Tag, ChevronLeft, Building } from 'lucide-react'
import { useContext_ } from '@/components/ContextToggle'
import IconPicker from '@/components/IconPicker'
import { getDynamicIcon } from '@/lib/iconUtils'
import BankLogo from '@/components/BankLogo'
import { useToast } from '@/contexts/ToastContext'

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

  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])

  const [personName, setPersonName] = useState('')
  const [amount, setAmount] = useState('0,00')
  const [amountNum, setAmountNum] = useState(0)
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
    }
    loadData()
  }, [isOpen, user, context])

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
    if (!user?.id || !personName.trim() || amountNum <= 0) {
      showToast('Preencha todos os campos obrigatórios.', 'warning')
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
      showToast('Empréstimo registrado!', 'success')
      onSave(data.id)
      onClose()
    } catch (err: any) {
      showToast('Erro ao salvar empréstimo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const selectedCat = categories.find(c => c.id === categoryId)
  const selectedAcc = accounts.find(a => a.id === accountId)
  const IconComp = getDynamicIcon(icon)

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Novo Empréstimo</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 p-2"><X size={20} /></button>
        </div>

        <div className="space-y-5">
          {/* Contexto */}
          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-3 block">Contexto</label>
            <div className="flex gap-2">
              {(['dfl', 'personal'] as const).map(c => (
                <button key={c} onClick={() => setDebtContext(c)} className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${debtContext === c ? 'bg-teal-700 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'}`}>
                  {c === 'dfl' ? 'DFL' : 'Pessoal'}
                </button>
              ))}
            </div>
          </div>

          {/* Nome da pessoa */}
          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Nome da pessoa</label>
            <div className="flex items-center gap-3">
              <User size={18} className="text-gray-400 dark:text-gray-500" />
              <input type="text" value={personName} onChange={e => setPersonName(e.target.value)} placeholder="Ex: João Silva" className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500" autoFocus />
            </div>
          </div>

          {/* Valor */}
          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Valor emprestado</label>
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

          {/* Data de vencimento */}
          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Data de vencimento (opcional)</label>
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-gray-400 dark:text-gray-500" />
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-transparent text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none" />
            </div>
          </div>

          {/* Descrição */}
          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Descrição (opcional)</label>
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-gray-400 dark:text-gray-500" />
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Empréstimo para pagar conta" className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500" />
            </div>
          </div>

          {/* Categoria */}
          <button onClick={() => setShowCatModal(true)} className="w-full bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Tag size={18} className="text-gray-400 dark:text-gray-500" />
              <div className="text-left">
                <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider block">Categoria</span>
                <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{selectedCat ? selectedCat.name : 'Geral'}</span>
              </div>
            </div>
            <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180" />
          </button>

          {/* Conta */}
          <button onClick={() => setShowAccModal(true)} className="w-full bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet size={18} className="text-gray-400 dark:text-gray-500" />
              <div className="text-left">
                <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider block">Conta (para depósitos)</span>
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
                <button key={c} onClick={() => setColor(c)} className={`w-9 h-9 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ring-gray-400' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Ícone */}
          <button onClick={() => setShowIconModal(true)} className="w-full bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between">
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

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-6 bg-teal-700 text-white py-4 rounded-2xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : 'Salvar Empréstimo'}
        </button>

        {/* Modal Categorias */}
        {showCatModal && (
          <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50" onClick={() => setShowCatModal(false)}>
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Categorias</h3>
                <button onClick={() => setShowCatModal(false)} className="text-gray-400 dark:text-gray-500 p-2"><X size={20} /></button>
              </div>
              <div className="space-y-2">
                <button onClick={() => { setCategoryId(''); setShowCatModal(false) }} className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${!categoryId ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-200 dark:bg-slate-700 text-gray-400"><Tag size={20} /></div>
                  <span className={`flex-1 text-left font-medium ${!categoryId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>Geral</span>
                  {!categoryId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                </button>
                {categories.map(cat => {
                  const CatIconComp = getDynamicIcon(cat.icon)
                  const isActive = cat.id === categoryId
                  return (
                    <button key={cat.id} onClick={() => { setCategoryId(cat.id); setShowCatModal(false) }} className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}><CatIconComp size={20} /></div>
                      <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{cat.name}</span>
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
          <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50" onClick={() => setShowAccModal(false)}>
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Contas</h3>
                <button onClick={() => setShowAccModal(false)} className="text-gray-400 dark:text-gray-500 p-2"><X size={20} /></button>
              </div>
              <div className="space-y-2">
                <button onClick={() => { setAccountId(''); setShowAccModal(false) }} className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${!accountId ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-200 dark:bg-slate-700 text-gray-400"><Wallet size={20} /></div>
                  <span className={`flex-1 text-left font-medium ${!accountId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>Nenhuma conta</span>
                  {!accountId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                </button>
                {accounts.map(acc => {
                  const isActive = acc.id === accountId
                  return (
                    <button key={acc.id} onClick={() => { setAccountId(acc.id); setShowAccModal(false) }} className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
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

        <IconPicker isOpen={showIconModal} onClose={() => setShowIconModal(false)} selectedIcon={icon} onSelect={setIcon} />
      </div>
    </div>
  )
}