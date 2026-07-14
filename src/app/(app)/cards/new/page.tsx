'use client'

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronLeft, Tag, CreditCard, Calendar, PiggyBank,
  DollarSign, Check, Loader2, X, Wallet, Trash2, AlertTriangle,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLocalData } from '@/hooks/useLocalData'
import { useCardById } from '@/hooks/useCardById'
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSafeDb } from '@/hooks/useSafeDb'
import { safeAdd } from '@/lib/safeDb'
import Skeleton from '@/components/Skeleton'

const PREDEFINED_COLORS = ['#2a9d8f', '#e76f51', '#264653', '#e9c46a', '#1d3557', '#e63946', '#8338ec', '#ffb703', '#3a0ca3', '#000000', '#ffffff', '#636e72']
const FLAGS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard']

function safeNum(val: any): number {
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

// 🔥 COMPONENTE UNIFICADO DE FORMULÁRIO (resolve a tela branca)
function CardFormContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const cardId = searchParams.get('edit') // Se vier null, estamos Criando.
  const isEditing = !!cardId
  
  const { showToast } = useToast()
  const { success, error: errorHaptic, vibrate } = useHapticFeedback()
  const { safeUpdate, safeDelete } = useSafeDb()
  const { effectiveContext } = useContext_()

  // --- HOOKS INICIAIS (Nenhum if/return antes deles!) ---
  const { data: localAccounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context: effectiveContext || 'dfl' },
  })
  
  const { data: cardData, loading: cardsLoading } = useCardById(cardId || undefined)
  const accounts = localAccounts || []

  // --- ESTADOS DO FORMULÁRIO ---
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

  // --- CARREGAMENTO DE DADOS ---
  useEffect(() => {
    if (!isEditing) {
      setInitialized(true)
      return
    }
    if (!cardsLoading && !initialized && cardData) {
      setName(cardData.name || '')
      setFlag(cardData.flag || '')
      setInstitution(cardData.institution || '')
      setLastFour(cardData.last_four || '')
      setClosingDay(String(cardData.closing_day || '1'))
      setDueDay(String(cardData.due_day || '10'))
      setPaymentAccountId(cardData.payment_account_id || '')
      setColor(cardData.color || PREDEFINED_COLORS[0])
      const limit = safeNum(cardData.limit_amount)
      setLimitAmount(limit.toFixed(2).replace('.', ','))
      setInitialized(true)
    }
  }, [isEditing, cardsLoading, cardData, initialized])

  const handleLimitChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value === '') value = '0'
    const formatted = (safeNum(value) / 100).toFixed(2).replace('.', ',')
    setLimitAmount(formatted)
  }, [])

  const handleDayChange = useCallback((val: string, setter: (v: string) => void) => {
    const numeric = val.replace(/\D/g, '')
    if (numeric === '' || (Number(numeric) >= 1 && Number(numeric) <= 31)) setter(numeric)
  }, [])

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Por favor, informe o nome do cartão.', 'warning')
      errorHaptic()
      return
    }
    if (!user?.id) return

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
      if (isEditing) {
        const result = await safeUpdate('credit_cards', cardId as string, { ...payload, id: cardId })
        if (!result.success) throw new Error(result.error)
        showToast('✅ Cartão atualizado!', 'success')
      } else {
        const newId = crypto.randomUUID()
        const result = await safeAdd('credit_cards', { ...payload, id: newId, is_archived: false, created_at: new Date().toISOString() })
        if (!result.success) throw new Error(result.error)
        showToast('✅ Cartão criado!', 'success')
      }
      success()
      router.push(isEditing ? `/cards/details?id=${cardId}` : '/cards')
    } catch (error: any) {
      showToast(`❌ ${error.message}`, 'error')
      errorHaptic()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!isEditing) return
    setDeleting(true)
    try {
      const result = await safeDelete('credit_cards', cardId as string)
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

  const renderFlagIcon = useCallback((cardFlag: string) => {
    switch (cardFlag) {
      case 'Visa': return <span className="text-[10px] font-bold italic text-blue-800">VISA</span>
      case 'Mastercard': return (
        <div className="flex items-center gap-0.5">
          <div className="w-3 h-3 bg-red-500 rounded-full" /><div className="w-3 h-3 bg-yellow-500 rounded-full -ml-1.5" />
        </div>
      )
      case 'Elo': return <span className="text-[10px] font-bold text-blue-600">elo</span>
      case 'Amex': return <span className="text-[9px] font-bold text-blue-500">AMEX</span>
      case 'Hipercard': return <span className="text-[9px] font-bold text-red-400">HIPER</span>
      default: return <CreditCard size={14} />
    }
  }, [])

  const selectedAccount = useMemo(() => accounts.find((a: any) => a.id === paymentAccountId), [accounts, paymentAccountId])

  // --- RENDERIZAÇÃO CONDICIONAL APENAS DEPOIS DOS HOOKS ---
  if (isEditing && cardsLoading && !initialized) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-slate-950 p-4 pt-6">
        <Skeleton count={1} className="h-48 w-full rounded-[32px] mb-6" />
        <Skeleton count={3} className="h-24 w-full rounded-[28px] mb-4" />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f6f7f8] dark:bg-slate-950 text-gray-900 dark:text-white pb-32 transition-colors duration-300">
      <div className="relative px-4 pt-6 pb-8 overflow-hidden" style={{ background: `linear-gradient(180deg, ${color}, ${color}dd)` }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_35%)]" />
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => { vibrate([5]); router.back() }} className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white active:scale-[0.98] transition-all">
              <ChevronLeft size={22} />
            </button>
            {isEditing && (
              <button onClick={() => { vibrate([5]); setShowDeleteSheet(true) }} disabled={deleting} className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white/85 active:scale-[0.98] transition-all disabled:opacity-60">
                {deleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={19} />}
              </button>
            )}
          </div>

          <div className="rounded-[30px] bg-white/10 backdrop-blur-md border border-white/15 shadow-[0_12px_32px_rgba(0,0,0,0.14)] p-5">
            <div className="flex items-start justify-between gap-4 mb-8">
              <div className="min-w-0 flex-1">
                <p className="text-white/70 text-[12px] font-medium mb-2">{isEditing ? 'Editar cartão' : 'Novo cartão'}</p>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Nubank, Inter"
                  className="bg-transparent text-white text-[30px] leading-none font-light outline-none w-full placeholder:text-white/45"
                  autoFocus={!isEditing}
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
        {/* DADOS PRINCIPAIS */}
        <section className="bg-white dark:bg-slate-900 rounded-[28px] p-4 shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="mb-4">
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Dados principais</h2>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3 text-gray-700 dark:text-gray-300">
                <Tag size={16} /><span className="text-[13px] font-semibold">Bandeira</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {FLAGS.map(f => (
                  <button
                    key={f}
                    onClick={() => { vibrate([5]); setFlag(f) }}
                    className={`flex items-center gap-2 px-4 h-11 rounded-full text-[13px] whitespace-nowrap border transition-all active:scale-[0.98] ${flag === f ? 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-900/20 dark:border-teal-800 dark:text-teal-300' : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300'}`}
                  >
                    {renderFlagIcon(f)}
                    <span className="font-medium">{f}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <div className="rounded-[22px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-3">
                <label className="text-[12px] font-medium text-gray-500 block mb-1">Instituição</label>
                <input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="Opcional" className="w-full bg-transparent outline-none text-[14px] font-semibold text-gray-900 dark:text-gray-100" />
              </div>
              <div className="rounded-[22px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-3">
                <label className="text-[12px] font-medium text-gray-500 block mb-1">Final</label>
                <input value={lastFour} onChange={e => setLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="0000" className="w-full bg-transparent outline-none text-[14px] font-bold text-gray-900 dark:text-gray-100" />
              </div>
            </div>
          </div>
        </section>

        {/* CICLO DA FATURA */}
        <section className="bg-white dark:bg-slate-900 rounded-[28px] p-4 shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="mb-4">
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Ciclo da fatura</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[22px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-3">
              <div className="flex items-center gap-2 mb-2 text-gray-500"><Calendar size={16} /><span className="text-[12px] font-medium">Fechamento</span></div>
              <input type="text" value={closingDay} onChange={e => handleDayChange(e.target.value, setClosingDay)} placeholder="Dia" className="w-full bg-transparent outline-none text-[18px] font-bold text-gray-900 dark:text-gray-100" />
            </div>
            <div className="rounded-[22px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-3">
              <div className="flex items-center gap-2 mb-2 text-gray-500"><Calendar size={16} /><span className="text-[12px] font-medium">Vencimento</span></div>
              <input type="text" value={dueDay} onChange={e => handleDayChange(e.target.value, setDueDay)} placeholder="Dia" className="w-full bg-transparent outline-none text-[18px] font-bold text-gray-900 dark:text-gray-100" />
            </div>
          </div>
        </section>

        {/* FINANCEIRO */}
        <section className="bg-white dark:bg-slate-900 rounded-[28px] p-4 shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="mb-4"><h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Financeiro</h2></div>
          <div className="space-y-3">
            <button onClick={() => { vibrate([5]); setShowAccountModal(true) }} className="w-full rounded-[22px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-slate-700 flex items-center justify-center text-gray-500"><PiggyBank size={18} /></div>
              <div className="flex-1 text-left">
                <p className="text-[12px] font-medium text-gray-500">Conta para pagamento</p>
                <p className={`text-[14px] font-semibold ${selectedAccount ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>{selectedAccount ? selectedAccount.name : 'Selecionar conta'}</p>
              </div>
            </button>
            <div className="rounded-[24px] bg-[#f7f8fa] dark:bg-slate-800/80 px-4 py-4">
              <div className="flex items-center gap-2 mb-3 text-gray-500"><DollarSign size={16} /><span className="text-[12px] font-medium">Limite total</span></div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-bold text-xl">R$</span>
                <input type="text" value={limitAmount} onChange={handleLimitChange} className="bg-transparent w-full outline-none font-black text-gray-900 dark:text-gray-100 text-[30px]" />
              </div>
            </div>
          </div>
        </section>

        {/* COR */}
        <section className="bg-white dark:bg-slate-900 rounded-[28px] p-4 shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="mb-4"><h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Aparência</h2></div>
          <div className="flex flex-wrap gap-3">
            {PREDEFINED_COLORS.slice(0, 8).map(c => (
              <button key={c} onClick={() => setColor(c)} className={`w-10 h-10 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-slate-900' : ''}`} style={{ backgroundColor: c }}>
                {color === c && <div className="flex items-center justify-center text-white"><Check size={16} /></div>}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* FOOTER */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-6 pt-3 bg-gradient-to-t from-[#f6f7f8] dark:from-slate-950 to-transparent z-40">
        <button onClick={() => { vibrate([5]); handleSave() }} disabled={saving} className="w-full h-14 rounded-[22px] bg-emerald-700 text-white font-bold shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="animate-spin" size={22} /> : <Check size={22} />}
          <span>{saving ? 'Salvando...' : (isEditing ? 'Salvar alterações' : 'Criar cartão')}</span>
        </button>
      </div>

      {/* MODALS REUTILIZADOS AQUI (Contas e Delete) */}
      {showAccountModal && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50" onClick={() => setShowAccountModal(false)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[32px] p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4" />
            <div className="space-y-2">
              <button onClick={() => { setPaymentAccountId(''); setShowAccountModal(false) }} className="w-full p-3 flex items-center gap-4 rounded-[20px] hover:bg-gray-50 dark:hover:bg-slate-800">
                <span className="flex-1 text-left font-medium text-gray-800 dark:text-gray-200">Nenhuma conta</span>
              </button>
              {accounts.map((acc: any) => (
                <button key={acc.id} onClick={() => { setPaymentAccountId(acc.id); setShowAccountModal(false) }} className="w-full p-3 flex items-center gap-4 rounded-[20px] hover:bg-gray-50 dark:hover:bg-slate-800">
                  <div className="w-10 h-10 rounded-[14px] flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: acc.color || '#14b8a6' }}>{(acc.name || '').substring(0, 2).toUpperCase()}</div>
                  <span className="flex-1 text-left font-medium text-gray-800 dark:text-gray-200">{acc.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showDeleteSheet && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50" onClick={() => setShowDeleteSheet(false)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[32px] p-6 pb-8" onClick={e => e.stopPropagation()}>
             <h3 className="text-center font-black text-lg text-slate-800 dark:text-slate-100 mb-6">Excluir cartão?</h3>
             <div className="flex gap-3">
              <button onClick={() => setShowDeleteSheet(false)} className="flex-1 py-3.5 rounded-[24px] bg-slate-100 text-slate-700 font-bold">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 py-3.5 rounded-[24px] bg-red-500 text-white font-bold">Excluir</button>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function NewCardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f7f8] dark:bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-teal-700" size={40} /></div>}>
      <CardFormContent />
    </Suspense>
  )
}
