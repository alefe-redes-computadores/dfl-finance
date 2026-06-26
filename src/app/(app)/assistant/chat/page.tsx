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
}'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Send, Loader2, Bot, User, Key, Settings,
  Sparkles, RefreshCw, Trash2, Copy, Check, X
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/lib/hooks/useAuth'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Quanto gastei este mês?',
  'Qual meu saldo atual?',
  'Sugira um orçamento para alimentação',
  'Minhas despesas por categoria',
  'Previsão para o próximo mês',
  'Como posso economizar mais?',
]

export default function AssistantPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [tempKey, setTempKey] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('dfl_assistant_api_key')
    if (saved) {
      setApiKey(saved)
      setTempKey(saved)
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const saveApiKey = () => {
    localStorage.setItem('dfl_assistant_api_key', tempKey)
    setApiKey(tempKey)
    setShowSettings(false)
    showToast('Chave de API salva!', 'success')
  }

  const handleSend = async (text?: string) => {
    const messageText = text || input
    if (!messageText.trim()) return
    if (!apiKey) {
      showToast('Configure sua chave de API primeiro.', 'warning')
      setShowSettings(true)
      return
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText.trim(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({
            role: m.role,
            content: m.content,
          })),
          apiKey,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro desconhecido')
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.text,
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch (error: any) {
      showToast(error.message || 'Erro ao comunicar com a IA.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion)
  }

  const handleClearChat = () => {
    setMessages([])
    showToast('Conversa limpa!', 'info')
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('Copiado!', 'success')
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 flex flex-col font-sans transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
              <Bot size={18} className="text-teal-700 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="font-bold text-[17px] text-gray-800 dark:text-gray-100">Assistente IA</h1>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">BYOK - Sua chave, seus dados</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleClearChat} className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors" title="Limpar conversa">
            <Trash2 size={18} />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-teal-700 dark:hover:text-teal-400 transition-colors" title="Configurar API">
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Área de mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-20 h-20 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mb-4">
              <Bot size={36} className="text-teal-700 dark:text-teal-400" />
            </div>
            <h2 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-2">Assistente Financeiro</h2>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-6 max-w-xs">
              Tire dúvidas sobre suas finanças, peça análises e receba sugestões personalizadas.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:text-teal-700 dark:hover:text-teal-400 hover:border-teal-200 dark:hover:border-teal-800 transition-all shadow-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'assistant' ? '' : 'justify-end'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot size={16} className="text-teal-700 dark:text-teal-400" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'assistant'
                    ? 'bg-white dark:bg-slate-800 border border-gray-50 dark:border-slate-700 text-gray-800 dark:text-gray-200'
                    : 'bg-teal-700 text-white'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleCopy(msg.content)}
                      className="mt-2 text-[10px] flex items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                    >
                      <Copy size={12} /> Copiar
                    </button>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-teal-700 flex items-center justify-center flex-shrink-0 mt-1">
                    <User size={16} className="text-white" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot size={16} className="text-teal-700 dark:text-teal-400" />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-gray-50 dark:border-slate-700 rounded-2xl px-4 py-3">
                  <Loader2 size={20} className="animate-spin text-teal-700" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-slate-800 px-4 py-4 border-t border-gray-50 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Pergunte sobre suas finanças..."
            className="flex-1 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl px-4 py-3 text-sm outline-none focus:border-teal-500 transition-colors text-gray-800 dark:text-gray-200 placeholder:text-gray-400"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center disabled:opacity-50 hover:bg-teal-800 transition-colors flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 size={18} className="text-white animate-spin" />
            ) : (
              <Send size={18} className="text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Modal de Configuração da API */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-t-[32px] w-full max-w-md p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                  <Key size={20} className="text-teal-700 dark:text-teal-400" />
                </div>
                <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100">Chave da API</h2>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 dark:text-gray-500 p-2">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Sua chave é salva apenas no seu dispositivo (localStorage) e enviada diretamente para a API do Google.
            </p>
            <input
              type="password"
              value={tempKey}
              onChange={e => setTempKey(e.target.value)}
              placeholder="Cole sua chave Gemini API aqui..."
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-teal-500 transition-colors mb-4 text-gray-800 dark:text-gray-200"
            />
            <button
              onClick={saveApiKey}
              disabled={!tempKey.trim()}
              className="w-full bg-teal-700 hover:bg-teal-800 text-white py-3 rounded-xl font-bold disabled:opacity-50 transition-colors"
            >
              Salvar Chave
            </button>
          </div>
        </div>
      )}
    </div>
  )
}