// src/components/ModalFinancing.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { X, Check, Loader2, Wallet, Calendar, Tag, ChevronLeft, Building } from 'lucide-react'
import { useContext_ } from '@/components/ContextToggle'
import IconPicker from '@/components/IconPicker'
import { getDynamicIcon } from '@/lib/iconUtils'
import MoneyInput from '@/components/MoneyInput'
import BankLogo from '@/components/BankLogo'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'
import { db } from '@/lib/db'

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
  const { vibrate, success, error: hapticError } = useHapticFeedback()
  const { safeAdd } = useSafeDb()

  const [saving, setSaving] = useState(false)

  // DADOS LOCAIS (Dexie)
  const { data: categories } = useLocalData({
    table: 'categories' as any,
    filters: { context, type: 'expense' },
  })

  const { data: accounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context },
  })

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

  // Reset form quando o modal abre
  useEffect(() => {
    if (isOpen) {
      setFinContext(context === 'dfl' ? 'dfl' : 'personal')
    }
  }, [isOpen, context])

  const handleSave = async () => {
    if (!user?.id || !name.trim() || installmentValueNum <= 0) {
      showToast('Preencha o nome e informe um valor de parcela válido.', 'warning')
      hapticError()
      return
    }

    setSaving(true)

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const payload = {
      id,
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
      icon: icon.toLowerCase(),
      status: 'active',
      created_at: now,
      updated_at: now,
      sync_status: 'pending',
      sync_attempts: 0,
    }

    try {
      await db.transaction('rw', db.financings, db.syncQueue, async () => {
        const result = await safeAdd('financings', payload)
        if (!result.success) throw new Error(result.error)
      })

      success()
      showToast('Financiamento criado com sucesso.', 'success')
      onSave(id)
      onClose()
    } catch (err: any) {
      hapticError()
      showToast(`Não foi possível criar o financiamento: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const selectedCat = categories?.find((c: any) => c.id === categoryId)
  const selectedAcc = accounts?.find((a: any) => a.id === accountId)
  const IconComp = getDynamicIcon(icon)

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
      <div
        className="relative bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-5 h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-8 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-[22px] text-gray-900 dark:text-gray-100 tracking-tight">
              Novo Financiamento
            </h3>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
              Preencha os dados principais do contrato
            </p>
          </div>

          <button
            onClick={() => { vibrate([10]); onClose(); }}
            className="h-10 w-10 rounded-full bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-500 dark:text-gray-300 flex items-center justify-center active:scale-[0.98] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Contexto */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
            <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-2 block">
              Contexto
            </label>
            <div className="flex rounded-[20px] border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-1">
              {(['dfl', 'personal'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => { vibrate([5]); setFinContext(c); }}
                  className={`flex-1 h-10 rounded-[16px] text-[13px] font-bold transition-all active:scale-[0.98] ${
                    finContext === c
                      ? 'bg-teal-700 text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-slate-800'
                  }`}
                >
                  {c === 'dfl' ? 'Empresa' : 'Pessoal'}
                </button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
            <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
              Nome do financiamento
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Financiamento Imóvel"
              className="w-full rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 text-[15px] font-semibold text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
              autoFocus
            />
          </div>

          {/* Instituição */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
            <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
              Instituição financeira
            </label>
            <div className="flex items-center gap-3 rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/20">
              <Building size={17} className="text-gray-400 dark:text-gray-500 shrink-0" />
              <input
                type="text"
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                placeholder="Ex: Itaú, Caixa"
                className="w-full bg-transparent text-[15px] font-semibold text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Valor da parcela */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
            <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
              Valor da parcela
            </label>
            <div className="flex items-center gap-2 rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/20">
              <span className="text-[18px] text-gray-400 dark:text-gray-500 font-semibold">R$</span>
              <MoneyInput
                value={installmentValueNum}
                onChange={(num, formatted) => {
                  setInstallmentValueNum(num)
                  setInstallmentValueFormatted(formatted)
                }}
                className="text-[24px] font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Parcelas e vencimento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
              <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                Qtd. parcelas
              </label>
              <input
                type="number"
                value={totalInstallments}
                onChange={e => setTotalInstallments(e.target.value)}
                min={1}
                max={360}
                className="w-full rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 text-[15px] font-semibold text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
              <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                1º vencimento
              </label>
              <div className="flex items-center gap-2 rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/20">
                <Calendar size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
                <input
                  type="date"
                  value={nextDueDate}
                  onChange={e => setNextDueDate(e.target.value)}
                  className="bg-transparent text-[14px] font-semibold text-gray-800 dark:text-gray-200 outline-none w-full"
                />
              </div>
            </div>
          </div>

          {/* Saldo devedor */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
            <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
              Saldo devedor total
            </label>
            <div className="flex items-center gap-2 rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/20">
              <span className="text-[18px] text-gray-400 dark:text-gray-500 font-semibold">R$</span>
              <MoneyInput
                value={outstandingBalanceNum}
                onChange={(num, formatted) => {
                  setOutstandingBalanceNum(num)
                  setOutstandingBalanceFormatted(formatted)
                }}
                className="text-[24px] font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Conta */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
            <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-2 block">
              Conta para débito
            </label>
            <button
              onClick={() => { vibrate([10]); setShowAccModal(true); }}
              className="w-full rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm shrink-0">
                  <Wallet size={17} className="text-gray-400 dark:text-gray-500" />
                </div>
                <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {selectedAcc ? selectedAcc.name : 'Nenhuma conta'}
                </span>
              </div>
              <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180 shrink-0" />
            </button>
          </div>

          {/* Categoria */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
            <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-2 block">
              Categoria
            </label>
            <button
              onClick={() => { vibrate([10]); setShowCatModal(true); }}
              className="w-full rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm shrink-0">
                  <Tag size={17} className="text-gray-400 dark:text-gray-500" />
                </div>
                <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {selectedCat ? selectedCat.name : 'Geral'}
                </span>
              </div>
              <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180 shrink-0" />
            </button>
          </div>

          {/* Cor */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
            <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-2 block">
              Cor
            </label>
            <div className="flex flex-wrap gap-3">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => { vibrate([5]); setColor(c); }}
                  className={`w-9 h-9 rounded-full transition-all active:scale-[0.95] ${
                    color === c
                      ? 'scale-110 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ring-gray-400 shadow-sm'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Ícone */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
            <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-2 block">
              Ícone
            </label>
            <button
              onClick={() => { vibrate([10]); setShowIconModal(true); }}
              className="w-full rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-[14px] flex items-center justify-center shadow-sm bg-white dark:bg-slate-800 shrink-0"
                  style={{ color }}
                >
                  <IconComp size={18} />
                </div>
                <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {icon}
                </span>
              </div>
              <ChevronLeft size={18} className="text-gray-300 dark:text-gray-600 rotate-180 shrink-0" />
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-teal-100 bg-teal-50/80 p-4 dark:border-teal-800/40 dark:bg-teal-900/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-300">Resumo</p>
              <p className="mt-1 text-[13px] font-semibold text-gray-700 dark:text-gray-200">{Math.max(1, parseInt(totalInstallments || '1'))} parcela(s)</p>
            </div>
            <div className="text-right">
              <p className="text-[20px] font-black text-teal-700 dark:text-teal-300">{installmentValueNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              <p className="text-[11px] font-medium text-teal-700/70 dark:text-teal-300/70">por parcela</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => { vibrate([10, 50]); handleSave(); }}
          disabled={saving}
          className="w-full mt-4 bg-teal-700 text-white py-4 rounded-[20px] font-bold hover:bg-teal-800 transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center shadow-lg shadow-teal-600/20"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : 'Salvar Financiamento'}
        </button>

        {/* Modal Categorias */}
        {showCatModal && (
          <div className="fixed inset-0 z-[300] flex items-end justify-center" onClick={() => setShowCatModal(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
            <div
              className="relative bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-5 h-[70vh] overflow-y-auto animate-in slide-in-from-bottom-8"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-5" />
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
                <h3 className="font-semibold text-[22px] text-gray-900 dark:text-gray-100">Categorias</h3>
                <button
                  onClick={() => setShowCatModal(false)}
                  className="h-10 w-10 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-gray-300 flex items-center justify-center active:scale-[0.98]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => { vibrate([5]); setCategoryId(''); setShowCatModal(false); }}
                  className={`w-full rounded-[18px] p-3 flex items-center gap-3 transition-all active:scale-[0.98] ${
                    !categoryId
                      ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 border border-transparent'
                  }`}
                >
                  <div className="w-10 h-10 rounded-[14px] flex items-center justify-center bg-white dark:bg-slate-800 text-gray-400 shadow-sm">
                    <Tag size={18} />
                  </div>
                  <span className={`flex-1 text-left text-[14px] font-semibold ${!categoryId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>
                    Geral
                  </span>
                  {!categoryId && <Check size={18} className="text-teal-700 dark:text-teal-400" />}
                </button>

                {(categories || []).map((cat: any) => {
                  const CatIconComp = getDynamicIcon(cat.icon)
                  const isActive = cat.id === categoryId
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { vibrate([5]); setCategoryId(cat.id); setShowCatModal(false); }}
                      className={`w-full rounded-[18px] p-3 flex items-center gap-3 transition-all active:scale-[0.98] ${
                        isActive
                          ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 border border-transparent'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-[14px] flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm" style={{ color: cat.color }}>
                        <CatIconComp size={18} />
                      </div>
                      <span className={`flex-1 text-left text-[14px] font-semibold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>
                        {cat.name}
                      </span>
                      {isActive && <Check size={18} className="text-teal-700 dark:text-teal-400" />}
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
            <div
              className="relative bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-5 h-[70vh] overflow-y-auto animate-in slide-in-from-bottom-8"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-5" />
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
                <h3 className="font-semibold text-[22px] text-gray-900 dark:text-gray-100">Contas</h3>
                <button
                  onClick={() => setShowAccModal(false)}
                  className="h-10 w-10 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-gray-300 flex items-center justify-center active:scale-[0.98]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => { vibrate([5]); setAccountId(''); setShowAccModal(false); }}
                  className={`w-full rounded-[18px] p-3 flex items-center gap-3 transition-all active:scale-[0.98] ${
                    !accountId
                      ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 border border-transparent'
                  }`}
                >
                  <div className="w-10 h-10 rounded-[14px] flex items-center justify-center bg-white dark:bg-slate-800 text-gray-400 shadow-sm">
                    <Wallet size={18} />
                  </div>
                  <span className={`flex-1 text-left text-[14px] font-semibold ${!accountId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>
                    Nenhuma conta
                  </span>
                  {!accountId && <Check size={18} className="text-teal-700 dark:text-teal-400" />}
                </button>

                {(accounts || []).map((acc: any) => {
                  const isActive = acc.id === accountId
                  return (
                    <button
                      key={acc.id}
                      onClick={() => { vibrate([5]); setAccountId(acc.id); setShowAccModal(false); }}
                      className={`w-full rounded-[18px] p-3 flex items-center gap-3 transition-all active:scale-[0.98] ${
                        isActive
                          ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 border border-transparent'
                      }`}
                    >
                      <BankLogo color={acc.color || '#14b8a6'} name={acc.name} size="md" />
                      <span className={`flex-1 text-left text-[14px] font-semibold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>
                        {acc.name}
                      </span>
                      {isActive && <Check size={18} className="text-teal-700 dark:text-teal-400" />}
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
          onSelect={(i) => { setIcon(i); vibrate([5]) }}
        />
      </div>
    </div>
  )
}