// src/app/(app)/transactions/card-expense/page.tsx
'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Calendar, Edit3, Tag, CreditCard, Check, Loader2, ChevronRight, Hash,
  X, Plus
} from 'lucide-react'
import { addMonths, format } from 'date-fns'
import { getDynamicIcon } from '@/lib/iconUtils'
import MoneyInput from '@/components/MoneyInput'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useToast } from '@/contexts/ToastContext'
import { db } from '@/lib/db'
import { reconcileCardInvoiceCycle } from '@/lib/cardOperations'

export default function CardExpensePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { safeAdd } = useSafeDb()
  const { success: hapticSuccess, error: hapticError, vibrate } = useHapticFeedback()
  const { showToast } = useToast()

  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)

  const [amountNum, setAmountNum] = useState(0)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [creditCardId, setCreditCardId] = useState('')

  const [showDetails, setShowDetails] = useState(false)
  const [notes, setNotes] = useState('')
  const [tagId, setTagId] = useState('')
  const [installments, setInstallments] = useState(1)

  const [showCardModal, setShowCardModal] = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)

  const { data: cards, loading: cardsLoading } = useLocalData({
    table: 'credit_cards' as any,
    filters: { context: effectiveContext, is_archived: false },
  })

  const { data: localCategories, loading: catsLoading } = useLocalData({
    table: 'categories' as any,
    filters: { context: effectiveContext, type: 'expense' },
  })

  const { data: tags, loading: tagsLoading } = useLocalData({
    table: 'tags' as any,
    filters: { context: effectiveContext },
  })

  const loading = cardsLoading || catsLoading || tagsLoading

  const categories = useMemo(() => {
    return (localCategories || []).sort((a: any, b: any) => {
      const orderA = a.order_index ?? 9999
      const orderB = b.order_index ?? 9999
      if (orderA !== orderB) return orderA - orderB
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [localCategories])

  const handleSave = async () => {
    if (isSubmitting || saved) return
    if (!user?.id) {
      showToast("Sessão expirada. Faça login novamente.", "error")
      return
    }
    if (!creditCardId) {
      showToast("Por favor, selecione um cartão de crédito.", "warning")
      hapticError()
      return
    }
    if (amountNum <= 0) {
      showToast("O valor da despesa deve ser maior que zero.", "warning")
      hapticError()
      return
    }

    setIsSubmitting(true)

    const parcelasTexto = installments > 1 ? `[Parcelado em ${installments}x] ` : ''
    const finalNotes = `${parcelasTexto}${notes}`.trim()
    const selectedCat = categories.find((c: any) => c.id === categoryId)
    const finalDescription = description.trim() || selectedCat?.name || 'Despesa no Cartão'
    const recurringGroupId = installments > 1 ? crypto.randomUUID() : null
    const installmentAmount = installments > 1 ? amountNum / installments : amountNum
    const baseDate = new Date(`${date}T12:00:00`)

    try {
      await db.transaction(
        'rw',
        db.credit_cards,
        db.credit_invoices,
        db.transactions,
        db.syncQueue,
        async () => {
        const freshCard: any =
          await db.credit_cards.get(creditCardId)

        if (!freshCard) {
          throw new Error(
            'Cartão selecionado não encontrado'
          )
        }

        if (freshCard.user_id !== user.id) {
          throw new Error(
            'Usuário não autorizado a usar este cartão'
          )
        }

        for (let i = 0; i < installments; i++) {
          const installmentDate = format(addMonths(baseDate, i), 'yyyy-MM-dd')
          const txId = crypto.randomUUID()

          const payload = {
            id: txId,
            user_id: user.id,
            amount: installmentAmount,
            status: 'pending',
            date: installmentDate,
            description: finalDescription,
            category_id: categoryId || null,
            credit_card_id: creditCardId,
            tag_ids: tagId ? [tagId] : null,
            notes: finalNotes || null,
            type: 'expense',
            context: effectiveContext,
            recurring_group_id: recurringGroupId,
            installment_index: installments > 1 ? i + 1 : 1,
            total_installments: installments,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            sync_status: 'pending',
            sync_attempts: 0,
          }

          const res = await safeAdd('transactions', payload)
          if (!res.success) {
            throw new Error(
              res.error ||
                `Erro ao salvar parcela ${i + 1}`
            )
          }

          await reconcileCardInvoiceCycle({
            userId: user.id,
            card: freshCard,
            transactionDate: installmentDate,
          })
        }
      })

      setSaved(true)
      hapticSuccess()
      vibrate([50])
      showToast("Despesa salva com sucesso!", "success")
      setTimeout(() => {
        router.push('/home')
      }, 800)
    } catch (err: any) {
      console.error("Erro ao salvar:", err)
      hapticError()
      showToast(`Erro ao salvar despesa: ${err.message}`, "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderFlagIcon = (cardFlag: string) => {
    switch (cardFlag) {
      case 'Visa':
        return <span className="text-[10px] font-bold italic text-blue-800 dark:text-blue-400">VISA</span>
      case 'Mastercard':
        return (
          <div className="flex items-center gap-0.5">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <div className="w-3 h-3 bg-yellow-500 rounded-full -ml-1.5" />
          </div>
        )
      case 'Elo':
        return <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">elo</span>
      case 'Amex':
        return <span className="text-[9px] font-bold text-blue-500 dark:text-blue-400">AMEX</span>
      case 'Hipercard':
        return <span className="text-[9px] font-bold text-red-400">HIPER</span>
      default:
        return <CreditCard size={14} />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa] dark:bg-slate-950">
        <Loader2 className="animate-spin text-teal-600" size={40} />
      </div>
    )
  }

  const selectedCard = (cards || []).find((c: any) => c.id === creditCardId)
  const selectedCat = categories.find((c: any) => c.id === categoryId)
  const selectedTag = (tags || []).find((t: any) => t.id === tagId)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f7f8fa] dark:bg-slate-950 text-gray-900 dark:text-gray-100 pb-28 relative">
      {/* 🔥 HEADER */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#f7f8fa]/90 dark:bg-slate-950/85 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center justify-between px-4 pt-5 pb-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-200 active:scale-95 bg-white/80 dark:bg-slate-800/80 border border-black/5 dark:border-white/10"
          >
            <ChevronLeft size={22} />
          </button>

          <h1 className="text-[17px] font-semibold tracking-[-0.02em]">
            Despesa no cartão
          </h1>

          <div className="w-10 h-10" />
        </div>

        <div className="px-4 pb-4">
          <ContextToggle />
        </div>
      </div>

      {/* 🔥 VALOR */}
      <div className="px-5 pt-6">
        <div className="rounded-[22px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-sm dark:shadow-none px-5 py-6">
          <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-3">
            Valor
          </p>
          <div className="flex items-end gap-2">
            <span className="text-3xl leading-none font-light text-gray-400 dark:text-gray-500 pb-1">
              R$
            </span>
            <MoneyInput
              value={amountNum}
              onChange={(num) => {
                setAmountNum(num)
              }}
              className="text-[40px] leading-none font-bold tracking-[-0.04em] bg-transparent outline-none w-full text-rose-600 dark:text-rose-400"
            />
          </div>
        </div>
      </div>

      {/* 🔥 FORMULÁRIO PRINCIPAL */}
      <div className="px-5 pt-5 space-y-4">
        <section className="rounded-[22px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 overflow-hidden shadow-sm dark:shadow-none">
          {/* Cartão */}
          <button
            onClick={() => { setShowCardModal(true); vibrate([10]) }}
            className="w-full flex items-center gap-4 px-5 py-4 active:scale-[0.99] transition-transform"
          >
            <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
              <CreditCard size={20} className="text-teal-600" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                Cartão
              </p>
              <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                {selectedCard ? `${selectedCard.name} ${selectedCard.last_four ? `(••${selectedCard.last_four})` : ''}` : 'Selecione o cartão'}
              </p>
            </div>
            <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
          </button>

          <div className="mx-5 h-px bg-black/5 dark:bg-white/5" />

          {/* Data */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <Calendar size={19} className="text-gray-500 dark:text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                Data
              </p>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent outline-none text-[15px] font-semibold text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="mx-5 h-px bg-black/5 dark:bg-white/5" />

          {/* Descrição */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <Edit3 size={19} className="text-gray-500 dark:text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                Descrição
              </p>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição da compra"
                className="w-full bg-transparent outline-none text-[15px] font-semibold text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>
          </div>

          <div className="mx-5 h-px bg-black/5 dark:bg-white/5" />

          {/* Categoria */}
          <button
            onClick={() => { setShowCatModal(true); vibrate([10]) }}
            className="w-full flex items-center gap-4 px-5 py-4 active:scale-[0.99] transition-transform"
          >
            <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <Tag size={19} className="text-gray-500 dark:text-gray-400" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                Categoria
              </p>
              <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                {selectedCat ? selectedCat.name : 'Selecione a categoria'}
              </p>
            </div>
            <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
          </button>
        </section>

        {/* 🔥 MAIS DETALHES */}
        <section className="rounded-[22px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 overflow-hidden shadow-sm dark:shadow-none">
          <button
            onClick={() => { setShowDetails(!showDetails); vibrate([10]) }}
            className="w-full flex items-center justify-between px-5 py-4 active:scale-[0.99] transition-transform"
          >
            <div className="text-left">
              <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                Mais detalhes
              </p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                Parcelas, observações e tags
              </p>
            </div>
            <span className="text-[13px] font-medium text-teal-600">
              {showDetails ? 'Ocultar' : 'Abrir'}
            </span>
          </button>

          {showDetails && (
            <>
              <div className="mx-5 h-px bg-black/5 dark:bg-white/5" />

              {/* Parcelas */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <Hash size={18} className="text-gray-500 dark:text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                    Parcelamento
                  </p>
                  <select
                    value={installments}
                    onChange={(e) => setInstallments(Number(e.target.value))}
                    className="w-full bg-transparent outline-none text-[15px] font-semibold text-gray-900 dark:text-gray-100 appearance-none"
                  >
                    <option value={1}>1x (À vista)</option>
                    {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
                      <option key={n} value={n}>{n}x</option>
                    ))}
                  </select>
                </div>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600 pointer-events-none" />
              </div>

              <div className="mx-5 h-px bg-black/5 dark:bg-white/5" />

              {/* Observações */}
              <div className="flex items-start gap-4 px-5 py-4">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Edit3 size={18} className="text-gray-500 dark:text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Observações
                  </p>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Adicione uma observação opcional"
                    rows={2}
                    className="w-full bg-transparent outline-none resize-none text-[15px] font-medium text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                </div>
              </div>

              <div className="mx-5 h-px bg-black/5 dark:bg-white/5" />

              {/* Tags */}
              <button
                onClick={() => { setShowTagModal(true); vibrate([10]) }}
                className="w-full flex items-center gap-4 px-5 py-4 active:scale-[0.99] transition-transform"
              >
                <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <Tag size={18} className="text-gray-500 dark:text-gray-400" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                    Tag
                  </p>
                  <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {selectedTag ? selectedTag.name : 'Nenhuma tag'}
                  </p>
                </div>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </button>
            </>
          )}
        </section>
      </div>

      {/* 🔥 FAB DE SALVAR */}
      <div className="fixed bottom-0 left-0 w-full z-40 pointer-events-none">
        <div className="max-w-md mx-auto h-24 bg-gradient-to-t from-[#f6f7f8] via-[#f6f7f8]/90 to-transparent dark:from-slate-950 dark:via-slate-950/90 dark:to-transparent" />
      </div>

      <div className="fixed bottom-6 left-0 w-full flex justify-center pointer-events-none z-50">
        <button
          onClick={handleSave}
          disabled={isSubmitting || saved}
          className={`pointer-events-auto w-[68px] h-[68px] rounded-full flex items-center justify-center text-white shadow-lg shadow-rose-600/20 transition-all duration-300 active:scale-[0.92] ${
            saved
              ? 'bg-emerald-500 scale-110'
              : 'bg-rose-600 hover:bg-rose-700'
          }`}
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" size={28} />
          ) : saved ? (
            <Check size={32} className="animate-in zoom-in duration-300" />
          ) : (
            <Check size={32} />
          )}
        </button>
      </div>

      {/* 🔥 MODAL CARTÃO */}
      {showCardModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCardModal(false)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[32px] p-6 h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-slate-900 py-2 z-10">
              <h3 className="font-semibold text-xl text-gray-900 dark:text-gray-100">Cartão de Crédito</h3>
              <button onClick={() => setShowCardModal(false)} className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 p-2.5 rounded-full active:scale-[0.95] transition-transform">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2">
              {(cards || []).map((card: any) => {
                const isActive = card.id === creditCardId
                return (
                  <button
                    key={card.id}
                    onClick={() => { setCreditCardId(card.id); setShowCardModal(false); vibrate([10]) }}
                    className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-colors active:scale-[0.98] border ${
                      isActive
                        ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800/70'
                        : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div
                      className="w-12 h-12 rounded-[16px] flex items-center justify-center text-white text-xs font-bold shadow-sm"
                      style={{ backgroundColor: card.color || '#f97316' }}
                    >
                      {card.flag ? renderFlagIcon(card.flag) : <CreditCard size={22} />}
                    </div>
                    <div className="flex-1 text-left">
                      <span className={`font-semibold ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-gray-900 dark:text-gray-100'}`}>
                        {card.name}
                      </span>
                      {card.last_four && (
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1">
                          (••{card.last_four})
                        </span>
                      )}
                    </div>
                    {isActive && <Check size={22} className="text-teal-600 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 🔥 MODAL CATEGORIA */}
      {showCatModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCatModal(false)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[32px] p-6 h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-slate-900 py-2 z-10">
              <h3 className="font-semibold text-xl text-gray-900 dark:text-gray-100">Categorias</h3>
              <button
                onClick={() => { setShowCatModal(false); router.push('/categories'); vibrate([10]) }}
                className="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 p-2.5 rounded-full active:scale-[0.95] transition-transform"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="space-y-2">
              {categories.map((cat: any) => {
                const IconComp = getDynamicIcon(cat.icon)
                const isActive = cat.id === categoryId
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setCategoryId(cat.id); setShowCatModal(false); vibrate([10]) }}
                    className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-colors active:scale-[0.98] border ${
                      isActive
                        ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800/70'
                        : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-[16px] flex items-center justify-center shadow-sm" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                      <IconComp size={22} />
                    </div>
                    <span className={`flex-1 text-left font-semibold ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-gray-900 dark:text-gray-100'}`}>
                      {cat.name}
                    </span>
                    {isActive && <Check size={22} className="text-teal-600 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 🔥 MODAL TAGS */}
      {showTagModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowTagModal(false)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[32px] p-6 h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-slate-900 py-2 z-10">
              <h3 className="font-semibold text-xl text-gray-900 dark:text-gray-100">Tags</h3>
              <button
                onClick={() => { setShowTagModal(false); router.push('/tags'); vibrate([10]) }}
                className="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 p-2.5 rounded-full active:scale-[0.95] transition-transform"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="space-y-2">
              {(tags || []).map((tag: any) => {
                const isActive = tag.id === tagId
                return (
                  <button
                    key={tag.id}
                    onClick={() => { setTagId(tag.id); setShowTagModal(false); vibrate([10]) }}
                    className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-colors active:scale-[0.98] border ${
                      isActive
                        ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800/70'
                        : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full shadow-sm" style={{ backgroundColor: tag.color }} />
                    <span className={`flex-1 text-left font-semibold ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-gray-900 dark:text-gray-100'}`}>
                      {tag.name}
                    </span>
                    {isActive && <Check size={22} className="text-teal-600 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}