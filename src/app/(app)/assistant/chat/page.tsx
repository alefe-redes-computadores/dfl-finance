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

import { sendChatMessage } from '@/lib/services/chatService'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  type?: 'text' | 'insight' | 'suggestion'
}

// 🔥 SKELETON ATUALIZADO
const ChatSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
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
          i % 2 === 0 ? 'bg-white dark:bg-slate-800 border border-gray-200/70 dark:border-slate-700' : 'bg-teal-50 dark:bg-teal-900/20'
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

  const { data: localMessages, reload: reloadMessages } = useLocalData({
    table: 'chat_history' as any,
    filters: { user_id: user?.id, session_id: sessionId || '' },
  })

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (localMessages && localMessages.length > 0) {
      const sorted = [...(localMessages as any[])].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      )
      setMessages(sorted as Message[])
    }
  }, [localMessages])

  const loadChat = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadingPulse(true)

    try {
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

  const handleSend = async () => {
    if (!input.trim() || isSending || !user?.id) return

    const apiKey = localStorage.getItem('gemini_api_key')
    if (!apiKey) {
      showToast('Chave da API não configurada. Volte e clique na engrenagem.', 'error')
      return
    }

    const userMessage = input.trim()
    setInput('')
    setIsSending(true)

    try {
      let currentSessionId = sessionId

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
      
      const newMessagesList = [...messages, userMsgPayload]
      setMessages(newMessagesList as Message[])

      const chatHistoryForGemini = newMessagesList.map(m => ({
        role: m.role,
        content: m.content
      }))

      const aiResponseText = await sendChatMessage(chatHistoryForGemini, apiKey)

      const assistantMsgId = crypto.randomUUID()
      const assistantMsgPayload = {
        id: assistantMsgId,
        user_id: user.id,
        session_id: currentSessionId,
        role: 'assistant' as const,
        content: aiResponseText,
        type: 'text',
        created_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
      }
      await db.table('chat_history').add(assistantMsgPayload)
      await addToSyncQueue(user.id, 'chat_history', 'create', assistantMsgId, assistantMsgPayload)
      
      await reloadMessages()

    } catch (err: any) {
      showToast(`Erro ao responder: ${err.message}`, 'error')
      await reloadMessages()
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

  // 🔥 LOADING STATE ATUALIZADO
  if (loading) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-4 transition-colors duration-300">
        {loadingPulse && (
          <div className="fixed top-20 right-4 z-50">
            <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
          </div>
        )}

        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => router.back()}
              className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-500 dark:text-gray-300"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex items-center gap-2">
              <MessageSquare size={20} className="text-teal-600" />
              <h2 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100">
                Chat IA
              </h2>
            </div>

            <div className="w-10" />
          </div>

          <div className="h-10 w-[148px] rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-gray-100 dark:bg-slate-700/50 animate-pulse" />
        </div>

        <ChatSkeleton />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-32 font-sans px-4 pt-4 transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-sm rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200/70 dark:border-slate-700">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-semibold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* 🔥 HEADER UNIFICADO */}
      <div className="sticky top-0 z-30 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl pb-3">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <button
              onClick={() => router.back()}
              className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98] shrink-0"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex-1 min-w-0 text-center">
              <div className="inline-flex items-center gap-2">
                <MessageSquare size={20} className="text-teal-600" />
                <h2 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100">
                  Chat IA
                </h2>
              </div>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1">
                Assistente financeiro local-first
              </p>
            </div>

            <button
              onClick={handleClearChat}
              className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-[0.98] shrink-0"
              title="Limpar histórico"
            >
              <Trash2 size={18} />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <ContextToggle />
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 pb-4">
        {messages.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-6 mt-2 animate-in fade-in duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center mb-4">
                <Bot size={30} className="text-teal-600 dark:text-teal-400" />
              </div>

              <h3 className="text-[16px] font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Como posso ajudar?
              </h3>

              <p className="text-[12px] text-gray-400 dark:text-gray-500 max-w-[250px] mb-5">
                Pergunte sobre saldo, gastos, tendências e oportunidades de economia.
              </p>

              <div className="flex flex-wrap gap-2 justify-center">
                {['Qual meu saldo?', 'Dicas para economizar', 'Analisar gastos', 'Resumo do mês'].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-3 py-2 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-[12px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[86%] rounded-[24px] border shadow-sm px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white dark:bg-slate-800 border-gray-200/70 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {msg.role === 'assistant' ? (
                      <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
                        <Bot size={13} className="text-teal-600 dark:text-teal-400" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
                        <User size={13} className="text-teal-100" />
                      </div>
                    )}

                    <span className={`text-[11px] font-semibold ${
                      msg.role === 'user' ? 'text-teal-50' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {msg.role === 'assistant' ? 'Assistente' : 'Você'}
                    </span>

                    <span className={`text-[10px] ${
                      msg.role === 'user' ? 'text-teal-100/80' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {formatTime(msg.created_at)}
                    </span>
                  </div>

                  <p className={`text-[14px] leading-6 whitespace-pre-wrap ${
                    msg.role === 'user' ? 'text-white' : 'text-gray-800 dark:text-gray-200'
                  }`}>
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="max-w-[86%] rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-teal-600" />
                    <span className="text-[13px] text-gray-500 dark:text-gray-400">Digitando...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 🔥 INPUT INFERIOR ATUALIZADO */}
      <div className="fixed bottom-24 left-0 right-0 px-4 max-w-md mx-auto">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-2 flex items-end gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua pergunta..."
            className="flex-1 rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 text-[14px] text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
            disabled={isSending}
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="h-11 w-11 rounded-[18px] bg-teal-600 text-white flex items-center justify-center disabled:opacity-50 hover:bg-teal-700 transition-colors active:scale-[0.98] shadow-lg shadow-teal-600/20"
          >
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  )
}