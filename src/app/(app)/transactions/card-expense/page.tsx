'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ChevronLeft, Calendar, Edit3, Tag, CreditCard, RefreshCw, Check, Loader2, ChevronRight, Hash } from 'lucide-react'
import { format } from 'date-fns'

export default function CardExpensePage() {
  const router = useRouter()
  const { user } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Listas do Banco de Dados
  const [cards, setCards] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])

  // Estados do Formulário
  const [amountInput, setAmountInput] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [creditCardId, setCreditCardId] = useState('')
  
  // Estados de "Mais Detalhes"
  const [showDetails, setShowDetails] = useState(false)
  const [notes, setNotes] = useState('')
  const [tagId, setTagId] = useState('')
  const [installments, setInstallments] = useState(1) // Parcelas

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: cardData }, { data: catData }, { data: tagData }] = await Promise.all([
        supabase.from('credit_cards').select('id, name, last_four, color').eq('is_archived', false).order('name'),
        supabase.from('categories').select('id, name, color, icon').eq('type', 'expense').order('name'),
        supabase.from('tags').select('id, name').order('name')
      ])
      
      setCards(cardData || [])
      setCategories(catData || [])
      setTags(tagData || [])
    } catch (err) {
      console.error("Erro ao carregar dados:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    const num = Number(rawValue) / 100
    setAmountInput(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
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
    
    // Se for parcelado, adiciona a informação nas observações (Avançado: depois podemos criar um loop que insere N transações no banco para cada parcela)
    const parcelasTexto = installments > 1 ? `[Parcelado em ${installments}x] ` : '';
    const finalNotes = `${parcelasTexto}${notes}`.trim();
    
    const payload = {
      user_id: user.id,
      amount: rawAmount,
      status: 'pending', // Gasto no cartão sempre entra como pendente até a fatura ser paga
      date,
      description: description || null,
      category_id: categoryId || null,
      credit_card_id: creditCardId, // <-- Conexão com o Cartão!
      tag_id: tagId || null,
      notes: finalNotes || null,
      type: 'expense',
      context: 'dfl' // Posteriormente podemos dinamizar
    }

    try {
      const { error } = await supabase.from('transactions').insert([payload])
      if (error) throw error
      router.push('/home') // Volta pra home após salvar
    } catch (err: any) {
       console.error("Erro ao salvar:", err)
       alert("Erro ao salvar despesa: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
      <Loader2 className="animate-spin text-orange-500" size={40} />
    </div>
  )

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] font-sans pb-24 relative">
      
      {/* Header */}
      <div className="flex justify-between items-center p-4">
        <button onClick={() => router.back()} className="text-gray-800 p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-bold text-[16px] text-gray-800">Despesa no Cartão</h1>
        <div className="w-8" /> {/* Espaçador */}
      </div>

      {/* Valor Header */}
      <div className="px-6 py-4 mb-4">
        <p className="text-gray-500 text-[13px] font-medium mb-2">Valor da compra</p>
        <div className="flex items-center gap-2">
          <span className="text-3xl text-gray-400 font-light">R$</span>
          <input 
            type="text" 
            inputMode="numeric"
            value={amountInput}
            onChange={handleAmountChange}
            className="text-4xl font-light bg-transparent outline-none w-full text-orange-500"
            placeholder="0,00"
          />
        </div>
      </div>

      {/* Card Principal */}
      <div className="bg-white rounded-t-[32px] px-6 py-6 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] space-y-6">
        
        {/* Cartão de Crédito */}
        <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
          <CreditCard size={22} className="text-orange-400" />
          <div className="flex-1 flex flex-col">
            <span className="font-bold text-[14px] text-gray-800">Cartão de Crédito</span>
            <select value={creditCardId} onChange={(e) => setCreditCardId(e.target.value)} className="text-[14px] font-medium text-gray-500 outline-none bg-transparent mt-0.5 appearance-none cursor-pointer">
              <option value="">Selecione o cartão...</option>
              {cards.map(c => <option key={c.id} value={c.id}>{c.name} {c.last_four ? `(••${c.last_four})` : ''}</option>)}
            </select>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </div>

        {/* Data */}
        <div className="flex items-center gap-4 border-b border-gray-100 pb-5 relative">
          <Calendar size={22} className="text-gray-400" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 text-[15px] font-bold text-gray-800 outline-none bg-transparent" />
        </div>

        {/* Descrição */}
        <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
          <Edit3 size={22} className="text-gray-400" />
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição da compra" className="flex-1 text-[15px] text-gray-800 outline-none bg-transparent placeholder:text-gray-300" />
        </div>

        {/* Categoria */}
        <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
          <Tag size={22} className="text-gray-400" />
          <div className="flex-1 flex flex-col">
            <span className="font-bold text-[14px] text-gray-800">Categoria</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="text-[14px] text-gray-500 outline-none bg-transparent mt-0.5 appearance-none cursor-pointer">
              <option value="">Selecione...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </div>

        {/* Botão Mostrar/Ocultar Detalhes */}
        <div className="flex justify-center pt-2 pb-2">
          <button onClick={() => setShowDetails(!showDetails)} className="text-[14px] font-bold text-orange-500 hover:text-orange-600 transition-colors">
            {showDetails ? 'Ocultar detalhes' : 'Mais detalhes'}
          </button>
        </div>

        {/* --- DETALHES AVANÇADOS --- */}
        {showDetails && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
            
            {/* Parcelamento */}
            <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
              <Hash size={22} className="text-gray-400" />
              <div className="flex-1 flex flex-col">
                <span className="font-bold text-[14px] text-gray-800">Parcelas</span>
                <select value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className="text-[14px] text-gray-500 outline-none bg-transparent mt-0.5 appearance-none cursor-pointer">
                  <option value={1}>1x (À vista)</option>
                  {[2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}x</option>)}
                </select>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </div>

            {/* Observações */}
            <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
              <Edit3 size={22} className="text-gray-400 opacity-50" />
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações" className="flex-1 text-[14px] text-gray-800 outline-none bg-transparent placeholder:text-gray-300" />
            </div>

            {/* Tags */}
            <div className="flex items-center gap-4 pb-2">
              <Tag size={22} className="text-gray-400 opacity-50" />
              <div className="flex-1 flex flex-col">
                <span className="font-bold text-[14px] text-gray-800">Tags</span>
                <select value={tagId} onChange={(e) => setTagId(e.target.value)} className="text-[14px] text-gray-500 outline-none bg-transparent mt-0.5 appearance-none cursor-pointer">
                  <option value="">Nenhuma tag</option>
                  {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </div>

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

    </div>
  )
}
