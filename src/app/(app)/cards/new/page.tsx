'use client'

import { useState, Suspense, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronLeft,
  Tag,
  CreditCard,
  Calendar,
  PiggyBank,
  DollarSign,
  Check,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLocalData } from '@/hooks/useLocalData'
import { useCardById } from '@/hooks/useCardById'
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from '@/lib/hooks/useAuth'
import { safeAdd, safeUpdate } from '@/lib/safeDb'
import Skeleton from '@/components/Skeleton'

const PREDEFINED_COLORS = [
  '#2a9d8f',
  '#e76f51',
  '#264653',
  '#e9c46a',
  '#1d3557',
  '#e63946',
  '#8338ec',
  '#ffb703',
  '#3a0ca3',
  '#000000',
  '#ffffff',
  '#636e72',
]

const FLAGS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard']

function safeNum(val: any): number {
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

function NewCardContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { success, error: errorHaptic, vibrate } = useHapticFeedback()
  const contextData = useContext_()

  const rawEditId = searchParams.get("edit")
  const editId = useMemo(() => rawEditId?.trim() || null, [rawEditId])

  const effectiveContext =
    contextData?.effectiveContext ??
    (contextData?.appMode === 'personal_only' ? 'personal' : contextData?.context) ??
    'dfl'

  const { data: cardData, loading: cardLoading, notFound } = useCardById(editId)

  const { data: localAccounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context: effectiveContext },
  })

  const accounts = localAccounts || []

  const [initialized, setInitialized] = useState(!editId)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [flag, setFlag] = useState('')
  const [institution, setInstitution] = useState('')
  const [lastFour, setLastFour] = useState('')
  const [closingDay, setClosingDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [color, setColor] = useState(PREDEFINED_COLORS[0])
  const [limitAmount, setLimitAmount] = useState('0,00')
  const [showAccountModal, setShowAccountModal] = useState(false)

  const selectedAccount = useMemo(
    () => accounts.find((a: any) => a.id === paymentAccountId),
    [accounts, paymentAccountId]
  )

  useEffect(() => {
    if (editId && cardData && !initialized) {
      setName(cardData.name || '')
      setFlag(cardData.flag || '')
      setInstitution(cardData.institution || '')
      setLastFour(cardData.last_four || '')
      setClosingDay(cardData.closing_day ? String(cardData.closing_day) : '')
      setDueDay(cardData.due_day ? String(cardData.due_day) : '')
      setPaymentAccountId(cardData.payment_account_id || '')
      setColor(cardData.color || PREDEFINED_COLORS[0])
      
      const limit = Number(cardData.limit_amount) || 0
      setLimitAmount(limit.toFixed(2).replace('.', ','))
      
      setInitialized(true)
    }

    if (!editId && !initialized) {
      setInitialized(true)
    }
  }, [editId, cardData, initialized])

  if (editId && notFound && !cardLoading) {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 items-center justify-center px-4">
        <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <CreditCard size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Cartão não encontrado</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs mb-6">
          O cartão que você está tentando editar pode ter sido excluído ou você não tem permissão para acessá-lo.
        </p>
        <button
          onClick={() => router.push('/cards')}
          className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-full font-semibold transition-colors active:scale-95"
        >
          Voltar para listagem
        </button>
      </div>
    )
  }

  if (editId && cardLoading) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f6f7f8] dark:bg-slate-950 transition-colors duration-300">
        <div className="px-4 pt-6">
          <Skeleton count={6} />
        </div>
      </div>
    )
  }

  if (!initialized) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f6f7f8] dark:bg-slate-950 transition-colors duration-300">
        <div className="px-4 pt-6">
          <Skeleton count={6} />
        </div>
      </div>
    )
  }

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value === '') value = '0'
    const formatted = (safeNum(value) / 100).toFixed(2).replace('.', ',')
    setLimitAmount(formatted)
  }

  const handleDayChange = (val: string, setter: (v: string) => void) => {
    const numeric = val.replace(/\D/g, '').slice(0, 2)
    if (numeric === '' || (Number(numeric) >= 1 && Number(numeric) <= 31)) {
      setter(numeric)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Por favor, informe o nome do cartão.', 'warning')
      errorHaptic()
      return
    }

    if (!user?.id) {
      showToast('Usuário não autenticado.', 'error')
      errorHaptic()
      return
    }

    setSaving(true)

    const payload = {
      user_id: user.id,
      name: name.trim(),
      flag: flag || null,
      institution: institution.trim() || null,
      last_four: lastFour || null,
      closing_day: closingDay ? parseInt(closingDay, 10) : 1,
      due_day: dueDay ? parseInt(dueDay, 10) : 10,
      payment_account_id: paymentAccountId || null,
      color,
      limit_amount: safeNum(limitAmount.replace(/\./g, '').replace(',', '.')),
      is_archived: false,
      context: effectiveContext,
      updated_at: new Date().toISOString(),
    }

    try {
      if (editId) {
        const result = await safeUpdate('credit_cards', editId, payload)
        if (!result?.success) throw new Error(result?.error || 'Erro ao atualizar cartão')
        showToast('✅ Cartão atualizado!', 'success')
      } else {
        const newId = crypto.randomUUID()
        const fullPayload = {
          id: newId,
          ...payload,
          created_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        const result = await safeAdd('credit_cards', fullPayload)
        if (!result?.success) throw new Error(result?.error || 'Erro ao criar cartão')
        showToast('✅ Cartão criado!', 'success')
      }

      success()
      router.push('/cards')
    } catch (error: any) {
      showToast(`❌ ${error?.message || 'Erro inesperado'}`, 'error')
      errorHaptic()
    } finally {
      setSaving(false)
    }
  }

  const renderFlagIcon = (cardFlag: string) => {
    switch (cardFlag) {
      case 'Visa':
        return <span className="text-[10px] font-bold italic text-blue-800">VISA</span>
      case 'Mastercard':
        return (
          <div className="flex items-center gap-0.5">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <div className="w-3 h-3 bg-yellow-500 rounded-full -ml-1.5" />
          </div>
        )
      case 'Elo':
        return <span className="text-[10px] font-bold text-blue-600">elo</span>
      case 'Amex':
        return <span className="text-[9px] font-bold text-blue-500">AMEX</span>
      case 'Hipercard':
        return <span className="text-[9px] font-bold text-red-400">HIPER</span>
      default:
        return <CreditCard size={14} />
    }
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f6f7f8] dark:bg-slate-950 text-gray-900 dark:text-white pb-32 transition-colors duration-300">
      <div
        className="relative px-4 pt-6 pb-8 overflow-hidden"
        style={{ background: `linear-gradient(180deg, ${color}, ${color}dd)` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_35%)]" />
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => {
                vibrate([5])
                router.back()
              }}
              className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white active:scale-[0.98] transition-all"
            >
              <ChevronLeft size={22} />
            </button>
          </div>

          <div className="rounded-[30px] bg-white/10 backdrop-blur-md border border-white/15 shadow-[0_12px_32px_rgba(0,0,0,0.14)] p-5">
            <div className="flex items-start justify-between gap-4 mb-8">
              <div className="min-w-0 flex-1">
                <p className="text-white/70 text-[12px] font-medium mb-2">
                  {editId ? 'Editar cartão' : 'Novo cartão'}
                </p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Nubank, Inter"
                  className="bg-transparent text-white text-[30px] leading-none font-light outline-none w-full placeholder:text-white/45"
                  autoFocus
                />
              </div>
              <div className="w-14 h-10 rounded-[14px] flex items-center justify-center border border-white/15 bg-black/10 shrink-0">
                <CreditCard size={20} className="text-white" />
              </div>
            </div>

            <div className="flex items-center justify-between text-white/80 text-[12px] gap-3">
              <span className="truncate">{flag || 'Sem bandeira'}</span>
              <span className="shrink-0">{lastFour ? `•••• ${lastFour}` : '•••• 0000'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3 relative z-10 space-y-4">
        <section className="bg-white dark:bg-slate-900 rounded-[28px] p-4 shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="mb-4">
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">
              Dados principais
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3 text-gray-700 dark:text-gray-300">
                <Tag size={16} />
                <span className="text-[13px] font-semibold">Bandeira</span>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {FLAGS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      vibrate([5])
                      setFlag(f)
                    }}
                    className={`flex items-center gap-2 px-4 h-11 rounded-full text-[13px] whitespace-nowrap border transition-all active:scale-[0.98] ${
                      flag === f
                        ? 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-900/20 dark:border-teal-800 dark:text-teal-300'
                        : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300'
                    }`}
                  >
                    {renderFlagIcon(f)}
                    <span className="font-medium">{f}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-[1fr_96px] gap-3">
              <div className="rounded-[22px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-3">
                <label className="text-[12px] font-medium text-gray-500 block mb-1">
                  Instituição
                </label>
                <input
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Opcional"
                  className="w-full bg-transparent outline-none text-[14px] font-semibold text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="rounded-[22px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-3">
                <label className="text-[12px] font-medium text-gray-500 block mb-1">Final</label>
                <input
                  value={lastFour}
                  onChange={(e) => setLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="0000"
                  className="w-full bg-transparent outline-none text-[14px] font-bold text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-[28px] p-4 shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="mb-4">
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">
              Ciclo da fatura
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[22px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-3">
              <div className="flex items-center gap-2 mb-2 text-gray-500">
                <Calendar size={16} />
                <span className="text-[12px] font-medium">Fechamento</span>
              </div>
              <input
                type="text"
                value={closingDay}
                onChange={(e) => handleDayChange(e.target.value, setClosingDay)}
                placeholder="Dia"
                className="w-full bg-transparent outline-none text-[18px] font-bold text-gray-900 dark:text-gray-100"
              />
            </div>

            <div className="rounded-[22px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-3">
              <div className="flex items-center gap-2 mb-2 text-gray-500">
                <Calendar size={16} />
                <span className="text-[12px] font-medium">Vencimento</span>
              </div>
              <input
                type="text"
                value={dueDay}
                onChange={(e) => handleDayChange(e.target.value, setDueDay)}
                placeholder="Dia"
                className="w-full bg-transparent outline-none text-[18px] font-bold text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-[28px] p-4 shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="mb-4">
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">
              Financeiro
            </h2>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                vibrate([5])
                setShowAccountModal(true)
              }}
              className="w-full rounded-[22px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-slate-700 flex items-center justify-center text-gray-500">
                <PiggyBank size={18} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[12px] font-medium text-gray-500">Conta para pagamento</p>
                <p
                  className={`text-[14px] font-semibold ${
                    selectedAccount
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-400'
                  }`}
                >
                  {selectedAccount ? selectedAccount.name : 'Selecionar conta'}
                </p>
              </div>
            </button>

            <div className="rounded-[24px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-4">
              <div className="flex items-center gap-2 mb-3 text-gray-500">
                <DollarSign size={16} />
                <span className="text-[12px] font-medium">Limite total</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-bold text-xl">R$</span>
                <input
                  type="text"
                  value={limitAmount}
                  onChange={handleLimitChange}
                  className="bg-transparent w-full outline-none font-black text-gray-900 dark:text-gray-100 text-[30px]"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-[28px] p-4 shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="mb-4">
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">
              Aparência
            </h2>
          </div>

          <div className="flex flex-wrap gap-3">
            {PREDEFINED_COLORS.slice(0, 8).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  color === c
                    ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-slate-900'
                    : ''
                }`}
                style={{ backgroundColor: c }}
              >
                {color === c && <Check size={16} className="text-white" />}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-6 pt-3 bg-gradient-to-t from-[#f6f7f8] dark:from-slate-950 to-transparent z-40">
        <button
          onClick={() => {
            vibrate([5])
            handleSave()
          }}
          disabled={saving}
          className="w-full h-14 rounded-[22px] bg-emerald-700 text-white font-bold shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={22} /> : <Check size={22} />}
          <span>{saving ? 'Salvando...' : editId ? 'Atualizar cartão' : 'Criar cartão'}</span>
        </button>
      </div>

      {showAccountModal && (
        <div
          className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50"
          onClick={() => setShowAccountModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[32px] p-5 h-[60vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4" />

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentAccountId('')
                  setShowAccountModal(false)
                }}
                className="w-full p-3 flex items-center gap-4 rounded-[20px] hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                <span className="flex-1 text-left font-medium text-gray-800 dark:text-gray-200">
                  Nenhuma conta
                </span>
              </button>

              {accounts.map((acc: any) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => {
                    setPaymentAccountId(acc.id)
                    setShowAccountModal(false)
                  }}
                  className="w-full p-3 flex items-center gap-4 rounded-[20px] hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  <div
                    className="w-10 h-10 rounded-[14px] flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: acc.color || '#14b8a6' }}
                  >
                    {(acc.name || '').substring(0, 2).toUpperCase()}
                  </div>
                  <span className="flex-1 text-left font-medium text-gray-800 dark:text-gray-200">
                    {acc.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function NewCardPage() {
  return (
    <Suspense fallback={<Skeleton count={6} />}>
      <NewCardContent />
    </Suspense>
  )
}