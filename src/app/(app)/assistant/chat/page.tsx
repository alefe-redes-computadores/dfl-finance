'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Send, Loader2, Bot, User, Key, Settings,
  Sparkles, RefreshCw, Trash2, Copy, Check, X, Zap, Brain,
  ArrowRight, Lightbulb, Coins, TrendingUp, PieChart, Wallet
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/lib/hooks/useAuth'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  { text: 'Quanto gastei este mês?', icon: Coins },
  { text: 'Quanto tenho disponível?', icon: Wallet },
  { text: 'Como está minha poupança?', icon: PiggyBankIcon },
  { text: 'Quais categorias mais pesam?', icon: PieChart },
  { text: 'Meus orçamentos estão no limite?', icon: TrendingUp },
  { text: 'Como está minha reserva de emergência?', icon: ShieldIcon },
]

function PiggyBankIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 5c-1.5 0-2.8.8-3.5 2H15c-2.2 0-4 1.8-4 4v1h-1c-.6 0-1 .4-1 1v2c0 .6.4 1 1 1h1v1c0 2.2 1.8 4 4 4h.5c.7 1.2 2 2 3.5 2 2.2 0 4-1.8 4-4s-1.8-4-4-4c-.5 0-1 .1-1.4.3-.6-.5-1.4-.8-2.3-.8H15c-.7 0-1.3-.3-1.7-.8.4-.5 1-.8 1.7-.8h2.5c.7 1.2 2 2 3.5 2 2.2 0 4-1.8 4-4s-1.8-4-4-4z"/>
    </svg>
  )
}

function ShieldIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

function ChatContent() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [tempKey, setTempKey] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('dfl_assistant_api_key')
    if (saved) {
      setApiKey(saved)
      setTempKey(saved)
    }
    const prompt = localStorage.getItem('dfl_assistant_prompt')
    if (prompt) {
      localStorage.removeItem('dfl_assistant_prompt')
      handleSend(prompt)
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
      router.push('/assistant/settings')
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
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: error.message || 'Erro ao comunicar com a IA.',
      }
      setMessages(prev => [...prev, errorMsg])
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

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatTime = () => {
    const now = new Date()
    return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
              <Brain size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-[17px] text-gray-800 dark:text-gray-100">Assistente IA</h1>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                {apiKey ? 'Conectado • Gemini Flash' : 'BYOK • Configure sua chave'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleClearChat} className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors" title="Limpar conversa">
            <Trash2 size={18} />
          </button>
          <button onClick={() => router.push('/assistant/settings')} className="p-2 text-gray-400 dark:text-gray-500 hover:text-teal-700 dark:hover:text-teal-400 transition-colors" title="Configurações">
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Área de mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-100 to-emerald-100 dark:from-teal-900/30 dark:to-emerald-900/30 flex items-center justify-center mb-4">
              <Brain size={36} className="text-teal-700 dark:text-teal-400" />
            </div>
            <h2 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-2">Assistente Financeiro</h2>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-6 max-w-xs">
              Tire dúvidas sobre suas finanças, peça análises e receba sugestões personalizadas.
            </p>
            {/* Grid de sugestões corrigida */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs auto-rows-fr isolate">
              {SUGGESTIONS.map((suggestion, i) => {
                const IconComp = suggestion.icon
                return (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(suggestion.text)}
                    className="flex items-start gap-2 px-3 py-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:text-teal-700 dark:hover:text-teal-400 hover:border-teal-200 dark:hover:border-teal-800 transition-all text-left h-full"
                  >
                    <IconComp size={16} className="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5 relative z-20" />
                    <span className="leading-tight break-words relative z-20">{suggestion.text}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <Brain size={14} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'assistant'
                    ? 'bg-white dark:bg-slate-800 border border-gray-50 dark:border-slate-700 text-gray-800 dark:text-gray-200 rounded-tl-sm'
                    : 'bg-teal-700 text-white rounded-tr-sm'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] opacity-50">{formatTime()}</span>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="text-[10px] flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity"
                      >
                        {copiedId === msg.id ? (
                          <><Check size={12} /> Copiado</>
                        ) : (
                          <><Copy size={12} /> Copiar</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-teal-700 flex items-center justify-center flex-shrink-0 mt-1">
                    <User size={16} className="text-white" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <Brain size={14} className="text-white" />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-gray-50 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-teal-700" />
                  <span className="text-sm text-gray-400 dark:text-gray-500">Pensando...</span>
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

export default function ChatPage() {
  return (
    <ContextProvider>
      <ChatContent />
    </ContextProvider>
  )
}