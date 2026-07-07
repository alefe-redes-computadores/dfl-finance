'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db, addToSyncQueue } from '@/lib/db'
import {
  ChevronLeft, Send, Loader2, Bot, User, RefreshCw,
  Sparkles, Trash2, MessageSquare, Clock, Zap, Brain,
  TrendingUp, TrendingDown, Wallet, PieChart, Calendar
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/contexts/ToastContext'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { formatCurrency } from '@/lib/utils'
import { useLocalData } from '@/hooks/useLocalData'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  type?: 'text' | 'insight' | 'suggestion'
}

// ============================================================
// SKELETON LOADER
// ============================================================
const ChatSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-56 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
    </div>

    {[1, 2, 3].map((i) => (
      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
        <div className={`max-w-[80%] rounded-2xl p-4 ${
          i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-teal-50 dark:bg-teal-900/30'
        }`}>
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-48 bg-gray-100 dark:bg-slate-700/50 rounded" />
            <div className="h-3 w-40 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
        </div>
      </div>
    ))}
  </div>
)

export default function AssistantChatPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ============================================================
  // 🔥 BUSCA LOCAL (INDEXEDDB) — sem orderBy/realtime
  // ============================================================
  const { data: localMessages, reload: reloadMessages } = useLocalData({
    table: 'chat_history' as any,
    filters: { user_id: user?.id, session_id: sessionId || '' },
  })

  // ============================================================
  // PULL TO REFRESH
  // ============================================================
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY > 10 || loading) return
    pullStartY.current = e.touches[0].clientY
    isPulling.current = true
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const pullDistance = e.touches[0].clientY - pullStartY.current
    if (pullDistance > 60) {
      setRefreshing(true)
      isPulling.current = false
      loadChat().finally(() => setRefreshing(false))
    }
  }

  const handleTouchEnd = () => {
    isPulling.current = false
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [loading, refreshing])

  // ============================================================
  // SCROLL PARA O FINAL
  // ============================================================
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // ============================================================
  // ORDENA MENSAGENS POR DATA
  // ============================================================
  useEffect(() => {
    if (localMessages && localMessages.length > 0) {
      const sorted = [...(localMessages as any[])].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      )
      setMessages(sorted as Message[])
    }
  }, [localMessages])

  // ============================================================
  // LOAD DATA
  // ============================================================
  const loadChat = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadingPulse(true)

    try {
      // Busca sessão ativa
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (session) {
        setSessionId(session.id)
        await reloadMessages()
      }
    } catch (err) {
      console.error('Erro ao carregar chat:', err)
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }, [user?.id, reloadMessages])

  useEffect(() => {
    if (user?.id) loadChat()
  }, [user?.id])

  // ============================================================
  // 🔥 ENVIAR MENSAGEM CORRIGIDO COM addToSyncQueue
  // ============================================================
  const handleSend = async () => {
    if (!input.trim() || isSending || !user?.id) return

    const userMessage = input.trim()
    setInput('')
    setIsSending(true)

    try {
      let currentSessionId = sessionId

      // Cria sessão se ainda não existir
      if (!currentSessionId) {
        const sessionIdNew = crypto.randomUUID()
        const sessionPayload = {
          id: sessionIdNew,
          user_id: user.id,
          title: 'Nova conversa',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        await db.table('chat_sessions').add(sessionPayload)
        await addToSyncQueue(user.id, 'chat_sessions', 'create', sessionIdNew, sessionPayload)
        currentSessionId = sessionIdNew
        setSessionId(currentSessionId)
      }

      // Salva mensagem do usuário
      const userMsgId = crypto.randomUUID()
      const userMsgPayload = {
        id: userMsgId,
        user_id: user.id,
        session_id: currentSessionId,
        role: 'user' as const,
        content: userMessage,
        created_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
      }
      await db.table('chat_history').add(userMsgPayload)
      await addToSyncQueue(user.id, 'chat_history', 'create', userMsgId, userMsgPayload)
      await reloadMessages()

      // Chama a API do assistente
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          context: context,
          userId: user.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar mensagem')
      }

      // Salva resposta do assistente
      const assistantMsgId = crypto.randomUUID()
      const assistantMsgPayload = {
        id: assistantMsgId,
        user_id: user.id,
        session_id: currentSessionId,
        role: 'assistant' as const,
        content: data.response,
        type: data.type || 'text',
        created_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
      }
      await db.table('chat_history').add(assistantMsgPayload)
      await addToSyncQueue(user.id, 'chat_history', 'create', assistantMsgId, assistantMsgPayload)
      await reloadMessages()

    } catch (err: any) {
      showToast(`Erro: ${err.message}`, 'error')
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ============================================================
  // 🔥 LIMPAR CHAT CORRIGIDO COM addToSyncQueue
  // ============================================================
  const handleClearChat = async () => {
    if (!confirm('Limpar todo o histórico da conversa?')) return
    if (!sessionId || !user) return

    try {
      const idsToRemove = messages.map((m) => m.id)

      for (const id of idsToRemove) {
        await db.table('chat_history').delete(id)
        await addToSyncQueue(user.id, 'chat_history', 'delete', id, { id })
      }

      setMessages([])
      await reloadMessages()
      showToast('Histórico limpo.', 'info')
    } catch (err: any) {
      showToast(`Erro: ${err.message}`, 'error')
    }
  }

  const formatTime = (date: string) => {
    return format(new Date(date), 'HH:mm', { locale: ptBR })
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
        {loadingPulse && (
          <div className="fixed top-20 right-4 z-50">
            <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
          </div>
        )}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <MessageSquare size={24} className="text-teal-600" />
            Chat IA
          </h2>
          <div className="w-10" />
        </div>
        <ChatSkeleton />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <MessageSquare size={22} className="text-teal-600" />
          Chat IA
        </h2>
        <button
          onClick={handleClearChat}
          className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors"
          title="Limpar histórico"
        >
          <Trash2 size={20} />
        </button>
      </div>

      <div className="mb-4">
        <ContextToggle />
      </div>

      <div className="flex-1 space-y-4 pb-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-teal-50 dark:bg-teal-900/30 rounded-full flex items-center justify-center mb-6">
              <Bot size={40} className="text-teal-600 dark:text-teal-400" />
            </div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Como posso ajudar?</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-[250px] mb-6">
              Pergunte sobre suas finanças, peça recomendações ou analise seus gastos.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Qual meu saldo?', 'Dicas para economizar', 'Analisar gastos', 'Resumo do mês'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-2 bg-gray-100 dark:bg-slate-700 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-4 ${
                    msg.role === 'user'
                      ? 'bg-teal-700 text-white'
                      : 'bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {msg.role === 'assistant' ? (
                      <Bot size={16} className="text-teal-600" />
                    ) : (
                      <User size={16} className="text-teal-200" />
                    )}
                    <span className={`text-xs font-medium ${msg.role === 'user' ? 'text-teal-100' : 'text-gray-500'}`}>
                      {msg.role === 'assistant' ? 'Assistente' : 'Você'}
                    </span>
                    <span className={`text-[10px] ${msg.role === 'user' ? 'text-teal-300' : 'text-gray-400'}`}>
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  <p className={`text-sm whitespace-pre-wrap ${
                    msg.role === 'user' ? 'text-white' : 'text-gray-800 dark:text-gray-200'
                  }`}>
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 max-w-[85%] rounded-2xl p-4 border border-gray-100 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-teal-600" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">Digitando...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="fixed bottom-24 left-0 right-0 px-4 max-w-md mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700 p-2 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua pergunta..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 p-2"
            disabled={isSending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="w-10 h-10 rounded-full bg-teal-700 text-white flex items-center justify-center disabled:opacity-50 hover:bg-teal-800 transition-colors active:scale-90"
          >
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  )
}