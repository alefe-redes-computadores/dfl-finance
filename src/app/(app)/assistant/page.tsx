'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { sendChatMessage, ChatMessage } from '@/lib/services/chatService'
import { ChevronLeft, Send, Settings, AlertCircle, Loader } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AssistantPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key')
    if (savedKey) setApiKey(savedKey)
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || !apiKey) {
      setError('Configure sua chave de API nas configurações.')
      return
    }

    const userMessage: ChatMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setError('')
    setLoading(true)

    try {
      const response = await sendChatMessage([...messages, userMessage], apiKey)
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com a IA.')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }, [messages, input, apiKey])

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      setError('Chave de API não pode estar vazia.')
      return
    }
    localStorage.setItem('gemini_api_key', apiKey)
    setShowSettings(false)
    setError('')
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24 flex flex-col pt-6 px-5">

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Assistente IA</h1>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
          <Settings size={20} className="text-gray-600" />
        </button>
      </div>

      {showSettings && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Chave da API Gemini</label>
          <input
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            type="password"
            placeholder="Cole sua chave aqui"
            className="w-full bg-gray-100 p-3.5 rounded-xl outline-none text-sm mb-3"
          />
          <button
            onClick={handleSaveApiKey}
            className="w-full bg-teal-600 text-white py-2.5 rounded-xl font-semibold hover:bg-teal-700 transition-colors text-sm"
          >
            Salvar Chave
          </button>
          <p className="text-[11px] text-gray-500 mt-3">
            Obtenha sua chave em: <a href="https://aistudio.google.com/app/apikeys" target="_blank" className="text-teal-600 hover:underline">aistudio.google.com</a>
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
            <div className="text-5xl mb-3">🤖</div>
            <p className="font-semibold">Olá! Como posso ajudar?</p>
            <p className="text-sm mt-2 text-center">Faça perguntas sobre suas finanças ou qualquer outro assunto</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs px-4 py-3 rounded-2xl ${
              msg.role === 'user'
                ? 'bg-teal-600 text-white rounded-br-none'
                : 'bg-gray-100 text-gray-900 rounded-bl-none'
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-2">
              <Loader size={16} className="animate-spin" />
              <p className="text-sm">Pensando...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2 items-end">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
          placeholder="Digite sua mensagem..."
          className="flex-1 bg-white border border-gray-200 p-3.5 rounded-2xl outline-none text-sm focus:border-teal-500 transition-colors"
        />
        <button
          onClick={handleSendMessage}
          disabled={loading || !input.trim() || !apiKey}
          className="w-11 h-11 bg-teal-600 rounded-full flex items-center justify-center hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={18} className="text-white" />
        </button>
      </div>
    </div>
  )
}