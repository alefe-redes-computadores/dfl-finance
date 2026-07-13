'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  Plus, X, Zap, ArrowDown, ArrowUp, Wallet, Check,
  Coffee, ShoppingCart, Car, Home, Smartphone, Utensils, Heart,
  Briefcase, Gamepad2, BookOpen, Loader2, ChevronRight,
  TrendingUp, PiggyBank, Gift, Repeat, Coins, Shield
} from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/contexts/ToastContext'
import { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import BankLogo from '@/components/BankLogo'
import MoneyInput from '@/components/MoneyInput'
import IconPicker from '@/components/IconPicker'

const EXPENSE_CATS = [
  { label: 'Café', color: '#8B4513', icon: Coffee },
  { label: 'Compras', color: '#FF6B6B', icon: ShoppingCart },
  { label: 'Transporte', color: '#4ECDC4', icon: Car },
  { label: 'Alimentação', color: '#FF8C00', icon: Utensils },
  { label: 'Celular', color: '#6C5CE7', icon: Smartphone },
  { label: 'Saúde', color: '#E74C3C', icon: Heart },
  { label: 'Trabalho', color: '#2C3E50', icon: Briefcase },
  { label: 'Lazer', color: '#9B59B6', icon: Gamepad2 },
  { label: 'Estudos', color: '#3498DB', icon: BookOpen },
]

const INCOME_CATS = [
  { label: 'Salário', color: '#2E7D32', icon: Briefcase },
  { label: 'Freelance', color: '#1565C0', icon: TrendingUp },
  { label: 'Economia', color: '#6A1B9A', icon: PiggyBank },
  { label: 'Presente', color: '#E91E63', icon: Gift },
  { label: 'Reembolso', color: '#00838F', icon: Repeat },
  { label: 'Aluguel', color: '#4E342E', icon: Home },
  { label: 'Venda', color: '#33691E', icon: Wallet },
  { label: 'Dividendos', color: '#F57F17', icon: Coins },
  { label: 'Seguro', color: '#BF360C', icon: Shield },
]

type QuickType = 'expense' | 'income'
type QuickContext = 'dfl' | 'personal'

type Props = {
  onSave?: () => void
}

export default function FAB({ onSave }: Props) {
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()
  const { safeAdd, safeUpdate } = useSafeDb()
  const { vibrate, success, error: hapticError } = useHapticFeedback()

  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showAccModal, setShowAccModal] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)

  const [quickType, setQuickType] = useState<QuickType>('expense')
  const [quickContext, setQuickContext] = useState<QuickContext>('dfl')
  const [amount, setAmount] = useState<number>(0)
  const [category, setCategory] = useState('')
  const [accountId, setAccountId] = useState('')
  const [saving, setSaving] = useState(false)

  const [position, setPosition] = useState({ x: 20, y: 80 })
  const [isDragging, setIsDragging] = useState(false)
  const [showDeleteZone, setShowDeleteZone] = useState(false)

  const isTouchMove = useRef(false)
  const fabRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const { data: allAccountsRaw } = useLocalData({ table: 'accounts' as any })

  const allAccounts = useMemo(() => {
    return Array.isArray(allAccountsRaw) ? allAccountsRaw : []
  }, [allAccountsRaw])

  useEffect(() => {
    if (!showModal) return
    setQuickContext(context === 'personal' ? 'personal' : 'dfl')
  }, [showModal, context])

  const accounts = useMemo(() => {
    return allAccounts
      .filter((a: any) => (a?.context ?? 'dfl') === quickContext)
      .sort((a: any, b: any) => String(a?.name ?? '').localeCompare(String(b?.name ?? '')))
  }, [allAccounts, quickContext])

  const selectedAccount = useMemo(() => {
    return accounts.find((a: any) => a?.id === accountId) ?? null
  }, [accounts, accountId])

  const cats = useMemo(() => {
    return quickType === 'expense' ? EXPENSE_CATS : INCOME_CATS
  }, [quickType])

  useEffect(() => {
    if (!accountId) return
    const exists = accounts.some((a: any) => a?.id === accountId)
    if (!exists) setAccountId('')
  }, [accounts, accountId])

  const resetForm = useCallback(() => {
    setAmount(0)
    setCategory('')
    setAccountId('')
    setSaving(false)
  }, [])

  const closeAll = useCallback(() => {
    setShowAccModal(false)
    setShowIconPicker(false)
    setShowModal(false)
  }, [])

  const handleTouchStart = () => {
    isTouchMove.current = false
    setIsDragging(true)
    vibrate([10])
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!mounted) return
    isTouchMove.current = true
    setShowDeleteZone(true)

    const touch = e.touches?.[0]
    if (!touch) return

    const fabSize = 56
    const margin = 10
    const newX = window.innerWidth - touch.clientX - fabSize / 2
    const newY = window.innerHeight - touch.clientY - fabSize / 2

    const clampedX = Math.max(margin, Math.min(window.innerWidth - fabSize - margin, newX))
    const clampedY = Math.max(80, Math.min(window.innerHeight - fabSize - margin, newY))

    setPosition({ x: clampedX, y: clampedY })
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!mounted) return

    setIsDragging(false)
    setShowDeleteZone(false)

    if (!isTouchMove.current) {
      vibrate([10])
      setShowModal(true)
      return
    }

    const touch = e.changedTouches?.[0]
    if (!touch) return

    if (touch.clientY > window.innerHeight * 0.8) {
      setVisible(false)
      hapticError()
      showToast('Botão oculto até a próxima sessão.', 'info')
      return
    }

    vibrate([5])
  }

  const save = async () => {
    if (!user?.id) {
      hapticError()
      showToast('Faça login para salvar.', 'warning')
      return
    }

    if (!amount || Number(amount) <= 0) {
      hapticError()
      showToast('Informe um valor válido.', 'warning')
      return
    }

    try {
      setSaving(true)

      const txId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`

      const selected = accounts.find((a: any) => a?.id === accountId)

      if (accountId && selected) {
        const currentBalance = Number(selected?.balance ?? 0)
        const nextBalance =
          quickType === 'income'
            ? currentBalance + Number(amount)
            : currentBalance - Number(amount)

        const accountUpdatePayload = {
          balance: nextBalance,
          updated_at: new Date().toISOString(),
          updatedat: new Date().toISOString(),
          sync_status: 'pending',
          syncstatus: 'pending',
          sync_attempts: 0,
          syncattempts: 0,
        }

        const accRes = await safeUpdate('accounts', accountId, accountUpdatePayload as any)

        if (!accRes?.success) {
          throw new Error(accRes?.error || 'Falha ao atualizar saldo da conta.')
        }
      }

      const nowIso = new Date().toISOString()
      const today = format(new Date(), 'yyyy-MM-dd')

      const payload: any = {
        id: txId,
        user_id: user.id,
        userid: user.id,

        type: quickType,
        amount: Number(amount),

        description:
          category || (quickType === 'income' ? 'Receita rápida' : 'Despesa rápida'),

        date: today,
        status: 'done',
        context: quickContext,

        category_name: category || null,
        categoryname: category || null,

        account_id: accountId || null,
        accountid: accountId || null,

        created_at: nowIso,
        createdat: nowIso,
        updated_at: nowIso,
        updatedat: nowIso,

        sync_status: 'pending',
        syncstatus: 'pending',
        sync_attempts: 0,
        syncattempts: 0,
      }

      const res = await safeAdd('transactions', payload)

      if (!res?.success) {
        throw new Error(res?.error || 'Falha ao salvar transação.')
      }

      success()
      showToast(
        `${quickType === 'income' ? 'Receita' : 'Despesa'} salva com sucesso.`,
        'success'
      )

      closeAll()
      resetForm()
      onSave?.()
    } catch (err: any) {
      console.error('FAB save error:', err)
      hapticError()
      showToast(`Erro ao salvar: ${err?.message || 'erro inesperado'}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!mounted || !visible) return null

  return (
    <>
      {showDeleteZone && (
        <div className="fixed bottom-6 left-0 right-0 z-[499] flex justify-center pointer-events-none">
          <div className="bg-red-500 text-white px-6 py-4 rounded-[24px] shadow-2xl flex items-center gap-2 font-bold text-sm shadow-red-500/30">
            <X size={20} />
            Solte aqui para ocultar
          </div>
        </div>
      )}

      <button
        ref={fabRef}
        type="button"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          vibrate([10])
          setShowModal(true)
        }}
        className={`fixed z-[500] w-[56px] h-[56px] rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-90 touch-none ${
          isDragging ? 'scale-110 shadow-2xl opacity-90' : ''
        } ${
          quickType === 'expense'
            ? 'bg-red-500 shadow-red-500/30'
            : 'bg-emerald-500 shadow-emerald-500/30'
        } text-white`}
        style={{ right: `${position.x}px`, bottom: `${position.y}px` }}
        aria-label={quickType === 'expense' ? 'Nova despesa' : 'Nova receita'}
      >
        {quickType === 'expense' ? <ArrowDown size={28} /> : <ArrowUp size={28} />}
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-[600] flex items-end justify-center"
          onClick={closeAll}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          <div
            className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full mx-auto mb-6" />

            <div className="flex items-center justify-between mb-8">
              <h2 className="font-bold text-xl text-gray-800 dark:text-gray-100 tracking-tight">
                Ação rápida
              </h2>
              <button
                type="button"
                onClick={closeAll}
                className="p-2 text-gray-400 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-full transition-colors active:scale-95"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="flex bg-gray-50 dark:bg-slate-700 p-1 rounded-full border border-gray-100 dark:border-slate-600">
                <button
                  type="button"
                  onClick={() => {
                    setQuickType('expense')
                    vibrate([10])
                  }}
                  className={`flex-1 py-2.5 rounded-full font-bold text-[13px] transition-all active:scale-[0.95] ${
                    quickType === 'expense'
                      ? 'bg-white dark:bg-slate-800 text-red-500 shadow-sm'
                      : 'text-gray-500'
                  }`}
                >
                  Despesa
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setQuickType('income')
                    vibrate([10])
                  }}
                  className={`flex-1 py-2.5 rounded-full font-bold text-[13px] transition-all active:scale-[0.95] ${
                    quickType === 'income'
                      ? 'bg-white dark:bg-slate-800 text-emerald-500 shadow-sm'
                      : 'text-gray-500'
                  }`}
                >
                  Receita
                </button>
              </div>

              <div className="flex bg-gray-50 dark:bg-slate-700 p-1 rounded-full border border-gray-100 dark:border-slate-600">
                {(['dfl', 'personal'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setQuickContext(c)
                      setAccountId('')
                      vibrate([10])
                    }}
                    className={`flex-1 py-2.5 rounded-full font-bold text-[13px] transition-all active:scale-[0.95] ${
                      quickContext === c
                        ? 'bg-teal-700 text-white shadow-sm'
                        : 'text-gray-500'
                    }`}
                  >
                    {c === 'dfl' ? 'Empresa' : 'Pessoal'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700/50 rounded-[24px] p-5 border border-gray-100 dark:border-slate-700">
                <span className="text-2xl text-gray-400 font-medium">R$</span>
                <MoneyInput
                  value={Number.isFinite(amount) ? amount : 0}
                  onChange={(n) => setAmount(Number(n) || 0)}
                  className="text-4xl font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-100 placeholder:text-gray-300"
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 block ml-2">
                Conta destino
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowAccModal(true)
                  vibrate([10])
                }}
                className="w-full bg-gray-50 dark:bg-slate-700/50 p-4 rounded-[24px] border border-gray-100 dark:border-slate-700 flex items-center justify-between hover:bg-gray-100 transition-colors active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  {selectedAccount ? (
                    <BankLogo
                      color={selectedAccount.color}
                      name={selectedAccount.name}
                      size="md"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-slate-600 flex items-center justify-center shadow-sm">
                      <Wallet size={20} className="text-gray-400" />
                    </div>
                  )}
                  <span
                    className={`font-bold text-[15px] ${
                      selectedAccount
                        ? 'text-gray-800 dark:text-gray-200'
                        : 'text-gray-400'
                    }`}
                  >
                    {selectedAccount ? selectedAccount.name : 'Selecionar conta'}
                  </span>
                </div>
                <ChevronRight size={20} className="text-gray-300 dark:text-gray-600" />
              </button>
            </div>

            <div className="mb-8">
              <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 block ml-2">
                Categoria
              </label>

              <div className="grid grid-cols-4 gap-3">
                {cats.map((c) => {
                  const Icon = c.icon
                  const selected = category === c.label

                  return (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => {
                        setCategory(selected ? '' : c.label)
                        vibrate([5])
                      }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-[20px] transition-all active:scale-95 ${
                        selected
                          ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 shadow-sm'
                          : 'bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-[14px] flex items-center justify-center"
                        style={{ backgroundColor: `${c.color}20`, color: c.color }}
                      >
                        <Icon size={20} />
                      </div>
                      <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 truncate w-full text-center">
                        {c.label}
                      </span>
                    </button>
                  )
                })}

                <button
                  type="button"
                  onClick={() => {
                    setShowIconPicker(true)
                    vibrate([10])
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-[20px] bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 border border-gray-200 dark:border-slate-600 border-dashed active:scale-95"
                >
                  <div className="w-10 h-10 rounded-[14px] flex items-center justify-center bg-gray-200 dark:bg-slate-600 text-gray-500">
                    <Plus size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate w-full text-center">
                    Outro
                  </span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                vibrate([10, 50])
                save()
              }}
              disabled={saving || Number(amount) <= 0}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[24px] font-bold text-[16px] disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-teal-600/30"
            >
              {saving ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <>
                  <Zap size={22} />
                  Salvar lançamento
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {showAccModal && (
        <div
          className="fixed inset-0 z-[610] flex items-end justify-center"
          onClick={() => setShowAccModal(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-t-[32px] p-6 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">
                Escolha a conta
              </h3>
              <button
                type="button"
                onClick={() => setShowAccModal(false)}
                className="p-2 bg-gray-100 dark:bg-slate-700 rounded-full active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {accounts.length === 0 ? (
                <p className="text-gray-400 text-sm font-medium text-center py-10">
                  Nenhuma conta encontrada neste contexto.
                </p>
              ) : (
                accounts.map((acc: any) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setAccountId(acc.id)
                      setShowAccModal(false)
                      vibrate([10])
                    }}
                    className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-colors border active:scale-[0.98] ${
                      acc.id === accountId
                        ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800'
                        : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:bg-gray-50'
                    }`}
                  >
                    <BankLogo color={acc.color} name={acc.name} size="md" />

                    <div className="text-left flex-1 min-w-0">
                      <p className="font-bold text-[15px] text-gray-800 dark:text-gray-200 truncate">
                        {acc.name}
                      </p>
                      <p className="text-xs font-medium text-gray-500 mt-0.5">
                        R$ {Number(acc.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    {acc.id === accountId && <Check size={20} className="text-teal-600" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <IconPicker
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        selectedIcon={category}
        onSelect={(icon) => {
          setCategory(icon)
          setShowIconPicker(false)
          vibrate([10])
        }}
      />
    </>
  )
}