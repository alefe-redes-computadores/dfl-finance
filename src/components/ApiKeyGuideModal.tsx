'use client'

import { useState } from 'react'
import { X, ExternalLink, Copy, Check, Key, Sparkles } from 'lucide-react'

interface ApiKeyGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ApiKeyGuideModal({ isOpen, onClose }: ApiKeyGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'gemini' | 'openai'>('gemini')
  const [copiedStep, setCopiedStep] = useState<string | null>(null)

  if (!isOpen) return null

  const geminiSteps = [
    {
      title: '1. Acesse o Google AI Studio',
      description: 'Vá para aistudio.google.com/apikey',
      tip: 'Use sua conta Google normal (Gmail).',
      link: 'https://aistudio.google.com/apikey',
      copyText: 'aistudio.google.com/apikey',
    },
    {
      title: '2. Aceite os termos de uso',
      description: 'Se for seu primeiro acesso, clique em "Aceitar".',
      tip: 'O Gemini tem um plano gratuito generoso.',
      copyText: null,
    },
    {
      title: '3. Clique em "Criar chave de API"',
      description: 'O botão está no topo da página.',
      tip: 'Você pode criar várias chaves para projetos diferentes.',
      copyText: null,
    },
    {
      title: '4. Copie a chave gerada',
      description: 'É uma string longa de caracteres. Cole no campo do DFL Finance.',
      tip: 'Guarde essa chave. Ela só aparece uma vez!',
      copyText: null,
    },
  ]

  const openaiSteps = [
    {
      title: '1. Acesse a plataforma da OpenAI',
      description: 'Vá para platform.openai.com/account/api-keys',
      tip: 'Crie uma conta se não tiver (não é a do ChatGPT).',
      link: 'https://platform.openai.com/account/api-keys',
      copyText: 'platform.openai.com/account/api-keys',
    },
    {
      title: '2. Vá em "API keys"',
      description: 'No menu lateral, clique em "API keys".',
      tip: 'Pode ser necessário verificar seu número de telefone.',
      copyText: null,
    },
    {
      title: '3. Clique em "Create new secret key"',
      description: 'Dê um nome (ex: "DFL Finance") e clique em "Create".',
      tip: 'Você pode colocar um nome para identificar depois.',
      copyText: null,
    },
    {
      title: '4. Copie a chave imediatamente',
      description: 'A chave secreta aparece uma única vez. Cole no DFL Finance.',
      tip: '⚠️ Se perder, terá que gerar uma nova.',
      copyText: null,
    },
    {
      title: '5. Adicione créditos (pré-pago)',
      description: 'Acesse "Billing" e coloque um saldo (ex: $5).',
      tip: 'O modelo gpt-4o-mini é barato (centavos por uso).',
      link: 'https://platform.openai.com/account/billing',
      copyText: null,
    },
  ]

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedStep(text)
    setTimeout(() => setCopiedStep(null), 2000)
  }

  const steps = activeTab === 'gemini' ? geminiSteps : openaiSteps

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
              <Key size={20} className="text-teal-700 dark:text-teal-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Como obter sua chave</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Passo a passo rápido</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Tabs de provedores */}
        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-full mb-6">
          <button
            onClick={() => setActiveTab('gemini')}
            className={`flex-1 py-2 rounded-full text-sm font-bold transition-colors ${
              activeTab === 'gemini'
                ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Sparkles size={16} /> Google Gemini
            </span>
          </button>
          <button
            onClick={() => setActiveTab('openai')}
            className={`flex-1 py-2 rounded-full text-sm font-bold transition-colors ${
              activeTab === 'openai'
                ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Sparkles size={16} /> OpenAI
            </span>
          </button>
        </div>

        {/* Passos */}
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4">
              <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-1">{step.title}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{step.description}</p>
              {step.tip && (
                <p className="text-[11px] text-teal-700 dark:text-teal-400 font-medium mb-2">💡 {step.tip}</p>
              )}
              {step.copyText && (
                <button
                  onClick={() => handleCopy(step.copyText!)}
                  className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-3 py-1.5 rounded-full hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors"
                >
                  {copiedStep === step.copyText ? (
                    <>
                      <Check size={14} className="text-emerald-500" /> Copiado!
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copiar link
                    </>
                  )}
                </button>
              )}
              {step.link && (
                <a
                  href={step.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 dark:text-teal-400 mt-2 hover:underline"
                >
                  Abrir site <ExternalLink size={12} />
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Dica final */}
        <div className="mt-6 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-2xl p-4">
          <p className="text-xs text-teal-700 dark:text-teal-300 font-bold mb-1">🔒 Sua chave está segura</p>
          <p className="text-[11px] text-teal-600 dark:text-teal-400">
            A chave fica salva apenas neste dispositivo. O DFL Finance não a envia para nenhum servidor.
          </p>
        </div>
      </div>
    </div>
  )
}