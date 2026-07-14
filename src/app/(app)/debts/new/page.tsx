'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import { ChevronLeft, Check, Loader2, X, Wallet, Calendar, User, FileText, Tag } from 'lucide-react'
import { ContextProvider, useContext_ } from '@/components/ContextToggle'
import IconPicker from '@/components/IconPicker'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'
import { db } from '@/lib/db'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import MoneyInput from '@/components/MoneyInput'
import Skeleton from '@/components/Skeleton'

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

  const [initialized, setInitialized] = useState(!editId)
  const [saving, setSaving] = useState(false)

  const [personName, setPersonName] = useState('')
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

  // Carrega dados para edição
  useEffect(() => {
    if (editId && localDebt && localDebt.length > 0 && !initialized) {
      const data = localDebt[0] as any
      setPersonName(data.person_name)
      const numValue = Number(data.total_amount) || 0
      setAmountNum(numValue)
      setDueDate(data.due_date || '')
      setDescription(data.description || '')
      setCategoryId(data.category_id || '')
      setAccountId(data.account_id || '')
      setColor(data.color || '#14b8a6')
      setIcon(data.icon ? data.icon.charAt(0).toUpperCase() + data.icon.slice(1) : 'User')
      setDebtContext(data.context || 'dfl')
      setInitialized(true)
    } else if (!editId && !initialized) {
      setInitialized(true)
    }
  }, [editId, localDebt, initialized])

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

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <Loader2 className="animate-spin text-teal-600" size={40} />
      </div>
    )
  }

  const selectedCat = (localCategories || []).find((c: any) => c.id === categoryId) as any
  const selectedAcc = (localAccounts || []).find((a: any) => a.id === accountId) as any
  const IconComp = getDynamicIcon(icon)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-32 pt-4">
        <header className="sticky top-0 z-20 -mx-4 mb-5 border-b border-gray-100/80 bg-gray-50/90 px-4 py-3 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/90">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                vibrate([5])
                router.back()
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-transform active:scale-95 dark:text-gray-200"
              aria-label="Voltar"
            >
              <ChevronLeft size={24} />
            </button>

            <h2 className="text-[17px] font-bold tracking-tight text-gray-800 dark:text-gray-100">
              {editId ? 'Editar Empréstimo' : 'Novo Empréstimo'}
            </h2>

            <div className="h-10 w-10" />
          </div>
        </header>

        <main className="space-y-4">
          <section className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <label className="mb-3 block text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
              Contexto
            </label>

            <div className="grid grid-cols-2 gap-2 rounded-full bg-gray-100 p-1 dark:bg-slate-700/50">
              {CONTEXTS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    vibrate([5])
                    setDebtContext(c)
                  }}
                  className={`rounded-full py-3 text-[13px] font-bold transition-all active:scale-95 ${
                    debtContext === c
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {c === 'dfl' ? 'Empresa' : 'Pessoal'}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
              Nome
            </label>
            <div className="flex items-center gap-3">
              <User size={18} className="shrink-0 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full bg-transparent text-[16px] font-semibold text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-200 dark:placeholder:text-gray-600"
              />
            </div>
          </section>

          <section className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
              Valor
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-semibold text-gray-400">R$</span>
              <MoneyInput
                value={amountNum}
                onChange={(num) => setAmountNum(num)}
                placeholder="0,00"
                className="w-full bg-transparent text-[28px] font-bold tracking-tight text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-200 dark:placeholder:text-gray-600"
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                Vencimento
              </label>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="shrink-0 text-gray-400 dark:text-gray-500" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-transparent text-[14px] font-semibold text-gray-800 outline-none dark:text-gray-200"
                />
              </div>
            </div>

            <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                Descrição
              </label>
              <div className="flex items-center gap-2">
                <FileText size={16} className="shrink-0 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes..."
                  className="w-full bg-transparent text-[14px] font-semibold text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-200 dark:placeholder:text-gray-600"
                />
              </div>
            </div>
          </section>

          <div className="space-y-3">
            <button
              onClick={() => {
                vibrate([5])
                setShowCatModal(true)
              }}
              className="flex w-full items-center justify-between rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm transition-transform active:scale-[0.98] dark:border-slate-700/50 dark:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-gray-50 text-gray-400 shadow-sm dark:bg-slate-700/50 dark:text-gray-500">
                  <Tag size={18} />
                </div>
                <div className="text-left">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                    Categoria
                  </span>
                  <span className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">
                    {selectedCat ? selectedCat.name : 'Geral'}
                  </span>
                </div>
              </div>
              <ChevronLeft size={18} className="rotate-180 text-gray-300 dark:text-gray-600" />
            </button>

            <button
              onClick={() => {
                vibrate([5])
                setShowAccModal(true)
              }}
              className="flex w-full items-center justify-between rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm transition-transform active:scale-[0.98] dark:border-slate-700/50 dark:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-gray-50 text-gray-400 shadow-sm dark:bg-slate-700/50 dark:text-gray-500">
                  <Wallet size={18} />
                </div>
                <div className="text-left">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                    Conta para depósito
                  </span>
                  <span className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">
                    {selectedAcc ? selectedAcc.name : 'Nenhuma'}
                  </span>
                </div>
              </div>
              <ChevronLeft size={18} className="rotate-180 text-gray-300 dark:text-gray-600" />
            </button>
          </div>

          <section className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <label className="mb-3 block text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
              Cor
            </label>
            <div className="flex flex-wrap gap-3">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    vibrate([5])
                    setColor(c)
                  }}
                  className={`h-9 w-9 rounded-full transition-transform active:scale-90 ${
                    color === c
                      ? 'scale-125 ring-2 ring-gray-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-800'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </section>

          <button
            onClick={() => {
              vibrate([5])
              setShowIconModal(true)
            }}
            className="flex w-full items-center justify-between rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm transition-transform active:scale-[0.98] dark:border-slate-700/50 dark:bg-slate-800"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-[16px] shadow-sm"
                style={{ backgroundColor: `${color}20`, color }}
              >
                <IconComp size={20} />
              </div>
              <div className="text-left">
                <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                  Ícone
                </span>
                <span className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">
                  {icon}
                </span>
              </div>
            </div>
            <ChevronLeft size={18} className="rotate-180 text-gray-300 dark:text-gray-600" />
          </button>
        </main>

        <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent px-4 pb-4 pt-8 dark:from-slate-900 dark:via-slate-900/95">
          <button
            onClick={() => {
              vibrate([10, 50])
              handleSave()
            }}
            disabled={saving}
            className="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-[24px] bg-teal-600 py-4 text-[16px] font-bold text-white shadow-lg shadow-teal-600/25 transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? <Loader2 size={22} className="animate-spin" /> : <Check size={22} />}
            {editId ? 'Atualizar Empréstimo' : 'Criar Empréstimo'}
          </button>
        </div>
      </div>

      {showCatModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center" onClick={() => setShowCatModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div
            className="relative h-[70vh] w-full max-w-lg overflow-y-auto rounded-t-[32px] bg-white p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />
            <div className="sticky top-0 mb-4 flex items-center justify-between bg-white py-2 dark:bg-slate-800">
              <h3 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">Selecionar Categoria</h3>
              <button onClick={() => setShowCatModal(false)} className="rounded-full bg-gray-100 p-2 text-gray-400 active:scale-95 dark:bg-slate-700">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 pb-10">
              <button
                onClick={() => {
                  vibrate([5])
                  setCategoryId('')
                  setShowCatModal(false)
                }}
                className={`flex w-full items-center gap-4 rounded-[20px] border p-4 transition-transform active:scale-[0.98] ${
                  !categoryId
                    ? 'border-teal-100 bg-teal-50 dark:border-teal-800/50 dark:bg-teal-900/30'
                    : 'border-transparent bg-gray-50 dark:bg-slate-700/40 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white text-gray-400 shadow-sm dark:bg-slate-800">
                  <Tag size={20} />
                </div>
                <span className={`flex-1 text-left text-[15px] font-bold ${!categoryId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>
                  Geral
                </span>
                {!categoryId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
              </button>

              {(localCategories || []).map((cat: any) => {
                const CatIconComp = getDynamicIcon(cat.icon)
                const isActive = cat.id === categoryId

                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      vibrate([5])
                      setCategoryId(cat.id)
                      setShowCatModal(false)
                    }}
                    className={`flex w-full items-center gap-4 rounded-[20px] border p-4 transition-transform active:scale-[0.98] ${
                      isActive
                        ? 'border-teal-100 bg-teal-50 dark:border-teal-800/50 dark:bg-teal-900/30'
                        : 'border-transparent bg-gray-50 dark:bg-slate-700/40 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-[16px] text-white shadow-sm" style={{ backgroundColor: cat.color || '#14b8a6' }}>
                      <CatIconComp size={20} />
                    </div>
                    <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>
                      {cat.name}
                    </span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showAccModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center" onClick={() => setShowAccModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div
            className="relative h-[70vh] w-full max-w-lg overflow-y-auto rounded-t-[32px] bg-white p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />
            <div className="sticky top-0 mb-4 flex items-center justify-between bg-white py-2 dark:bg-slate-800">
              <h3 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">Contas</h3>
              <button onClick={() => setShowAccModal(false)} className="rounded-full bg-gray-100 p-2 text-gray-400 active:scale-95 dark:bg-slate-700">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 pb-10">
              <button
                onClick={() => {
                  vibrate([5])
                  setAccountId('')
                  setShowAccModal(false)
                }}
                className={`flex w-full items-center gap-4 rounded-[20px] border p-4 transition-transform active:scale-[0.98] ${
                  !accountId
                    ? 'border-teal-100 bg-teal-50 dark:border-teal-800/50 dark:bg-teal-900/30'
                    : 'border-transparent bg-gray-50 dark:bg-slate-700/40 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white text-gray-400 shadow-sm dark:bg-slate-800">
                  <Wallet size={20} />
                </div>
                <span className={`flex-1 text-left text-[15px] font-bold ${!accountId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>
                  Nenhuma (Apenas registro)
                </span>
                {!accountId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
              </button>

              {(localAccounts || []).map((acc: any) => {
                const isActive = acc.id === accountId

                return (
                  <button
                    key={acc.id}
                    onClick={() => {
                      vibrate([5])
                      setAccountId(acc.id)
                      setShowAccModal(false)
                    }}
                    className={`flex w-full items-center gap-4 rounded-[20px] border p-4 transition-transform active:scale-[0.98] ${
                      isActive
                        ? 'border-teal-100 bg-teal-50 dark:border-teal-800/50 dark:bg-teal-900/30'
                        : 'border-transparent bg-gray-50 dark:bg-slate-700/40 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-[16px] text-[14px] font-black text-white shadow-sm"
                      style={{ backgroundColor: acc.color || '#14b8a6' }}
                    >
                      {acc.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className={`flex-1 text-left text-[15px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>
                      {acc.name}
                    </span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      <IconPicker
        isOpen={showIconModal}
        onClose={() => setShowIconModal(false)}
        selectedIcon={icon}
        onSelect={(i) => {
          setIcon(i)
          vibrate([5])
        }}
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