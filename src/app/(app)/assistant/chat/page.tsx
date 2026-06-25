'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft,
  Send,
  Loader2,
  Bot,
  User,
  AlertCircle,
  Settings,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

interface Message {
  id: string
  role: 'user' | 'model'
  content: string
}

function ChatContent() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const getFinancialContext = useCallback(async (): Promise<string> => {
    if (!user?.id) return 'Dados indisponíveis.'

    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd')

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, categories(name)')
      .match({ user_id: user.id, context: context })
      .gte('date', start)
      .lte('date', end)

    const txs = Array.isArray(transactions) ? transactions : []

    const income = txs
      .filter((t: any) => t.type === 'income' && t.status === 'done')
      .reduce((a: number, t: any) => a + (Number(t.amount) || 0), 0)
    const expense = txs
      .filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
      .reduce((a: number, t: any) => a + (Number(t.amount) || 0), 0)

    const catMap: Record<string, number> = {}
    txs
      .filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
      .forEach((t: any) => {
        const name = t.categories?.name || 'Outros'
        catMap[name] = (catMap[name] || 0) + Number(t.amount || 0)
      })

    const topCategories = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => `- ${name}: ${formatCurrency(total)}`)
      .join('\n')

    return `RECEITAS: ${formatCurrency(income)}
DESPESAS: ${formatCurrency(expense)}
SALDO: ${formatCurrency(income - expense)}

TOP 5 CATEGORIAS DE GASTO:
${topCategories || 'Nenhum gasto registrado.'}`
  }, [user, context])

  // Carregar histórico do banco
  useEffect(() => {
    const loadHistory = async () => {
      if (!user?.id) return

      const { data: history } = await supabase
        .from('chat_history')
        .select('id, role, content')
        .eq('user_id', user.id)
        .eq('context', context)
        .order('created_at', { ascending: true })
        .limit(20)

      if (history && history.length > 0) {
        setMessages(history.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        })))
      } else {
        setMessages([
          {
            id: 'welcome',
            role: 'model',
            content: 'Olá! Sou o assistente financeiro do DFL Finance. Posso analisar seus gastos, sugerir economias e tirar dúvidas. Como posso ajudar?',
          },
        ])
      }
      setHistoryLoaded(true)
    }
    loadHistory()
  }, [user, context])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    if (!user?.id) return

    const apiKey = localStorage.getItem('dfl_ai_key') || ''
    const provider = localStorage.getItem('dfl_ai_provider') || 'gemini'
    const model = localStorage.getItem('dfl_ai_model') || 'gemini-2.0-flash'

    if (!apiKey.trim()) {
      setError('Configure sua chave de API nas configurações do Assistente.')
      return
    }

    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    const loadingMessage: Message = { id: crypto.randomUUID(), role: 'model', content: '...' }
    setMessages(prev => [...prev, loadingMessage])

    try {
      const financialContext = await getFinancialContext()

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'x-provider': provider,
          'x-model': model,
        },
        body: JSON.stringify({
          message: userMessage.content,
          context: financialContext,
          userId: user.id,
          chatContext: context,
        }),
      })

      const data = await response.json()

      setMessages(prev =>
        prev
          .filter(m => m.id !== loadingMessage.id)
          .concat({
            id: crypto.randomUUID(),
            role: 'model',
            content: data.error ? `Erro: ${data.error}` : data.message || 'Sem resposta.',
          })
      )

      if (data.error) setError(data.error)
    } catch (err: any) {
      setMessages(prev =>
        prev
          .filter(m => m.id !== loadingMessage.id)
          .concat({ id: crypto.randomUUID(), role: 'model', content: 'Erro de conexão.' })
      )
      setError('Erro de conexão.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans flex flex-col transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-3 bg-white dark:bg-slate-800 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <button onClick={() => router.push('/assistant')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
            <Bot size={20} className="text-teal-700 dark:text-teal-400" />
          </div>
          <h1 className="font-bold text-[16px] text-gray-800 dark:text-gray-100">Chat Financeiro</h1>
        </div>
        <button onClick={() => router.push('/assistant/settings')} className="p-2 -mr-2 text-gray-500 dark:text-gray-400">
          <Settings size={20} />
        </button>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {!historyLoaded ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-teal-700" size={32} />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-gray-400 py-20">Nenhuma mensagem.</p>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'model' && (
                <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                  <Bot size={16} className="text-teal-700 dark:text-teal-400" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-teal-600 text-white rounded-br-md'
                    : msg.content === '...'
                    ? 'bg-slate-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-bl-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-bl-md'
                }`}
              >
                {msg.content === '...' ? (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center ml-2 mt-1 flex-shrink-0">
                  <User size={16} className="text-white" />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Erro */}
      {error && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-red-700 dark:text-red-400 text-xs">
            <AlertCircle size={14} />
            {error}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 bg-white dark:bg-slate-800 border-t border-gray-50 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Digite sua mensagem..."
            disabled={isLoading}
            className="flex-1 bg-gray-50 dark:bg-slate-700 rounded-full px-4 py-3 text-[14px] text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="w-11 h-11 bg-teal-700 text-white rounded-full flex items-center justify-center hover:bg-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <ContextProvider>
      <ChatContent />
    </ContextProvider>
  )
}