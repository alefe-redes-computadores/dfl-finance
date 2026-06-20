'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { 
  ChevronLeft, Plus, ChevronRight, Tag, Landmark, 
  CreditCard, Calendar, PiggyBank, Palette, DollarSign, 
  Check, Trash2, Archive 
} from 'lucide-react'

const PREDEFINED_COLORS = ['#2a9d8f', '#e76f51', '#264653', '#e9c46a', '#1d3557', '#e63946', '#8338ec', '#ffb703', '#3a0ca3']
const FLAGS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard']

export default function CardsPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [cards, setCards] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [context, setContext] = useState<'dfl' | 'personal'>('dfl')
  const [loading, setLoading] = useState(true)

  // Estados do Modal
  const [showForm, setShowForm] = useState(false)
  const [editingCard, setEditingCard] = useState<any | null>(null)
  
  // Campos do Formulário
  const [name, setName] = useState('')
  const [flag, setFlag] = useState('')
  const [institution, setInstitution] = useState('')
  const [lastFour, setLastFour] = useState('')
  const [closingDay, setClosingDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [color, setColor] = useState(PREDEFINED_COLORS[0])
  const [limitAmount, setLimitAmount] = useState('')
  const [saving, setSaving] = useState(false)

  // CORREÇÃO DO CARREGAMENTO INFINITO AQUI: Usando user?.id
  useEffect(() => {
    if (user?.id) {
      loadCards()
      loadAccounts()
    }
  }, [user?.id, context])

  async function loadCards() {
    setLoading(true)
    const { data } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('user_id', user!.id)
      .eq('context', context)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    setCards(data ?? [])
    setLoading(false)
  }

  async function loadAccounts() {
    const { data } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('user_id', user!.id)
      .eq('context', context)
    setAccounts(data ?? [])
  }

  function openNew() {
    setEditingCard(null)
    setName('')
    setFlag('')
    setInstitution('')
    setLastFour('')
    setClosingDay('')
    setDueDay('')
    setPaymentAccountId('')
    setColor(PREDEFINED_COLORS[0])
    setLimitAmount('')
    setShowForm(true)
  }

  function openEdit(card: any) {
    setEditingCard(card)
    setName(card.name)
    setFlag(card.flag || '')
    setInstitution(card.institution || '')
    setLastFour(card.last_four || '')
    setClosingDay(card.closing_day?.toString() || '')
    setDueDay(card.due_day?.toString() || '')
    setPaymentAccountId(card.payment_account_id || '')
    setColor(card.color)
    setLimitAmount(card.limit_amount?.toString() || '')
    setShowForm(true)
  }

  async function handleSave() {
    if (!name.trim() || !closingDay || !dueDay) {
      alert('Preencha o nome, fechamento e vencimento.')
      return
    }
    setSaving(true)

    const payload = {
      user_id: user!.id,
      context,
      name,
      flag,
      institution,
      last_four: lastFour,
      closing_day: parseInt(closingDay),
      due_day: parseInt(dueDay),
      payment_account_id: paymentAccountId || null,
      color,
      limit_amount: parseFloat(limitAmount.replace(',', '.') || '0')
    }

    if (editingCard) {
      await supabase.from('credit_cards').update(payload).eq('id', editingCard.id)
    } else {
      await supabase.from('credit_cards').insert(payload)
    }

    setShowForm(false)
    setSaving(false)
    loadCards()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este cartão definitivamente?')) return
    await supabase.from('credit_cards').delete().eq('id', id)
    setShowForm(false)
    loadCards()
  }

  const formatCurrency = (val: number) => `R$ ${val.toFixed(2).replace('.', ',')}`

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] font-sans pb-24 relative">
      
      {/* Header Listagem */}
      <div className="bg-white px-4 pt-6 pb-4 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800">Meus Cartões</h1>
          <button onClick={openNew} className="p-2 -mr-2 text-emerald-800">
            <Plus size={24} />
          </button>
        </div>

        {/* Seletor DFL / Pessoal */}
        <div className="flex bg-gray-100 rounded-full p-1 w-full max-w-[200px] mx-auto mb-2">
          {(['dfl', 'personal'] as const).map(c => (
            <button
              key={c}
              onClick={() => setContext(c)}
              className={`flex-1 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
                context === c ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
              }`}
            >
              {c === 'dfl' ? 'DFL' : 'Pessoal'}
            </button>
          ))}
        </div>
      </div>

      {/* Resumo Faturas */}
      <div className="px-4 mb-6">
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex items-start justify-between">
          <div>
            <p className="text-[11px] text-gray-500 font-medium">Total em faturas</p>
            <p className="text-[15px] font-bold text-gray-800 mb-2">Sem fatura atual</p>
            <div className="bg-gray-100 text-gray-500 text-[11px] px-3 py-1 rounded-full inline-block">
              Sem fatura atual para destacar
            </div>
          </div>
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
            <CreditCard size={20} className="text-emerald-700" />
          </div>
        </div>
      </div>

      <div className="px-4 mb-2">
        <h3 className="text-[13px] font-bold text-gray-800">Cartões ativos</h3>
      </div>

      {/* Lista de Cartões */}
      <div className="px-4 space-y-3">
        {loading ? (
          <div className="text-center py-10 text-gray-400 text-sm">Carregando cartões...</div>
        ) : cards.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Nenhum cartão cadastrado.</div>
        ) : (
          cards.map(card => (
            <div 
              key={card.id} 
              onClick={() => openEdit(card)}
              className="bg-white p-4 border border-gray-50 rounded-2xl shadow-sm cursor-pointer hover:border-emerald-100 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                  style={{ backgroundColor: card.color }}
                >
                  {card.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-[14px] font-bold text-gray-800">{card.name}</p>
                  <p className="text-[11px] text-gray-500">{card.flag || 'Cartão'} {card.last_four ? `•••• ${card.last_four}` : ''}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Limite livre: {formatCurrency(Number(card.limit_amount))}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Sem fatura</p>
                <p className="text-[14px] font-bold text-gray-800 mb-0.5">R$ 0,00</p>
                <p className="text-[11px] text-emerald-600 font-medium">Vence dia {card.due_day}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Criar/Editar Cartão */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-[#f8f9fa] overflow-y-auto pb-24 flex flex-col">
          {/* Header Colorido Dinâmico */}
          <div className="pt-6 pb-8 px-4 shadow-sm relative transition-colors duration-300" style={{ backgroundColor: color }}>
            <div className="flex items-center justify-between mb-6 text-white">
              <button onClick={() => setShowForm(false)} className="p-2 -ml-2">
                <ChevronLeft size={24} />
              </button>
            </div>
            <div>
              <p className="text-white/80 text-[11px] font-medium uppercase tracking-wider mb-2">Nome do cartão</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
                  <CreditCard size={20} />
                </div>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Nubank, Inter"
                  className="bg-transparent text-white text-2xl font-light outline-none w-full placeholder:text-white/50"
                  autoFocus
                />
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white">
            
            {/* Bandeira */}
            <div className="p-4 border-b border-gray-50 flex flex-col gap-3">
              <div className="flex items-center gap-3 text-gray-500">
                <Tag size={18} /> <span className="text-[13px] font-bold text-gray-800">Bandeira</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide ml-8">
                {FLAGS.map(f => (
                  <button 
                    key={f} 
                    onClick={() => setFlag(f)}
                    className={`px-4 py-2 rounded-full text-[12px] font-medium whitespace-nowrap transition-all border ${
                      flag === f ? 'border-gray-800 text-gray-800 bg-gray-50' : 'border-gray-100 text-gray-500 bg-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Instituição */}
            <div className="p-4 border-b border-gray-50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-gray-500 flex-1">
                <Landmark size={18} /> 
                <div className="flex-1">
                  <span className="text-[13px] font-bold text-gray-800 block mb-1">Instituição</span>
                  <input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="Nome da instituição (opcional)" className="text-[12px] w-full outline-none text-gray-500" />
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </div>

            {/* Últimos 4 dígitos */}
            <div className="p-4 border-b border-gray-50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-gray-500 flex-1">
                <CreditCard size={18} /> 
                <span className="text-[13px] font-bold text-gray-800 flex-1">Últimos 4 dígitos</span>
              </div>
              <input value={lastFour} onChange={e => setLastFour(e.target.value.replace(/\D/g, '').slice(0,4))} placeholder="0000" className="text-[13px] w-16 text-right outline-none text-gray-500" />
            </div>

            {/* Datas */}
            <div className="flex border-b border-gray-50">
              <div className="p-4 flex-1 border-r border-gray-50">
                <div className="flex items-center gap-3 text-gray-500 mb-2">
                  <Calendar size={18} /> <span className="text-[13px] font-bold text-gray-800">Fechamento</span>
                </div>
                <input type="number" min="1" max="31" value={closingDay} onChange={e => setClosingDay(e.target.value)} placeholder="Dia" className="text-[13px] ml-8 outline-none text-gray-500 w-full" />
              </div>
              <div className="p-4 flex-1">
                <div className="flex items-center gap-3 text-gray-500 mb-2">
                  <Calendar size={18} /> <span className="text-[13px] font-bold text-gray-800">Vencimento</span>
                </div>
                <input type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} placeholder="Dia" className="text-[13px] ml-8 outline-none text-gray-500 w-full" />
              </div>
            </div>

            {/* Conta para pagamento */}
            <div className="p-4 border-b border-gray-50">
              <div className="flex items-center gap-3 text-gray-500">
                <PiggyBank size={18} /> 
                <div className="flex-1">
                  <span className="text-[13px] font-bold text-gray-800 block mb-1">Conta para pagamento</span>
                  <select 
                    value={paymentAccountId} 
                    onChange={e => setPaymentAccountId(e.target.value)}
                    className="text-[12px] w-full outline-none text-gray-500 bg-transparent appearance-none"
                  >
                    <option value="">Selecionar conta (opcional)</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
              </div>
            </div>

            {/* Cor */}
            <div className="p-4 border-b border-gray-50 flex flex-col gap-3">
               <div className="flex items-center gap-3 text-gray-500">
                <Palette size={18} /> <span className="text-[13px] font-bold text-gray-800">Cor do Cartão</span>
              </div>
              <div className="flex gap-2 flex-wrap ml-8 mt-1">
                {PREDEFINED_COLORS.map(c => (
                  <button 
                    key={c} onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-gray-800' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Limite */}
            <div className="p-4 border-b border-gray-50">
              <div className="flex items-center gap-3 text-gray-500 mb-3">
                <DollarSign size={18} /> <span className="text-[13px] font-bold text-gray-800">Limite de crédito</span>
              </div>
              <div className="ml-8 bg-gray-50 rounded-2xl p-4 flex items-center gap-2">
                <span className="text-gray-500 font-bold">R$</span>
                <input 
                  type="number" step="0.01" 
                  value={limitAmount} onChange={e => setLimitAmount(e.target.value)} 
                  placeholder="0,00" 
                  className="bg-transparent w-full outline-none font-bold text-gray-800 text-lg" 
                />
              </div>
            </div>

            {/* Ações de Edição */}
            {editingCard && (
              <div className="p-4 space-y-2 mt-4">
                <button className="flex items-center gap-3 text-[13px] font-bold text-gray-600 w-full p-2">
                  <Archive size={18} /> Arquivar cartão
                </button>
                <button onClick={() => handleDelete(editingCard.id)} className="flex items-center gap-3 text-[13px] font-bold text-red-500 w-full p-2">
                  <Trash2 size={18} /> Excluir cartão
                </button>
              </div>
            )}

          </div>

          {/* Botão Flutuante de Salvar */}
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-14 h-14 bg-emerald-800 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-emerald-900 transition-colors disabled:opacity-50"
          >
            <Check size={28} />
          </button>

        </div>
      )}

    </div>
  )
}

