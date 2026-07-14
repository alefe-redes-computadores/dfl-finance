'use client'

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  ChevronLeft,
  ChevronRight,
  Tag,
  Landmark,
  CreditCard,
  Calendar,
  PiggyBank,
  Palette,
  DollarSign,
  Check,
  Loader2,
  X,
  Wallet,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLocalData } from '@/hooks/useLocalData'
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSafeDb } from '@/hooks/useSafeDb'
import { safeAdd } from '@/lib/safeDb'

const PREDEFINED_COLORS = ['#2a9d8f', '#e76f51', '#264653', '#e9c46a', '#1d3557', '#e63946', '#8338ec', '#ffb703', '#3a0ca3', '#000000', '#ffffff', '#636e72']
const FLAGS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard']

function lightTap() {
  if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
}

function safeNum(val: any): number {
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

function NewCardContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const { safeUpdate, safeDelete } = useSafeDb()
  const { effectiveContext } = useContext_()

  const [showColorPicker, setShowColorPicker] = useState(false)
  const [tempColor, setTempColor] = useState(PREDEFINED_COLORS[0])

  const [name, setName] = useState('')
  const [flag, setFlag] = useState('')
  const [institution, setInstitution] = useState('')
  const [lastFour, setLastFour] = useState('')
  const [closingDay, setClosingDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [color, setColor] = useState(PREDEFINED_COLORS[0])
  const [limitAmount, setLimitAmount] = useState('0,00')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showDeleteSheet, setShowDeleteSheet] = useState(false)

  const { data: localAccounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context: effectiveContext || 'dfl' },
  })
  const accounts = localAccounts || []

  const { data: localCards, loading: cardsLoading } = useLocalData({
    table: 'credit_cards' as any,
    filters: { id: editId as string },
  })

  useEffect(() => {
    if (!editId) {
      setInitialized(true)
      return
    }

    if (!cardsLoading && !initialized && localCards?.length > 0) {
      const cardData = localCards[0] as any
      setName(cardData.name || '')
      setFlag(cardData.flag || '')
      setInstitution(cardData.institution || '')
      setLastFour(cardData.last_four || '')
      setClosingDay(String(cardData.closing_day || ''))
      setDueDay(String(cardData.due_day || ''))
      setPaymentAccountId(cardData.payment_account_id || '')
      setColor(cardData.color || PREDEFINED_COLORS[0])
      const limit = safeNum(cardData.limit_amount)
      setLimitAmount(limit.toFixed(2).replace('.', ','))
      setInitialized(true)
    }
  }, [cardsLoading, localCards, initialized, editId])

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value === '') value = '0'
    const formatted = (safeNum(value) / 100).toFixed(2).replace('.', ',')
    setLimitAmount(formatted)
  }

  const handleDayChange = (val: string, setter: (v: string) => void) => {
    const numeric = val.replace(/\D/g, '')
    if (numeric === '' || (Number(numeric) >= 1 && Number(numeric) <= 31)) {
      setter(numeric)
    }
  }

  const handleSave = async () => {
    if (!(name || '').trim()) {
      showToast('Por favor, informe o nome do cartão.', 'warning')
      errorHaptic()
      return
    }

    if (!user?.id) {
      showToast('Sessão expirada.', 'error')
      errorHaptic()
      return
    }

    setSaving(true)

    const payload = {
      name: name.trim(),
      flag: flag || null,
      institution: institution.trim() || null,
      last_four: lastFour || null,
      closing_day: closingDay ? parseInt(closingDay) : 1,
      due_day: dueDay ? parseInt(dueDay) : 10,
      payment_account_id: paymentAccountId || null,
      color,
      limit_amount: safeNum(limitAmount.replace(/\./g, '').replace(',', '.')),
      updated_at: new Date().toISOString(),
      context: effectiveContext,
      user_id: user.id,
    }

    try {
      let result

      if (editId) {
        result = await safeUpdate('credit_cards', editId, { ...payload, id: editId })
        if (result.success) {
          success()
          showToast('✅ Cartão atualizado com sucesso!', 'success')
        } else {
          throw new Error(result.error || 'Erro ao atualizar cartão')
        }
      } else {
        const newId = crypto.randomUUID()
        const newPayload = {
          ...payload,
          id: newId,
          is_archived: false,
          created_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        result = await safeAdd('credit_cards', newPayload)
        if (result.success) {
          success()
          showToast('✅ Cartão criado com sucesso!', 'success')
        } else {
          throw new Error(result.error || 'Erro ao criar cartão')
        }
      }

      router.push('/cards')
    } catch (error: any) {
      showToast(`❌ ${error.message}`, 'error')
      errorHaptic()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editId) return
    setDeleting(true)
    try {
      const result = await safeDelete('credit_cards', editId)
      if (!result.success) throw new Error(result.error)

      showToast('Cartão excluído!', 'info')
      success()
      setShowDeleteSheet(false)
      router.push('/cards')
    } catch (error: any) {
      showToast(`Erro ao excluir: ${error.message}`, 'error')
      errorHaptic()
    } finally {
      setDeleting(false)
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

  const renderCardLogo = (cardFlag: string) => {
    switch (cardFlag) {
      case 'Visa':
        return <span className="text-xl font-bold italic tracking-tighter text-white">VISA</span>
      case 'Mastercard':
        return (
          <div className="flex">
            <div className="w-5 h-5 bg-red-500 rounded-full mix-blend-multiply opacity-90" />
            <div className="w-5 h-5 bg-yellow-500 rounded-full mix-blend-multiply -ml-2 opacity-90" />
          </div>
        )
      case 'Elo':
        return <span className="text-sm font-bold tracking-tight text-white">elo</span>
      case 'Amex':
        return <span className="text-[10px] font-bold text-white bg-blue-500 px-1 py-0.5 rounded">AMEX</span>
      case 'Hipercard':
        return <span className="text-xs font-bold text-red-100 italic">HIPER</span>
      default:
        return <CreditCard size={20} className="text-white" />
    }
  }

  const selectedAccount = accounts.find((a: any) => a.id === paymentAccountId)

  if (cardsLoading && !initialized && editId) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-slate-950 transition-colors duration-300">
        <div className="max-w-md mx-auto px-4 pt-6 pb-24 animate-pulse">
          <div
            className="rounded-[32px] h-[190px] mb-4"
            style={{ background: 'linear-gradient(180deg, #d9dee3 0%, #cfd5db 100%)' }}
            aria-busy="true"
          />
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-[28px] p-4 border border-gray-100 dark:border-slate-800">
              <div className="h-4 w-28 rounded-full bg-gray-200 dark:bg-slate-700 mb-4" />
              <div className="h-12 rounded-[20px] bg-gray-100 dark:bg-slate-800 mb-3" />
              <div className="h-20 rounded-[20px] bg-gray-100 dark:bg-slate-800" />
            </div>
            <div className="h-14 rounded-[22px] bg-gray-200 dark:bg-slate-800" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f5f7f8] dark:bg-slate-950 text-gray-900 dark:text-white pb-32 transition-colors duration-300">
      <div
        className="relative px-4 pt-6 pb-10 overflow-hidden"
        style={{ background: `linear-gradient(180deg, ${color}, ${color}e6)` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_35%)]" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#f5f7f8] dark:from-slate-950 to-transparent" />

        <div className="relative">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => {
                lightTap()
                router.back()
              }}
              className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white active:scale-[0.98] transition-all"
            >
              <ChevronLeft size={22} />
            </button>

            {editId && (
              <button
                onClick={() => {
                  lightTap()
                  setShowDeleteSheet(true)
                }}
                disabled={deleting}
                className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white/85 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {deleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={19} />}
              </button>
            )}
          </div>

          <div className="rounded-[30px] bg-white/10 backdrop-blur-md border border-white/15 shadow-[0_12px_36px_rgba(0,0,0,0.14)] px-5 pt-5 pb-4">
            <div className="flex items-start justify-between gap-4 mb-7">
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
                {renderCardLogo(flag)}
              </div>
            </div>

            <div className="flex items-center justify-between text-white/80 text-[12px]">
              <span>{flag || 'Sem bandeira'}</span>
              <span>{lastFour ? `•••• ${lastFour}` : '•••• 0000'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 relative z-10 space-y-4">
        <section className="bg-white dark:bg-slate-900 rounded-[28px] p-4 shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="mb-4">
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Dados principais</h2>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
              {editId ? 'Atualize as informações básicas do cartão.' : 'Defina as informações básicas do cartão.'}
            </p>
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
                    onClick={() => {
                      lightTap()
                      setFlag(f)
                    }}
                    className={`flex items-center gap-2 px-4 h-11 rounded-full text-[13px] whitespace-nowrap border transition-all active:scale-[0.98] ${
                      flag === f
                        ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300'
                        : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {renderFlagIcon(f)}
                    <span className="font-medium">{f}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-[1fr_96px] gap-3">
              <div className="rounded-[22px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-3 border border-transparent">
                <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
                  <Landmark size={15} />
                  <label className="text-[12px] font-medium">Instituição</label>
                </div>
                <input
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Nome opcional"
                  className="w-full bg-transparent outline-none text-[14px] font-semibold text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                />
              </div>

              <div className="rounded-[22px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-3 border border-transparent">
                <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
                  <CreditCard size={15} />
                  <label className="text-[12px] font-medium">Final</label>
                </div>
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
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Ciclo da fatura</h2>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
              Escolha os dias de fechamento e vencimento.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[22px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-3">
              <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
                <Calendar size={16} />
                <span className="text-[12px] font-medium">Fechamento</span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={closingDay}
                onChange={(e) => handleDayChange(e.target.value, setClosingDay)}
                placeholder="Dia"
                className="w-full bg-transparent outline-none text-[18px] font-bold text-gray-900 dark:text-gray-100"
              />
            </div>

            <div className="rounded-[22px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-3">
              <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
                <Calendar size={16} />
                <span className="text-[12px] font-medium">Vencimento</span>
              </div>
              <input
                type="text"
                inputMode="numeric"
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
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Financeiro</h2>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
              Configure limite e conta de pagamento.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                lightTap()
                setShowAccountModal(true)
              }}
              className="w-full rounded-[22px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-4 flex items-center gap-3 active:scale-[0.99] transition-all"
            >
              <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 flex items-center justify-center text-gray-500 dark:text-gray-300 shrink-0">
                <PiggyBank size={18} />
              </div>

              <div className="flex-1 text-left min-w-0">
                <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Conta para pagamento</p>
                <p
                  className={`text-[14px] font-semibold truncate ${
                    selectedAccount ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {selectedAccount ? selectedAccount.name : 'Selecionar conta opcional'}
                </p>
              </div>

              <ChevronRight size={18} className="text-gray-300 dark:text-gray-500" />
            </button>

            <div className="rounded-[24px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-4">
              <div className="flex items-center gap-2 mb-3 text-gray-500 dark:text-gray-400">
                <DollarSign size={16} />
                <span className="text-[12px] font-medium">Limite de crédito</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-gray-400 dark:text-gray-500 font-bold text-xl">R$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={limitAmount}
                  onChange={handleLimitChange}
                  className="bg-transparent w-full outline-none font-black text-gray-900 dark:text-gray-100 text-[30px] tracking-tight"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-[28px] p-4 shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="mb-4">
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Aparência</h2>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
              Personalize a cor do cartão.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {PREDEFINED_COLORS.slice(0, 8).map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => {
                  lightTap()
                  setColor(c)
                }}
                className={`relative w-10 h-10 rounded-full transition-all active:scale-[0.98] ${
                  color === c ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-slate-900' : ''
                }`}
                style={{ backgroundColor: c }}
              >
                {color === c && (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <Check size={16} />
                  </div>
                )}
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                lightTap()
                setTempColor(color)
                setShowColorPicker(true)
              }}
              className="w-10 h-10 rounded-full overflow-hidden border border-dashed border-gray-300 dark:border-slate-600 active:scale-[0.98]"
            >
              <div
                className="w-full h-full"
                style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}
              />
            </button>
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-6 pt-3 bg-gradient-to-t from-[#f5f7f8] dark:from-slate-950 to-transparent z-40">
        <button
          onClick={() => {
            lightTap()
            handleSave()
          }}
          disabled={saving}
          className="w-full h-14 rounded-[22px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-[0_12px_30px_rgba(5,150,105,0.28)] transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="animate-spin" size={22} /> : <Check size={22} />}
          <span>{saving ? 'Salvando...' : editId ? 'Salvar alterações' : 'Salvar cartão'}</span>
        </button>
      </div>

      {showAccountModal && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowAccountModal(false)}
        >
          <div
            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl w-full max-w-lg rounded-t-[32px] p-5 h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-8 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white/95 dark:bg-slate-900/95 py-2 z-10">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Conta para pagamento</h3>
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 p-2 rounded-full transition-all active:scale-[0.98]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  lightTap()
                  setPaymentAccountId('')
                  setShowAccountModal(false)
                }}
                className={`w-full p-3 flex items-center gap-4 rounded-[20px] transition-all active:scale-[0.98] ${
                  !paymentAccountId ? 'bg-teal-50 dark:bg-teal-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="w-10 h-10 rounded-[14px] flex items-center justify-center bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-gray-500">
                  <Wallet size={20} />
                </div>

                <span
                  className={`flex-1 text-left font-medium ${
                    !paymentAccountId ? 'text-teal-700 dark:text-teal-300' : 'text-gray-800 dark:text-gray-200'
                  }`}
                >
                  Nenhuma conta
                </span>

                {!paymentAccountId && <Check size={20} className="text-teal-700 dark:text-teal-300" />}
              </button>

              {accounts.map((acc: any) => {
                const isActive = acc.id === paymentAccountId

                return (
                  <button
                    type="button"
                    key={acc.id}
                    onClick={() => {
                      lightTap()
                      setPaymentAccountId(acc.id)
                      setShowAccountModal(false)
                    }}
                    className={`w-full p-3 flex items-center gap-4 rounded-[20px] transition-all active:scale-[0.98] ${
                      isActive ? 'bg-teal-50 dark:bg-teal-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-[14px] flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: acc.color || '#14b8a6' }}
                    >
                      {(acc.name || '').substring(0, 2).toUpperCase()}
                    </div>

                    <span
                      className={`flex-1 text-left font-medium ${
                        isActive ? 'text-teal-700 dark:text-teal-300' : 'text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {acc.name}
                    </span>

                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-300" />}
                  </button>
                )
              })}

              {accounts.length === 0 && (
                <p className="text-center text-gray-400 dark:text-gray-500 mt-10">Nenhuma conta encontrada.</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showColorPicker && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setShowColorPicker(false)}
        >
          <div
            className="bg-[#303030]/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-t-[32px] p-6 w-full max-w-lg shadow-2xl animate-in slide-in-from-bottom-8 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
            <h3 className="text-white font-bold text-lg mb-4">Selecionar cor</h3>

            <div className="grid grid-cols-4 gap-4 mb-6">
              {PREDEFINED_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => {
                    lightTap()
                    setTempColor(c)
                  }}
                  className={`w-12 h-12 rounded-[16px] mx-auto border-2 transition-all active:scale-[0.98] ${
                    tempColor === c ? 'border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between mb-8 bg-[#222]/80 dark:bg-slate-800 p-3 rounded-[20px]">
              <span className="text-blue-400 text-sm font-medium">Hexadecimal</span>

              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: tempColor }} />
                <input
                  type="text"
                  value={tempColor}
                  onChange={(e) => setTempColor(e.target.value)}
                  className="w-24 bg-transparent text-white text-sm outline-none font-mono uppercase"
                  maxLength={7}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowColorPicker(false)}
                className="flex-1 py-3.5 rounded-[24px] bg-white/10 text-white font-bold text-sm transition-all active:scale-[0.98]"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => {
                  lightTap()
                  setColor(tempColor)
                  setShowColorPicker(false)
                }}
                className="flex-1 py-3.5 rounded-[24px] bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm transition-all active:scale-[0.98]"
              >
                Definir
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showDeleteSheet && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !deleting && setShowDeleteSheet(false)}
        >
          <div
            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl w-full max-w-lg rounded-t-[32px] p-6 pb-8 animate-in slide-in-from-bottom-8 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-6" />
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
                <AlertTriangle size={26} className="text-red-500" />
              </div>
              <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 mb-1">Excluir cartão?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[260px]">
                Essa ação não pode ser desfeita. O cartão será removido permanentemente.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteSheet(false)}
                disabled={deleting}
                className="flex-1 py-3.5 rounded-[24px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3.5 rounded-[24px] bg-red-500 hover:bg-red-600 text-white font-bold text-sm shadow-lg shadow-red-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Excluir
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default function NewCardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f6f7f8] dark:bg-slate-950">
        <Loader2 className="animate-spin text-teal-700" size={40} />
      </div>
    }>
      <NewCardContent />
    </Suspense>
  )
}
