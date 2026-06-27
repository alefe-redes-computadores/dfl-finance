'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { X, Check, Loader2, Wallet, Calendar, Tag, ChevronLeft, Building } from 'lucide-react'
import { useContext_ } from '@/components/ContextToggle'
import IconPicker from '@/components/IconPicker'
import { getDynamicIcon } from '@/lib/iconUtils'
import MoneyInput from '@/components/MoneyInput'
import BankLogo from '@/components/BankLogo'
import { useToast } from '@/contexts/ToastContext'

const COLORS = ['#14b8a6', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#eab308', '#64748b', '#000000']

interface ModalFinancingProps {
  isOpen: boolean
  onClose: () => void
  onSave: (id: string) => void
}

export default function ModalFinancing({ isOpen, onClose, onSave }: ModalFinancingProps) {
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])

  const [name, setName] = useState('')
  const [institution, setInstitution] = useState('')
  const [installmentValueNum, setInstallmentValueNum] = useState(0)
  const [installmentValueFormatted, setInstallmentValueFormatted] = useState('0,00')
  const [totalInstallments, setTotalInstallments] = useState('1')
  const [nextDueDate, setNextDueDate] = useState('')
  const [outstandingBalanceNum, setOutstandingBalanceNum] = useState(0)
  const [outstandingBalanceFormatted, setOutstandingBalanceFormatted] = useState('0,00')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [color, setColor] = useState('#14b8a6')
  const [icon, setIcon] = useState('Home')
  const [finContext, setFinContext] = useState<'dfl' | 'personal'>('dfl')

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

  const handleSave = async () => {
    if (!user?.id || !name.trim() || installmentValueNum <= 0) {
      showToast('Preencha todos os campos obrigatórios.', 'warning')
      return
    }
    setSaving(true)

    const payload = {
      user_id: user.id,
      context: finContext,
      name: name.trim(),
      institution: institution || null,
      installment_value: installmentValueNum,
      total_installments: parseInt(totalInstallments),
      current_installment: 1,
      next_due_date: nextDueDate || null,
      outstanding_balance: outstandingBalanceNum,
      account_id: accountId || null,
      category_id: categoryId || null,
      color,
      icon
    }

    try {
      const { data, error } = await supabase.from('financings').insert(payload).select('id').single()
      if (error) throw error
      showToast('Financiamento criado!', 'success')
      onSave(data.id)
      onClose()
    } catch (err: any) {
      showToast('Erro ao salvar financiamento.', 'error')
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
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Novo Financiamento</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 p-2"><X size={20} /></button>
        </div>

        <div className="space-y-5">
          {/* Contexto */}
          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-3 block">Contexto</label>
            <div className="flex gap-2">
              {(['dfl', 'personal'] as const).map(c => (
                <button key={c} onClick={() => setFinContext(c)} className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${finContext === c ? 'bg-teal-700 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'}`}>
                  {c === 'dfl' ? 'DFL' : 'Pessoal'}
                </button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Nome do financiamento</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Financiamento Imóvel" className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500" autoFocus />
          </div>

          {/* Instituição */}
          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Instituição financeira</label>
            <div className="flex items-center gap-3">
              <Building size={18} className="text-gray-400 dark:text-gray-500" />
              <input type="text" value={institution} onChange={e => setInstitution(e.target.value)} placeholder="Ex: Itaú, Caixa" className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500" />
            </div>
          </div>

          {/* Valor da parcela */}
          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Valor da parcela</label>
            <div className="flex items-center gap-2">
              <span className="text-xl text-gray-400 dark:text-gray-500 font-light">R$</span>
              <MoneyInput
                value={installmentValueNum}
                onChange={(num, formatted) => {
                  setInstallmentValueNum(num)
                  setInstallmentValueFormatted(formatted)
                }}
                className="text-2xl font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200"
              />
            </div>
          </div>

          {/* Total de parcelas */}
          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Total de parcelas</label>
            <input type="number" value={totalInstallments} onChange={e => setTotalInstallments(e.target.value)} min={1} max={360} className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none" />
          </div>

          {/* Próximo vencimento */}
          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Próximo vencimento</label>
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-gray-400 dark:text-gray-500" />
              <input type="date" value={nextDueDate} onChange={e => setNextDueDate(e.target.value)} className="bg-transparent text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none" />
            </div>
          </div>

          {/* Saldo devedor */}
          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Saldo devedor</label>
            <div className="flex items-center gap-2">
              <span className="text-xl text-gray-400 dark:text-gray-500 font-light">R$</span>
              <MoneyInput
                value={outstandingBalanceNum}
                onChange={(num, formatted) => {
                  setOutstandingBalanceNum(num)
                  setOutstandingBalanceFormatted(formatted)
                }}
                className="text-2xl font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200"
              />
            </div>
          </div>

          {/* Conta */}
          <button onClick={() => setShowAccModal(true)} className="w-full bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet size={18} className="text-gray-400 dark:text-gray-500" />
              <div className="text-left">
                <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider block">Conta para débito</span>
                <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{selectedAcc ? selectedAcc.name : 'Nenhuma conta'}</span>
              </div>
            </div>
            <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180" />
          </button>

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
          {saving ? <Loader2 className="animate-spin" size={20} /> : 'Salvar Financiamento'}
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