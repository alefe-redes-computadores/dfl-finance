'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Calendar, Edit3, Tag, CreditCard, RefreshCw, Check, Loader2, ChevronRight, Hash,
  X, Plus
} from 'lucide-react'
import { format } from 'date-fns'
import { getDynamicIcon } from '@/lib/iconUtils'
import MoneyInput from '@/components/MoneyInput'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
// 🔥 NOVO: Arquitetura Local-First, Haptic e Blindagem
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useToast } from '@/contexts/ToastContext'

export default function CardExpensePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { safeAdd } = useSafeDb()
  const { success: hapticSuccess, error: hapticError, vibrate } = useHapticFeedback()
  const { showToast } = useToast()

  // 🔥 CORRIGIDO: effectiveContext garantindo a trava PF/PJ
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)

  const [amountNum, setAmountNum] = useState(0)
  const [amountFormatted, setAmountFormatted] = useState('0,00')
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

  // 🔥 LEITURA 100% OFFLINE (Sem vazamento e sem bugs de internet)
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

  // 🔥 ORDENAÇÃO DAS CATEGORIAS PELO ORDER_INDEX
  const categories = useMemo(() => {
    return (localCategories || []).sort((a: any, b: any) => {
      const orderA = a.order_index ?? 9999
      const orderB = b.order_index ?? 9999
      if (orderA !== orderB) return orderA - orderB
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [localCategories])

  // 🔥 SALVAMENTO ATÔMICO E BLINDADO
  const handleSave = async () => {
    if (isSubmitting || saved) return
    if (!user?.id) {
      showToast("❌ Sessão expirada. Faça login novamente.", "error")
      return
    }
    if (!creditCardId) {
      showToast("⚠️ Por favor, selecione um cartão de crédito.", "warning")
      hapticError()
      return
    }
    if (amountNum <= 0) {
      showToast("⚠️ O valor da despesa deve ser maior que zero.", "warning")
      hapticError()
      return
    }

    setIsSubmitting(true)
    const idempotencyKey = crypto.randomUUID()
    
    const parcelasTexto = installments > 1 ? `[Parcelado em ${installments}x] ` : ''
    const finalNotes = `${parcelasTexto}${notes}`.trim()
    const selectedCat = categories.find((c: any) => c.id === categoryId)
    const finalDescription = description.trim() || selectedCat?.name || 'Despesa no Cartão'
    
    const payload = {
      id: idempotencyKey, // Gerado localmente para o Dexie
      user_id: user.id,
      amount: amountNum,
      status: 'pending',
      date,
      description: finalDescription,
      category_id: categoryId || null,
      credit_card_id: creditCardId,
      tag_ids: tagId ? [tagId] : null,
      notes: finalNotes || null,
      type: 'expense',
      context: effectiveContext,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
      sync_attempts: 0
    }

    try {
      const res = await safeAdd('transactions', payload)
      if (!res.success) throw new Error(res.error)

      setSaved(true)
      hapticSuccess()
      vibrate([50])
      showToast("✅ Despesa salva com sucesso!", "success")
      setTimeout(() => {
        router.push('/home')
      }, 800)
    } catch (err: any) {
      console.error("Erro ao salvar:", err)
      hapticError()
      showToast(`❌ Erro ao salvar despesa: ${err.message}`, "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderFlagIcon = (cardFlag: string) => {
    switch (cardFlag) {
      case 'Visa': return <span className="text-[10px] font-bold italic text-blue-800 dark:text-blue-400">VISA</span>
      case 'Mastercard': return (
        <div className="flex items-center gap-0.5">
          <div className="w-3 h-3 bg-red-500 rounded-full" />
          <div className="w-3 h-3 bg-yellow-500 rounded-full -ml-1.5" />
        </div>
      )
      case 'Elo': return <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">elo</span>
      case 'Amex': return <span className="text-[9px] font-bold text-blue-500 dark:text-blue-400">AMEX</span>
      case 'Hipercard': return <span className="text-[9px] font-bold text-red-400">HIPER</span>
      default: return <CreditCard size={14} />
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
      <Loader2 className="animate-spin text-orange-500" size={40} />
    </div>
  )

  const selectedCard = (cards || []).find((c: any) => c.id === creditCardId)
  const selectedCat = categories.find((c: any) => c.id === categoryId)
  const selectedTag = (tags || []).find((t: any) => t.id === tagId)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      
      <div className="flex justify-between items-center p-4 pt-6">
        <button onClick={() => router.back()} className="text-gray-800 dark:text-gray-200 p-2 -ml-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors active:scale-[0.95]">
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-bold text-[18px] text-gray-800 dark:text-gray-100">Despesa no Cartão</h1>
        <div className="w-10" />
      </div>

      <div className="px-4 pb-2">
        <ContextToggle />
      </div>

      <div className="px-6 py-4 mb-2">
        <p className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Valor da compra</p>
        <div className="flex items-center gap-2">
          <span className="text-3xl text-gray-400 dark:text-gray-500 font-light opacity-70">R$</span>
          <MoneyInput
            value={amountNum}
            onChange={(num, formatted) => {
              setAmountNum(num)
              setAmountFormatted(formatted)
            }}
            className="text-5xl font-bold bg-transparent outline-none w-full text-orange-500 dark:text-orange-400"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-t-[32px] px-6 py-6 shadow-sm border-t border-gray-100 dark:border-slate-700 min-h-[50vh] space-y-4 transition-colors duration-300">
        
        <button onClick={() => { setShowCardModal(true); vibrate([10]) }} className="w-full flex items-center gap-4 border border-gray-100 dark:border-slate-700 p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-[24px] active:scale-[0.98] shadow-sm">
          <div className="w-12 h-12 rounded-[16px] bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
            <CreditCard size={24} className="text-orange-500" />
          </div>
          <div className="flex-1 flex flex-col text-left">
            <span className="font-bold text-[15px] text-gray-800 dark:text-gray-200">Cartão de Crédito</span>
            <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">
              {selectedCard ? `${selectedCard.name} ${selectedCard.last_four ? `(••${selectedCard.last_four})` : ''}` : 'Selecione o cartão...'}
            </span>
          </div>
          <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
        </button>

        <div className="flex items-center gap-4 border border-gray-100 dark:border-slate-700 p-4 rounded-[24px] bg-white dark:bg-slate-800 shadow-sm relative">
          <Calendar size={22} className="text-gray-400 dark:text-gray-500 shrink-0" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none bg-transparent" />
        </div>

        <div className="flex items-center gap-4 border border-gray-100 dark:border-slate-700 p-4 rounded-[24px] bg-white dark:bg-slate-800 shadow-sm">
          <Edit3 size={22} className="text-gray-400 dark:text-gray-500 shrink-0" />
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição da compra" className="flex-1 text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none bg-transparent placeholder:text-gray-300 dark:placeholder:text-gray-500" />
        </div>

        <button onClick={() => { setShowCatModal(true); vibrate([10]) }} className="w-full flex items-center gap-4 border border-gray-100 dark:border-slate-700 p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-[24px] active:scale-[0.98] shadow-sm">
          <div className="w-12 h-12 rounded-[16px] bg-gray-50 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <Tag size={22} className="text-gray-400 dark:text-gray-500" />
          </div>
          <div className="flex-1 flex flex-col text-left">
            <span className="font-bold text-[15px] text-gray-800 dark:text-gray-200">Categoria</span>
            <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">
              {selectedCat ? selectedCat.name : 'Selecione a categoria...'}
            </span>
          </div>
          <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
        </button>

        <div className="flex justify-center pt-2 pb-2">
          <button onClick={() => { setShowDetails(!showDetails); vibrate([10]) }} className="text-[14px] font-bold text-orange-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors active:scale-[0.95] px-4 py-2 rounded-full hover:bg-orange-50 dark:hover:bg-orange-900/10">
            {showDetails ? 'Ocultar detalhes' : 'Mais detalhes'}
          </button>
        </div>

        {showDetails && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            
            <div className="flex items-center gap-4 border border-gray-100 dark:border-slate-700 p-4 rounded-[24px] bg-white dark:bg-slate-800 shadow-sm">
              <Hash size={22} className="text-gray-400 dark:text-gray-500 shrink-0" />
              <div className="flex-1 flex flex-col">
                <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Parcelas</span>
                <select value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className="text-[14px] font-bold text-gray-500 dark:text-gray-400 outline-none bg-transparent mt-0.5 appearance-none cursor-pointer">
                  <option value={1}>1x (À vista)</option>
                  {[2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}x</option>)}
                </select>
              </div>
              <ChevronRight size={18} className="text-gray-300 dark:text-gray-600 pointer-events-none" />
            </div>

            <div className="flex items-center gap-4 border border-gray-100 dark:border-slate-700 p-4 rounded-[24px] bg-white dark:bg-slate-800 shadow-sm">
              <Edit3 size={22} className="text-gray-400 dark:text-gray-500 opacity-50 shrink-0" />
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações (opcional)" className="flex-1 text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none bg-transparent placeholder:text-gray-300 dark:placeholder:text-gray-500" />
            </div>

            <button onClick={() => { setShowTagModal(true); vibrate([10]) }} className="w-full flex items-center gap-4 border border-gray-100 dark:border-slate-700 p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-[24px] active:scale-[0.98] shadow-sm">
              <div className="w-12 h-12 rounded-[16px] bg-gray-50 dark:bg-slate-700 flex items-center justify-center shrink-0">
                <Tag size={22} className="text-gray-400 dark:text-gray-500 opacity-50" />
              </div>
              <div className="flex-1 flex flex-col text-left">
                <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Tags</span>
                <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">{selectedTag ? selectedTag.name : 'Nenhuma tag'}</span>
              </div>
              <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
            </button>

          </div>
        )}

      </div>

      <div className="fixed bottom-6 left-0 w-full flex justify-center pointer-events-none z-50">
        <button 
          onClick={handleSave}
          disabled={isSubmitting || saved}
          className={`pointer-events-auto w-16 h-16 rounded-full flex items-center justify-center text-white shadow-[0_4px_20px_rgba(249,115,22,0.3)] hover:scale-105 transition-all duration-300 active:scale-[0.90] ${
            saved ? 'bg-emerald-500 scale-110' : 'bg-orange-500 hover:bg-orange-600'
          }`}
        >
          {isSubmitting ? <Loader2 className="animate-spin" size={28} /> : saved ? <Check size={32} className="animate-in zoom-in duration-300" /> : <Check size={32} />}
        </button>
      </div>

      {/* Modal Cartão de Crédito */}
      {showCardModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCardModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-6 h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
              <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Cartão de Crédito</h3>
              <button onClick={() => setShowCardModal(false)} className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 p-2.5 rounded-full active:scale-[0.95] transition-transform"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              {(cards || []).map((card: any) => {
                const isActive = card.id === creditCardId
                return (
                  <button
                    key={card.id}
                    onClick={() => { setCreditCardId(card.id); setShowCardModal(false); vibrate([10]) }}
                    className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-colors active:scale-[0.98] ${isActive ? 'bg-orange-50 dark:bg-orange-900/30 border border-orange-100 dark:border-orange-800' : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'}`}
                  >
                    <div className="w-12 h-12 rounded-[16px] flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: card.color || '#f97316' }}>
                      {card.flag ? renderFlagIcon(card.flag) : <CreditCard size={22} />}
                    </div>
                    <div className="flex-1 text-left">
                      <span className={`font-bold ${isActive ? 'text-orange-600 dark:text-orange-400' : 'text-gray-800 dark:text-gray-200'}`}>{card.name}</span>
                      {card.last_four && <span className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1">(••{card.last_four})</span>}
                    </div>
                    {isActive && <Check size={22} className="text-orange-600 dark:text-orange-400" />}
                  </button>
                )
              })}
              {(cards || []).length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 mt-10 font-medium">Nenhum cartão cadastrado neste contexto.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Categoria */}
      {showCatModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCatModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-6 h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
              <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Categorias</h3>
              <button onClick={() => { setShowCatModal(false); router.push('/categories'); vibrate([10]) }} className="text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 p-2.5 rounded-full active:scale-[0.95] transition-transform"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {categories.map((cat: any) => {
                const IconComp = getDynamicIcon(cat.icon)
                const isActive = cat.id === categoryId
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setCategoryId(cat.id); setShowCatModal(false); vibrate([10]) }}
                    className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-colors active:scale-[0.98] ${isActive ? 'bg-orange-50 dark:bg-orange-900/30 border border-orange-100 dark:border-orange-800' : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'}`}
                  >
                    <div className="w-12 h-12 rounded-[16px] flex items-center justify-center shadow-sm" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                      <IconComp size={22} />
                    </div>
                    <span className={`flex-1 text-left font-bold ${isActive ? 'text-orange-600 dark:text-orange-400' : 'text-gray-800 dark:text-gray-200'}`}>{cat.name}</span>
                    {isActive && <Check size={22} className="text-orange-600 dark:text-orange-400" />}
                  </button>
                )
              })}
              {categories.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 mt-10 font-medium">Nenhuma categoria encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Tags */}
      {showTagModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowTagModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-6 h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-slate-800 py-2 z-10">
              <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Tags</h3>
              <button onClick={() => { setShowTagModal(false); router.push('/tags'); vibrate([10]) }} className="text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 p-2.5 rounded-full active:scale-[0.95] transition-transform"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {(tags || []).map((tag: any) => {
                const isActive = tag.id === tagId
                return (
                  <button
                    key={tag.id}
                    onClick={() => { setTagId(tag.id); setShowTagModal(false); vibrate([10]) }}
                    className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-colors active:scale-[0.98] ${isActive ? 'bg-orange-50 dark:bg-orange-900/30 border border-orange-100 dark:border-orange-800' : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'}`}
                  >
                    <div className="w-5 h-5 rounded-full shadow-sm" style={{ backgroundColor: tag.color }} />
                    <span className={`flex-1 text-left font-bold ${isActive ? 'text-orange-600 dark:text-orange-400' : 'text-gray-800 dark:text-gray-200'}`}>{tag.name}</span>
                    {isActive && <Check size={22} className="text-orange-600 dark:text-orange-400" />}
                  </button>
                )
              })}
              {(tags || []).length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 mt-10 font-medium">Nenhuma tag encontrada.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
