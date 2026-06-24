'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Calendar, Edit3, Tag, CreditCard, RefreshCw, Check, Loader2, ChevronRight, Hash,
  X, Plus
} from 'lucide-react'
import { format } from 'date-fns'
import { getDynamicIcon } from '@/lib/iconUtils'

export default function CardExpensePage() {
  const router = useRouter()
  const { user } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [cards, setCards] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])

  const [amountInput, setAmountInput] = useState('')
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

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [{ data: cardData }, { data: catData }, { data: tagData }] = await Promise.all([
        supabase.from('credit_cards').select('id, name, last_four, color, flag').match({ user_id: user.id, is_archived: false }).order('name'),
        supabase.from('categories').select('id, name, color, icon').match({ user_id: user.id, type: 'expense' }).order('name'),
        supabase.from('tags').select('id, name').match({ user_id: user.id }).order('name')
      ])
      
      setCards(Array.isArray(cardData) ? cardData : [])
      setCategories(Array.isArray(catData) ? catData : [])
      setTags(Array.isArray(tagData) ? tagData : [])
    } catch (err) {
      console.error("Erro ao carregar dados:", err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    
    if (!digits) {
      setAmountInput('0,00')
      return
    }

    const numValue = parseFloat(digits) / 100

    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue)

    setAmountInput(formatted)
  }

  const handleSave = async () => {
    if (!user?.id) {
        alert("Sessão expirada. Faça login novamente.")
        return
    }

    if (!creditCardId) {
        alert("Por favor, selecione um cartão de crédito.")
        return
    }

    setSaving(true)
    const rawAmount = parseFloat(amountInput.replace(/\./g, '').replace(',', '.')) || 0;
    
    const parcelasTexto = installments > 1 ? `[Parcelado em ${installments}x] ` : '';
    const finalNotes = `${parcelasTexto}${notes}`.trim();
    
    const payload = {
      user_id: user.id,
      amount: rawAmount,
      status: 'pending',
      date,
      description: description || null,
      category_id: categoryId || null,
      credit_card_id: creditCardId,
      tag_id: tagId || null,
      notes: finalNotes || null,
      type: 'expense',
      context: 'dfl'
    }

    try {
      const { error } = await supabase.from('transactions').insert([payload])
      if (error) throw error
      router.push('/home')
    } catch (err: any) {
       console.error("Erro ao salvar:", err)
       alert("Erro ao salvar despesa: " + err.message)
    } finally {
      setSaving(false)
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

  const selectedCard = cards.find(c => c.id === creditCardId)
  const selectedCat = categories.find(c => c.id === categoryId)
  const selectedTag = tags.find(t => t.id === tagId)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      
      <div className="flex justify-between items-center p-4">
        <button onClick={() => router.back()} className="text-gray-800 dark:text-gray-200 p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-bold text-[16px] text-gray-800 dark:text-gray-100">Despesa no Cartão</h1>
        <div className="w-8" />
      </div>

      <div className="px-6 py-4 mb-4">
        <p className="text-gray-500 dark:text-gray-400 text-[13px] font-medium mb-2">Valor da compra</p>
        <div className="flex items-center gap-2">
          <span className="text-3xl text-gray-400 dark:text-gray-500 font-light">R$</span>
          <input 
            type="text" 
            inputMode="numeric"
            value={amountInput}
            onChange={handleAmountChange}
            className="text-4xl font-light bg-transparent outline-none w-full text-orange-500 dark:text-orange-400"
            placeholder="0,00"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-t-[32px] px-6 py-6 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] dark:shadow-none space-y-6 transition-colors duration-300">
        
        {/* Cartão de Crédito - agora com modal estilizado */}
        <button onClick={() => setShowCardModal(true)} className="w-full flex items-center gap-4 border-b border-gray-100 dark:border-slate-700 pb-5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors rounded-lg">
          <CreditCard size={22} className="text-orange-400" />
          <div className="flex-1 flex flex-col text-left">
            <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Cartão de Crédito</span>
            <span className="text-[14px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">
              {selectedCard ? `${selectedCard.name} ${selectedCard.last_four ? `(••${selectedCard.last_four})` : ''}` : 'Selecione o cartão...'}
            </span>
          </div>
          <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
        </button>

        <div className="flex items-center gap-4 border-b border-gray-100 dark:border-slate-700 pb-5 relative">
          <Calendar size={22} className="text-gray-400 dark:text-gray-500" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none bg-transparent" />
        </div>

        <div className="flex items-center gap-4 border-b border-gray-100 dark:border-slate-700 pb-5">
          <Edit3 size={22} className="text-gray-400 dark:text-gray-500" />
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição da compra" className="flex-1 text-[15px] text-gray-800 dark:text-gray-200 outline-none bg-transparent placeholder:text-gray-300 dark:placeholder-gray-500" />
        </div>

        {/* Categoria - agora com modal estilizado */}
        <button onClick={() => setShowCatModal(true)} className="w-full flex items-center gap-4 border-b border-gray-100 dark:border-slate-700 pb-5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors rounded-lg">
          <Tag size={22} className="text-gray-400 dark:text-gray-500" />
          <div className="flex-1 flex flex-col text-left">
            <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Categoria</span>
            <span className="text-[14px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">
              {selectedCat ? selectedCat.name : 'Selecione...'}
            </span>
          </div>
          <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
        </button>

        <div className="flex justify-center pt-2 pb-2">
          <button onClick={() => setShowDetails(!showDetails)} className="text-[14px] font-bold text-orange-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
            {showDetails ? 'Ocultar detalhes' : 'Mais detalhes'}
          </button>
        </div>

        {showDetails && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
            
            <div className="flex items-center gap-4 border-b border-gray-100 dark:border-slate-700 pb-5">
              <Hash size={22} className="text-gray-400 dark:text-gray-500" />
              <div className="flex-1 flex flex-col">
                <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Parcelas</span>
                <select value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className="text-[14px] text-gray-500 dark:text-gray-400 outline-none bg-transparent mt-0.5 appearance-none cursor-pointer">
                  <option value={1}>1x (À vista)</option>
                  {[2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}x</option>)}
                </select>
              </div>
              <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
            </div>

            <div className="flex items-center gap-4 border-b border-gray-100 dark:border-slate-700 pb-5">
              <Edit3 size={22} className="text-gray-400 dark:text-gray-500 opacity-50" />
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações" className="flex-1 text-[14px] text-gray-800 dark:text-gray-200 outline-none bg-transparent placeholder:text-gray-300 dark:placeholder-gray-500" />
            </div>

            {/* Tags - agora com modal estilizado */}
            <button onClick={() => setShowTagModal(true)} className="w-full flex items-center gap-4 pb-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors rounded-lg">
              <Tag size={22} className="text-gray-400 dark:text-gray-500 opacity-50" />
              <div className="flex-1 flex flex-col text-left">
                <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Tags</span>
                <span className="text-[14px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">{selectedTag ? selectedTag.name : 'Nenhuma tag'}</span>
              </div>
              <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
            </button>

          </div>
        )}

      </div>

      {/* Botão de Salvar Flutuante */}
      <div className="fixed bottom-6 left-0 w-full flex justify-center pointer-events-none z-50">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-xl pointer-events-auto hover:bg-orange-600 transition-colors"
        >
          {saving ? <Loader2 className="animate-spin" size={24} /> : <Check size={28} />}
        </button>
      </div>

      {/* Modal Cartão de Crédito */}
      {showCardModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCardModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Cartão de Crédito</h3>
              <button onClick={() => setShowCardModal(false)} className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              {cards.map(card => {
                const isActive = card.id === creditCardId
                return (
                  <button
                    key={card.id}
                    onClick={() => { setCreditCardId(card.id); setShowCardModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: card.color || '#f97316' }}>
                      {card.flag ? renderFlagIcon(card.flag) : <CreditCard size={18} />}
                    </div>
                    <div className="flex-1 text-left">
                      <span className={`font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{card.name}</span>
                      {card.last_four && <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">(••{card.last_four})</span>}
                    </div>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              {cards.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 mt-10">Nenhum cartão cadastrado.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Categoria */}
      {showCatModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCatModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Categorias</h3>
              <button onClick={() => { setShowCatModal(false); router.push('/categories'); }} className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 p-2 rounded-full"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {categories.map(cat => {
                const IconComp = getDynamicIcon(cat.icon)
                const isActive = cat.id === categoryId
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setCategoryId(cat.id); setShowCatModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                      <IconComp size={20} />
                    </div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{cat.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              {categories.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 mt-10">Nenhuma categoria encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Tags */}
      {showTagModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowTagModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Tags</h3>
              <button onClick={() => { setShowTagModal(false); router.push('/tags'); }} className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 p-2 rounded-full"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {tags.map(tag => {
                const isActive = tag.id === tagId
                return (
                  <button
                    key={tag.id}
                    onClick={() => { setTagId(tag.id); setShowTagModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{tag.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              {tags.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 mt-10">Nenhuma tag encontrada.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}