'use client'

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