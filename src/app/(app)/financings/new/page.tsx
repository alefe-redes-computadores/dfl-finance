'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Check, Loader2, X, Wallet, Calendar, Tag, Building } from 'lucide-react'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import IconPicker from '@/components/IconPicker'
import { getDynamicIcon } from '@/lib/iconUtils'
import MoneyInput from '@/components/MoneyInput'
import BankLogo from '@/components/BankLogo'
import { useToast } from '@/contexts/ToastContext'

const COLORS = ['#14b8a6', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#eab308', '#64748b', '#000000']

function NewFinancingContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { context } = useContext_()
  const editId = searchParams.get('edit')
  const { showToast } = useToast()

  const [loading, setLoading] = useState(false)
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

  const loadData = async () => {
    if (!user?.id) return
    const [{ data: cats }, { data: accs }] = await Promise.all([
      supabase.from('categories').select('id, name, color, icon').match({ user_id: user.id, context: context }).eq('type', 'expense'),
      supabase.from('accounts').select('id, name, color').match({ user_id: user.id, context: context })
    ])
    setCategories(Array.isArray(cats) ? cats : [])
    setAccounts(Array.isArray(accs) ? accs : [])
  }

  const loadFinancing = async () => {
    if (!editId || !user?.id) return
    setLoading(true)
    const { data } = await supabase.from('financings').select('*').match({ id: editId, user_id: user.id }).single()
    if (data) {
      setName(data.name)
      setInstitution(data.institution || '')
      const instVal = Number(data.installment_value) || 0
      setInstallmentValueNum(instVal)
      setInstallmentValueFormatted(instVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
      setTotalInstallments(String(data.total_installments))
      setNextDueDate(data.next_due_date || '')
      const outBal = Number(data.outstanding_balance) || 0
      setOutstandingBalanceNum(outBal)
      setOutstandingBalanceFormatted(outBal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
      setAccountId(data.account_id || '')
      setCategoryId(data.category_id || '')
      setColor(data.color)
      setIcon(data.icon ? data.icon.charAt(0).toUpperCase() + data.icon.slice(1) : 'Home')
      setFinContext(data.context || 'dfl')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    if (editId) loadFinancing()
  }, [user, context, editId])

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
      if (editId) {
        await supabase.from('financings').update(payload).eq('id', editId)
      } else {
        await supabase.from('financings').insert(payload)
      }
      showToast(editId ? 'Financiamento atualizado com sucesso!' : 'Financiamento criado com sucesso!', 'success')
      router.push('/financings')
    } catch (err: any) {
      showToast('Erro ao salvar financiamento.', 'error')
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
  const IconComp = getDynamicIcon(icon)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white dark:bg-slate-900 flex flex-col font-sans pb-24 relative transition-colors duration-300">
      
      <div className="pt-6 pb-8 px-4 shadow-sm relative transition-colors duration-300" style={{ backgroundColor: color }}>
        <div className="flex items-center justify-between mb-6 text-white">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ChevronLeft size={24} />
          </button>
        </div>
        <div>
          <p className="text-white/80 text-[11px] font-medium uppercase tracking-wider mb-2">Nome do financiamento</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-8 rounded-md flex items-center justify-center border border-white/20 bg-black/10 shadow-sm">
              <IconComp size={18} className="text-white" />
            </div>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Financiamento Imóvel"
              className="bg-transparent text-white text-2xl font-light outline-none w-full placeholder:text-white/50"
              autoFocus
            />
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-800 transition-colors duration-300">
        <div className="space-y-5 p-4">
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

          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Instituição financeira</label>
            <div className="flex items-center gap-3">
              <Building size={18} className="text-gray-400 dark:text-gray-500" />
              <input type="text" value={institution} onChange={e => setInstitution(e.target.value)} placeholder="Ex: Itaú, Caixa" className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500" />
            </div>
          </div>

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

          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Total de parcelas</label>
            <input type="number" value={totalInstallments} onChange={e => setTotalInstallments(e.target.value)} min={1} max={360} className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none" />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2 block">Próximo vencimento</label>
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-gray-400 dark:text-gray-500" />
              <input type="date" value={nextDueDate} onChange={e => setNextDueDate(e.target.value)} className="bg-transparent text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none" />
            </div>
          </div>

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

          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
            <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-3 block">Cor</label>
            <div className="flex flex-wrap gap-3">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} className={`w-9 h-9 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ring-gray-400' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

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
      </div>

      <button 
        onClick={handleSave} 
        disabled={saving}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 w-14 h-14 bg-teal-700 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-teal-800 transition-colors disabled:opacity-50 z-50"
      >
        {saving ? <Loader2 className="animate-spin" size={28} /> : <Check size={28} />}
      </button>

      {showCatModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCatModal(false)}>
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

      {showAccModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowAccModal(false)}>
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
  )
}

export default function NewFinancingPage() {
  return (
    <ContextProvider>
      <NewFinancingContent />
    </ContextProvider>
  )
}