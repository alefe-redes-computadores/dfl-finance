'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Bot, Key, Settings, Sparkles, TrendingUp,
  PieChart, Target, Lightbulb, MessageSquare, ArrowRight,
  Coins, Wallet, BarChart3, Zap, Shield, CreditCard
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

export default function AssistantPage() {
  const router = useRouter()
  const { showToast } = useToast()
  
  const [apiKey, setApiKey] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [tempKey, setTempKey] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('dfl_assistant_api_key')
    if (saved) {
      setApiKey(saved)
      setTempKey(saved)
    }
  }, [])

  const saveApiKey = () => {
    localStorage.setItem('dfl_assistant_api_key', tempKey)
    setApiKey(tempKey)
    setShowSettings(false)
    showToast('Chave de API salva!', 'success')
  }

  const handleChatClick = () => {
    if (!apiKey) {
      setShowSettings(true)
      showToast('Configure sua chave de API primeiro.', 'warning')
      return
    }
    router.push('/assistant/chat')
  }

  const quickActions = [
    {
      icon: Coins,
      title: 'Resumo Financeiro',
      description: 'Veja um panorama geral das suas finanças',
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      prompt: 'Faça um resumo completo das minhas finanças: saldo total, receitas, despesas, principais categorias de gasto e situação dos orçamentos.'
    },
    {
      icon: PieChart,
      title: 'Análise de Gastos',
      description: 'Entenda onde seu dinheiro está indo',
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      prompt: 'Analise meus gastos por categoria nos últimos 30 dias. Quais categorias mais pesam? Onde posso economizar?'
    },
    {
      icon: Target,
      title: 'Plano de Ação',
      description: 'Receba sugestões personalizadas para economizar',
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      prompt: 'Com base nos meus gastos atuais, crie um plano de ação prático para eu economizar dinheiro nos próximos 3 meses.'
    },
    {
      icon: TrendingUp,
      title: 'Projeções',
      description: 'Previsões financeiras para os próximos meses',
      color: 'text-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      prompt: 'Com base no meu histórico, faça uma projeção de receitas e despesas para os próximos 3 meses.'
    },
    {
      icon: Shield,
      title: 'Reserva de Emergência',
      description: 'Avalie sua segurança financeira',
      color: 'text-teal-500',
      bg: 'bg-teal-50 dark:bg-teal-900/20',
      prompt: 'Analise se minha reserva de emergência está adequada. Quanto devo guardar por mês para ter 6 meses de segurança?'
    },
    {
      icon: CreditCard,
      title: 'Cartões de Crédito',
      description: 'Análise das faturas e gastos nos cartões',
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-900/20',
      prompt: 'Analise meus gastos nos cartões de crédito. As faturas estão controladas? Há risco de endividamento?'
    },
  ]

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-24 font-sans transition-colors duration-300">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
              title="Configurar API"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
        
        {/* Banner principal */}
        <div className="flex flex-col items-center py-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center mb-4 shadow-lg">
            <Bot size={40} className="text-white" />
          </div>
          <h1 className="font-bold text-2xl text-gray-800 dark:text-gray-100 mb-2">Assistente Financeiro IA</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center max-w-xs">
            {apiKey 
              ? 'Conectado • Gemini Flash' 
              : 'Configure sua chave de API para começar'}
          </p>
          <button
            onClick={() => setShowSettings(true)}
            className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-colors ${
              apiKey 
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                : 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
            }`}
          >
            <Key size={14} />
            {apiKey ? 'Chave configurada' : 'Configurar chave API'}
          </button>
        </div>
      </div>

      {/* Botão principal do Chat */}
      <div className="px-4 mt-6">
        <button
          onClick={handleChatClick}
          className="w-full bg-gradient-to-r from-teal-600 to-emerald-500 text-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <MessageSquare size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold text-lg">Conversar com IA</p>
              <p className="text-xs text-teal-100">Tire dúvidas sobre suas finanças</p>
            </div>
          </div>
          <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Ações Rápidas */}
      <div className="px-4 mt-8">
        <h2 className="text-[15px] font-bold text-gray-800 dark:text-gray-100 mb-4 px-1">
          Análises Rápidas
        </h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 px-1">
          Clique em qualquer opção para iniciar uma conversa com a IA sobre o tema.
        </p>
        <div className="space-y-3">
          {quickActions.map((action, index) => {
            const IconComp = action.icon
            return (
              <button
                key={index}
                onClick={() => {
                  if (!apiKey) {
                    setShowSettings(true)
                    showToast('Configure sua chave de API primeiro.', 'warning')
                    return
                  }
                  // Salva o prompt no localStorage para o chat usar
                  localStorage.setItem('dfl_assistant_prompt', action.prompt)
                  router.push('/assistant/chat')
                }}
                className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center gap-4 hover:shadow-md transition-all text-left group"
              >
                <div className={`w-12 h-12 rounded-xl ${action.bg} flex items-center justify-center flex-shrink-0`}>
                  <IconComp size={22} className={action.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{action.title}</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{action.description}</p>
                </div>
                <ArrowRight size={18} className="text-gray-300 dark:text-gray-600 group-hover:translate-x-1 transition-transform flex-shrink-0" />
              </button>
            )
          })}
        </div>
      </div>

      {/* Seção de Dicas */}
      <div className="px-4 mt-8">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-5 border border-amber-100 dark:border-amber-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center">
              <Lightbulb size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="font-bold text-sm text-amber-800 dark:text-amber-200">Dica</h3>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
            Sua chave de API é salva apenas no seu dispositivo e enviada diretamente para o Google Gemini. 
            Nenhum dado financeiro é compartilhado — apenas as perguntas que você fizer.
          </p>
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
              Sua chave é salva apenas no seu dispositivo (localStorage) e enviada diretamente para a API do Google Gemini. 
              Obtenha sua chave gratuita em: <span className="font-bold text-teal-600 dark:text-teal-400">aistudio.google.com</span>
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