'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Check,
  Loader2,
  Shield,
  Key,
  Eye,
  EyeOff,
  Zap,
  ExternalLink,
  HelpCircle,
} from 'lucide-react'
import ApiKeyGuideModal from '@/components/ApiKeyGuideModal'

const PROVIDERS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    getApiUrl: (key: string) =>
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${key}`,
    testPayload: { contents: [{ role: 'user', parts: [{ text: 'Olá' }] }] },
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    getApiUrl: () => 'https://api.openai.com/v1/chat/completions',
    testPayload: {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Olá' }],
    },
  },
]

export default function AssistantSettingsPage() {
  const router = useRouter()
  const [provider, setProvider] = useState('gemini')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [model, setModel] = useState('')
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    const savedProvider = localStorage.getItem('dfl_ai_provider') || 'gemini'
    const savedKey = localStorage.getItem('dfl_ai_key') || ''
    const savedModel = localStorage.getItem('dfl_ai_model') || ''
    setProvider(savedProvider)
    setApiKey(savedKey)
    setModel(savedModel || PROVIDERS.find(p => p.id === savedProvider)?.models[0] || '')
  }, [])

  const handleTest = async () => {
    if (!apiKey.trim()) {
      setTestResult('Insira uma chave de API primeiro.')
      return
    }
    setTesting(true)
    setTestResult(null)

    try {
      const prov = PROVIDERS.find(p => p.id === provider)!
      const url = prov.id === 'openai' ? prov.getApiUrl() : prov.getApiUrl(apiKey)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (prov.id === 'openai') {
        headers['Authorization'] = `Bearer ${apiKey}`
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(prov.testPayload),
      })

      if (res.ok) {
        setTestResult('✅ Conexão bem-sucedida! Chave válida.')
      } else {
        const err = await res.json()
        setTestResult(`❌ Erro: ${err.error?.message || 'Chave inválida ou sem permissão.'}`)
      }
    } catch (e: any) {
      setTestResult(`❌ Erro de rede: ${e.message}`)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    localStorage.setItem('dfl_ai_provider', provider)
    localStorage.setItem('dfl_ai_key', apiKey.trim())
    localStorage.setItem('dfl_ai_model', model || PROVIDERS.find(p => p.id === provider)?.models[0] || '')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const selectedProvider = PROVIDERS.find(p => p.id === provider)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-gray-800 dark:text-gray-200"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
          Configurar IA
        </h1>
        <button
          onClick={handleSave}
          className={`p-2 text-teal-700 dark:text-teal-400 font-bold text-sm ${
            saved ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Salvo!
        </button>
      </div>

      {/* Aviso de segurança */}
      <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
            <Shield size={16} className="text-teal-700 dark:text-teal-400" />
          </div>
          <p className="font-bold text-sm text-teal-700 dark:text-teal-300">
            Seus dados estão seguros
          </p>
        </div>
        <p className="text-xs text-teal-600 dark:text-teal-400 ml-11">
          A chave de API fica salva apenas neste dispositivo. O DFL Finance nunca a envia para servidores de terceiros.
        </p>
      </div>

      {/* Provedor */}
      <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 mb-4">
        <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-3 block">
          Provedor de IA
        </label>
        <div className="space-y-2">
          {PROVIDERS.map(prov => (
            <button
              key={prov.id}
              onClick={() => setProvider(prov.id)}
              className={`w-full p-3 flex items-center gap-3 rounded-xl transition-colors ${
                provider === prov.id
                  ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800'
                  : 'bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600'
              }`}
            >
              <Zap size={18} className={provider === prov.id ? 'text-teal-700 dark:text-teal-400' : 'text-gray-400'} />
              <span className={`text-sm font-bold ${provider === prov.id ? 'text-teal-700 dark:text-teal-300' : 'text-gray-700 dark:text-gray-300'}`}>
                {prov.name}
              </span>
              {provider === prov.id && <Check size={18} className="text-teal-700 dark:text-teal-400 ml-auto" />}
            </button>
          ))}
        </div>
      </div>

      {/* Modelo (opcional) */}
      {selectedProvider && selectedProvider.models.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 mb-4">
          <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-3 block">
            Modelo
          </label>
          <select
            value={model || selectedProvider.models[0]}
            onChange={e => setModel(e.target.value)}
            className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl p-3 text-sm outline-none text-gray-800 dark:text-gray-200"
          >
            {selectedProvider.models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}

      {/* Chave de API */}
      <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 mb-4">
        <label className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-3 block">
          Chave de API
        </label>
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
          <Key size={18} className="text-gray-400 dark:text-gray-500" />
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Cole sua chave aqui..."
            className="bg-transparent w-full text-sm text-gray-800 dark:text-gray-200 outline-none"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600"
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Botão Guia Rápido */}
      <button
        onClick={() => setShowGuide(true)}
        className="w-full bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 py-3 rounded-xl font-bold text-sm hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors mb-4 flex items-center justify-center gap-2"
      >
        <HelpCircle size={18} />
        Como conseguir minha chave? (Guia rápido)
      </button>

      {/* Botões de ação */}
      <div className="space-y-3 mb-6">
        <button
          onClick={handleTest}
          disabled={testing}
          className="w-full bg-teal-700 text-white py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50"
        >
          {testing ? <Loader2 size={20} className="animate-spin inline" /> : 'Testar conexão'}
        </button>
        <button
          onClick={handleSave}
          className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        >
          Salvar configuração
        </button>
      </div>

      {testResult && (
        <div
          className={`rounded-xl p-4 text-sm font-bold ${
            testResult.startsWith('✅')
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          }`}
        >
          {testResult}
        </div>
      )}

      {/* Link para obter chave (direto, como fallback) */}
      <div className="mt-6 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
          Ou acesse diretamente:
        </p>
        <a
          href={provider === 'openai' ? 'https://platform.openai.com/account/api-keys' : 'https://aistudio.google.com/app/apikey'}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-700 dark:text-teal-400 text-xs font-bold inline-flex items-center gap-1"
        >
          Site do {selectedProvider?.name} <ExternalLink size={12} />
        </a>
      </div>

      {/* Modal do Guia Rápido */}
      <ApiKeyGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  )
}