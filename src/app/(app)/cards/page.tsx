'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, CreditCard, Loader2 } from 'lucide-react'
import InvoiceAlert from '@/components/InvoiceAlert'

const formatCurrency = (val: number) =>
  `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function CardsListPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [cards, setCards] = useState<any[]>([])
  const [totalFaturas, setTotalFaturas] = useState(0)
  const [context, setContext] = useState<'dfl' | 'personal'>('dfl')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCardsAndInvoices() {
      if (!user?.id) return
      setLoading(true)

      const { data: creditCards } = await supabase
        .from('credit_cards')
        .select('*')
        .match({ user_id: user.id, context: context, is_archived: false })
        .order('created_at', { ascending: false })

      // Buscar transações do MÊS ATUAL para calcular fatura (não apenas pendentes)
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
      const processedCards = (Array.isArray(creditCards) ? creditCards : []).map(
        (card) => {
          const fatura = txs
            .filter((t) => t.credit_card_id === card.id)
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
          const limiteLivre = (Number(card.limit_amount) || 0) - fatura
          somaTotal += fatura
          return { ...card, fatura, limiteLivre }
        }
      )

      setCards(processedCards)
      setTotalFaturas(somaTotal)
      setLoading(false)
    }

    loadCardsAndInvoices()
  }, [user?.id, context])

  const renderCardLogo = (cardFlag: string) => {
    switch (cardFlag) {
      case 'Visa':
        return (
          <span className="text-xl font-bold italic tracking-tighter text-white">
            VISA
          </span>
        )
      case 'Mastercard':
        return (
          <div className="flex">
            <div className="w-5 h-5 bg-red-500 rounded-full mix-blend-multiply opacity-90" />
            <div className="w-5 h-5 bg-yellow-500 rounded-full mix-blend-multiply -ml-2 opacity-90" />
          </div>
        )
      case 'Elo':
        return (
          <span className="text-sm font-bold tracking-tight text-white">
            elo
          </span>
        )
      case 'Amex':
        return (
          <span className="text-[10px] font-bold text-white bg-blue-500 px-1 py-0.5 rounded">
            AMEX
          </span>
        )
      case 'Hipercard':
        return (
          <span className="text-xs font-bold text-red-100 italic">
            HIPER
          </span>
        )
      default:
        return <CreditCard size={20} className="text-white" />
    }
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/home')}
            className="p-2 -ml-2 text-gray-800 dark:text-gray-200"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            Meus Cartões
          </h1>
          <button
            onClick={() => router.push('/cards/new')}
            className="p-2 -mr-2 text-teal-700 dark:text-teal-400"
          >
            <Plus size={24} />
          </button>
        </div>

        <div className="flex bg-gray-100 dark:bg-slate-700 rounded-full p-1 w-full max-w-[200px] mx-auto mb-2">
          {(['dfl', 'personal'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setContext(c)}
              className={`flex-1 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
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

      {/* Alertas de vencimento dos cartões */}
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

      <div className="px-4 mb-6">
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm rounded-2xl p-4 flex items-start justify-between">
          <div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
              Total em faturas
            </p>
            <p
              className={`text-[20px] font-bold mb-2 ${
                totalFaturas > 0
                  ? 'text-orange-500'
                  : 'text-gray-800 dark:text-gray-200'
              }`}
            >
              {totalFaturas > 0
                ? formatCurrency(totalFaturas)
                : 'Sem fatura atual'}
            </p>
            {totalFaturas === 0 && (
              <div className="bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 text-[11px] px-3 py-1 rounded-full inline-block">
                Sem fatura atual para destacar
              </div>
            )}
          </div>
          <div className="w-10 h-10 bg-teal-50 dark:bg-teal-900/30 rounded-xl flex items-center justify-center">
            <CreditCard
              size={20}
              className="text-teal-700 dark:text-teal-400"
            />
          </div>
        </div>
      </div>

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
          <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">
            Nenhum cartão cadastrado.
          </div>
        ) : (
          cards.map((card) => (
            <div
              key={card.id}
              onClick={() => router.push(`/cards/${card.id}`)}
              className="bg-white dark:bg-slate-800 p-4 border border-gray-50 dark:border-slate-700 rounded-2xl shadow-sm cursor-pointer hover:border-teal-100 dark:hover:border-teal-800 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm relative overflow-hidden"
                  style={{ backgroundColor: card.color }}
                >
                  <div className="absolute top-0 right-0 w-6 h-6 bg-white/10 rounded-bl-full" />
                  {renderCardLogo(card.flag)}
                </div>
                <div>
                  <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200">
                    {card.name}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {card.flag || 'Cartão'}{' '}
                    {card.last_four ? `•••• ${card.last_four}` : ''}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Limite livre: {formatCurrency(card.limiteLivre)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                  Fatura
                </p>
                <p
                  className={`text-[14px] font-bold mb-0.5 ${
                    card.fatura > 0
                      ? 'text-orange-500'
                      : 'text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {formatCurrency(card.fatura)}
                </p>
                <p className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                  Vence dia {card.due_day}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}