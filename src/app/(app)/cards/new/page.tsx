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
import { useCardById } from '@/hooks/useCardById'
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

function EditCardContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const cardId = searchParams.get('edit') as string
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

  // 🔥 USANDO useCardById PARA EDIÇÃO
  const { data: localCards, loading: cardsLoading } = useCardById(cardId)

  useEffect(() => {
    if (!cardsLoading && !initialized && localCards) {
      setName(localCards.name || '')
      setFlag(localCards.flag || '')
      setInstitution(localCards.institution || '')
      setLastFour(localCards.last_four || '')
      setClosingDay(String(localCards.closing_day || ''))
      setDueDay(String(localCards.due_day || ''))
      setPaymentAccountId(localCards.payment_account_id || '')
      setColor(localCards.color || PREDEFINED_COLORS[0])
      const limit = safeNum(localCards.limit_amount)
      setLimitAmount(limit.toFixed(2).replace('.', ','))
      setInitialized(true)
    }
  }, [cardsLoading, localCards, initialized])

  const handleLimitChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/D/g, '')
    if (value === '') value = '0'
    const formatted = (safeNum(value) / 100).toFixed(2).replace('.', ',')
    setLimitAmount(formatted)
  }, [])

  const handleDayChange = useCallback((val: string, setter: (v: string) => void) => {
    const numeric = val.replace(/D/g, '')
    if (numeric === '' || (Number(numeric) >= 1 && Number(numeric) <= 31)) {
      setter(numeric)
    }
  }, [])

  const handleSave = useCallback(async () => {
    if (!(name || '').trim()) {
      showToast('Por favor, informe o nome do cartão.', 'warning')
      errorHaptic()
      return
    }

    setSaving(true)

    const payload = {
      name,
      flag: flag || null,
      institution: institution || null,
      last_four: lastFour || null,
      closing_day: closingDay ? parseInt(closingDay) : 1,
      due_day: dueDay ? parseInt(dueDay) : 10,
      payment_account_id: paymentAccountId || null,
      color,
      limit_amount: safeNum(limitAmount.replace(/./g, '').replace(',', '.')),
      updated_at: new Date().toISOString(),
      context: effectiveContext,
      user_id: user.id,
    }

    try {
      const result = await safeUpdate('credit_cards', cardId, { ...payload, id: cardId })
      if (!result.success) throw new Error(result.error)

      showToast('Cartão atualizado!', 'success')
      success()
      router.push(`/cards/details?id=${cardId}`)
    } catch (error: any) {
      showToast(`Erro ao salvar: ${error.message}`, 'error')
      errorHaptic()
    } finally {
      setSaving(false)
    }
  }, [
    name,
    flag,
    institution,
    lastFour,
    closingDay,
    dueDay,
    paymentAccountId,
    color,
    limitAmount,
    safeUpdate,
    cardId,
    showToast,
    success,
    router,
    errorHaptic,
  ])

  const handleDelete = useCallback(async () => {
    setDeleting(true)
    try {
      const result = await safeDelete('credit_cards', cardId)
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
  }, [safeDelete, cardId, showToast, success, router, errorHaptic])

  const renderFlagIcon = useCallback((cardFlag: string) => {
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
  }, [])

  const renderCardLogo = useCallback((cardFlag: string) => {
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
  }, [])

  const selectedAccount = useMemo(
    () => accounts.find((a: any) => a.id === paymentAccountId),
    [accounts, paymentAccountId]
  )

  const displayName = name?.trim() || 'Nome do cartão'
  const displayLastFour = lastFour ? `•••• ${lastFour}` : '•••• 0000'

  if (cardsLoading && !initialized) {
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
            <div className="bg-white dark:bg-slate-900 rounded-[28px] p-4 border border-gray-100 dark:border-slate-800">
              <div className="h-4 w-24 rounded-full bg-gray-200 dark:bg-slate-700 mb-4" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-20 rounded-[20px] bg-gray-100 dark:bg-slate-800" />
                <div className="h-20 rounded-[20px] bg-gray-100 dark:bg-slate-800" />
              </div>
            </div>
            <div className="h-14 rounded-[22px] bg-gray-200 dark:bg-slate-800" />
          </div>
        </div>
      </div>
    )
  }

  // Restante do EditCardContent (UI) permanece igual...
  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f6f7f8] dark:bg-slate-950 text-gray-900 dark:text-white pb-32 transition-colors duration-300">
      {/* ... todo o JSX do EditCardContent igual ao que você já tem ... */}
      {/* (mantido igual para não repetir, você já tem a UI completa) */}
      {/* Apenas a lógica de carregamento foi alterada acima */}
    </div>
  )
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

  // 🔥 USANDO useCardById PARA EDIÇÃO (na criação, editId pode ser null)
  const { data: localCards, loading: cardsLoading } = useCardById(editId)

  useEffect(() => {
    if (!editId) {
      setInitialized(true)
      return
    }

    if (!cardsLoading && !initialized && localCards) {
      setName(localCards.name || '')
      setFlag(localCards.flag || '')
      setInstitution(localCards.institution || '')
      setLastFour(localCards.last_four || '')
      setClosingDay(String(localCards.closing_day || ''))
      setDueDay(String(localCards.due_day || ''))
      setPaymentAccountId(localCards.payment_account_id || '')
      setColor(localCards.color || PREDEFINED_COLORS[0])
      const limit = safeNum(localCards.limit_amount)
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

  // Restante do NewCardContent (UI) permanece igual...
  // (mantido igual para não repetir, você já tem a UI completa)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f5f7f8] dark:bg-slate-950 text-gray-900 dark:text-white pb-32 transition-colors duration-300">
      {/* ... todo o JSX do NewCardContent igual ao que você já tem ... */}
    </div>
  )
}

// ✅ COMPONENTE ROTEADOR (Usa useSearchParams corretamente)
function CardRouter() {
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  return editId ? <EditCardContent /> : <NewCardContent />
}

export default function NewCardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f6f7f8] dark:bg-slate-950">
          <Loader2 className="animate-spin text-teal-700" size={40} />
        </div>
      }
    >
      <CardRouter />
    </Suspense>
  )
}