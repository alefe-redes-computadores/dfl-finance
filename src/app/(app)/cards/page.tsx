'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, CreditCard, Loader2, Edit3, Eye, EyeOff } from 'lucide-react'
import InvoiceAlert from '@/components/InvoiceAlert'
import { getDynamicIcon } from '@/lib/iconUtils'

const formatCurrency = (val: number) =>
  `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function CardsListPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [cards, setCards] = useState<any[]>([])
  const [totalFaturas, setTotalFaturas] = useState(0)
  const [context, setContext] = useState<'dfl' | 'personal'>('dfl')
  const [loading, setLoading] = useState(true)
  const [hideValues, setHideValues] = useState(false)

  useEffect(() => {
    async function loadCardsAndInvoices() {
      if (!user?.id) return
      setLoading(true)

      const { data: creditCards } = await supabase
        .from('credit_cards')
        .select('*')
        .match({ user_id: user.id, context: context, is_archived: false })
        .order('created_at', { ascending: false })

      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0]
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split('T')[0]

      const { data: cardTxs } = await supabase
        .from('transactions')
        .select('amount, credit_card_id')
        .match({ user_id: user.id, context: context })
        .not('credit_card_id', 'is', null)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)

      const txs = Array.isArray(cardTxs) ? cardTxs : []

      let somaTotal = 0
      const processedCards = (Array.isArray(creditCards) ? creditCards : []).map((card) => {
        const fatura = txs
          .filter((t) => t.credit_card_id === card.id)
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
        const limite = Number(card.limit_amount) || 0
        const limiteLivre = limite - fatura
        const percentUsed = limite > 0 ? (fatura / limite) * 100 : 0
        somaTotal += fatura
        return { ...card, fatura, limiteLivre, percentUsed: Math.min(percentUsed, 100) }
      })

      setCards(processedCards)
      setTotalFaturas(somaTotal)
      setLoading(false)
    }

    loadCardsAndInvoices()
  }, [user?.id, context])

  const getProgressColor = (percent: number) => {
    if (percent > 80) return 'bg-red-500'
    if (percent > 50) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  const renderCardLogo = (cardFlag: string) => {
    const iconName =
      cardFlag === 'Visa' ? 'credit-card' :
      cardFlag === 'Mastercard' ? 'credit-card' :
      cardFlag === 'Elo' ? 'credit-card' :
      cardFlag === 'Amex' ? 'credit-card' :
      cardFlag === 'Hipercard' ? 'credit-card' :
      'credit-card'
    const IconComp = getDynamicIcon(iconName)
    return <IconComp size={20} className="text-white" />
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      {/* Header Premium */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/home')}
            className="p-2 -ml-2 text-gray-800 dark:text-gray-200"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            Meus Cartões {cards.length > 0 && `(${cards.length})`}
          </h1>
          <button
            onClick={() => router.push('/cards/new')}
            className="p-2 -mr-2 text-teal-700 dark:text-teal-400"
          >
            <Plus size={24} />
          </button>
        </div>

        {/* Seletor de contexto estilo banco */}
        <div className="flex bg-gray-100 dark:bg-slate-700 rounded-full p-1 w-full max-w-[200px] mx-auto mb-2">
          {(['dfl', 'personal'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setContext(c)}
              className={`flex-1 py-1.5 rounded-full text-[13px] font-bold transition-all duration-300 ${
                context === c
                  ? 'bg-white dark:bg-slate-600 text-gray-800 dark:text-gray-200 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {c === 'dfl' ? 'DFL' : 'Pessoal'}
            </button>
          ))}
        </div>
      </div>

      {/* Alertas de vencimento */}
      {cards.length > 0 && (
        <div className="px-4 mb-6 space-y-2">
          {cards.map((card) => (
            <InvoiceAlert
              key={card.id}
              dueDay={card.due_day}
              closingDay={card.closing_day}
              cardName={card.name}
            />
          ))}
        </div>
      )}

      {/* Card de total com opção de esconder */}
      <div className="px-4 mb-6">
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm rounded-2xl p-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                Total em faturas
              </p>
              <button onClick={() => setHideValues(!hideValues)} className="text-gray-400 hover:text-gray-600">
                {hideValues ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className={`text-[20px] font-bold mb-2 ${totalFaturas > 0 ? 'text-orange-500' : 'text-gray-800 dark:text-gray-200'}`}>
              {hideValues ? '••••••' : (totalFaturas > 0 ? formatCurrency(totalFaturas) : 'Sem fatura atual')}
            </p>
            {totalFaturas === 0 && (
              <div className="bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 text-[11px] px-3 py-1 rounded-full inline-block">
                Nenhuma fatura em aberto
              </div>
            )}
          </div>
          <div className="w-10 h-10 bg-teal-50 dark:bg-teal-900/30 rounded-xl flex items-center justify-center">
            <CreditCard size={20} className="text-teal-700 dark:text-teal-400" />
          </div>
        </div>
      </div>

      {/* Lista de cartões */}
      <div className="px-4 mb-2">
        <h3 className="text-[13px] font-bold text-gray-800 dark:text-gray-100">
          Cartões ativos
        </h3>
      </div>

      <div className="px-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-teal-700" size={32} />
          </div>
        ) : cards.length === 0 ? (
          <button
            onClick={() => router.push('/cards/new')}
            className="w-full border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-2xl p-6 flex flex-col items-center gap-2 text-gray-400 hover:border-teal-500 hover:text-teal-600 transition-colors"
          >
            <Plus size={32} />
            <span className="text-sm font-medium">Adicionar novo cartão</span>
          </button>
        ) : (
          cards.map((card, index) => (
            <div
              key={card.id}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Corpo do cartão com gradiente */}
              <div
                className="p-4 cursor-pointer"
                onClick={() => router.push(`/cards/${card.id}`)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-14 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm relative overflow-hidden"
                    style={{ 
                      background: `linear-gradient(135deg, ${card.color}, ${card.color}dd)` 
                    }}
                  >
                    <div className="absolute top-0 right-0 w-6 h-6 bg-white/10 rounded-bl-full" />
                    {renderCardLogo(card.flag)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate">
                      {card.name}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {card.flag || 'Cartão'} {card.last_four ? `•••• ${card.last_four}` : ''}
                    </p>
                  </div>

                  {/* Botão editar */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/cards/${card.id}/edit`)
                    }}
                    className="p-2 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                  >
                    <Edit3 size={18} />
                  </button>
                </div>

                {/* Barra de progresso do limite */}
                <div className="mb-2">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-gray-500">Limite utilizado</span>
                    <span className={`font-bold ${card.percentUsed > 80 ? 'text-red-500' : card.percentUsed > 50 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {card.percentUsed.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getProgressColor(card.percentUsed)}`}
                      style={{ width: `${card.percentUsed}%` }}
                    />
                  </div>
                </div>

                {/* Rodapé com fatura e vencimento */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                      Fatura atual
                    </p>
                    <p className={`text-[15px] font-bold ${card.fatura > 0 ? 'text-orange-500' : 'text-gray-800 dark:text-gray-200'}`}>
                      {hideValues ? '••••' : formatCurrency(card.fatura)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                      Vencimento
                    </p>
                    <p className={`text-[13px] font-bold ${card.fatura > 0 ? 'text-teal-600 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>
                      Dia {card.due_day}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}