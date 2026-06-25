'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Settings, Copy, Check, Loader2, Sparkles, TrendingUp } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

function ReportContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') || 'resumo' // 'resumo' ou 'plano'
  const { user } = useAuth()
  const { context } = useContext_()
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [promptText, setPromptText] = useState('')
  const [copied, setCopied] = useState(false)
  const [apiEnabled, setApiEnabled] = useState(false)

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const generateReport = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd')

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, categories(name)')
      .match({ user_id: user.id, context: context })
      .gte('date', start)
      .lte('date', end)

    const txs = Array.isArray(transactions) ? transactions : []

    const income = txs.filter((t: any) => t.type === 'income' && t.status === 'done').reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
    const expense = txs.filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((a: number, t: any) => a + Number(t.amount || 0), 0)

    const catMap: Record<string, number> = {}
    txs.filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').forEach((t: any) => {
      const name = t.categories?.name || 'Outros'
      catMap[name] = (catMap[name] || 0) + Number(t.amount || 0)
    })

    const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1])

    const localReport = `📊 RESUMO FINANCEIRO — ${context === 'dfl' ? 'DFL' : 'PESSOAL'}
Mês: ${format(new Date(), 'MMMM yyyy', { locale: (await import('date-fns/locale')).ptBR })}

💰 RECEITAS: ${formatCurrency(income)}
💸 DESPESAS: ${formatCurrency(expense)}
📈 SALDO: ${formatCurrency(income - expense)}

📌 TOP 5 GASTOS:
${sortedCats.slice(0, 5).map(([name, total], i) => `${i + 1}. ${name}: ${formatCurrency(total)}`).join('\n')}

${mode === 'plano' ? '🎯 Sugestões para economizar:\n- Revise as categorias com maiores gastos\n- Defina orçamentos para os próximos meses\n- Avalie assinaturas e gastos recorrentes' : ''}`

    setContent(localReport)
    setPromptText(`Analise meus dados financeiros do mês e ${mode === 'plano' ? 'crie um plano de ação para economizar' : 'faça um resumo detalhado'}:\n\n${localReport}`)

    // Se tiver API key, chama a IA
    const apiKey = localStorage.getItem('dfl_ai_key') || ''
    const provider = localStorage.getItem('dfl_ai_provider') || 'gemini'
    const model = localStorage.getItem('dfl_ai_model') || 'gemini-2.0-flash'

    if (apiKey.trim()) {
      setApiEnabled(true)
      try {
        const systemPrompt = `Você é o assistente financeiro do DFL Finance. ${mode === 'plano' ? 'Crie um plano de ação prático para economizar, baseado nos dados abaixo.' : 'Faça um resumo amigável e objetivo dos dados financeiros abaixo.'}`
        let aiResponse = ''

        if (provider === 'openai') {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: localReport },
              ],
            }),
          })
          const data = await res.json()
          aiResponse = data.choices?.[0]?.message?.content || ''
        } else {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  { role: 'user', parts: [{ text: `${systemPrompt}\n\nDados:\n${localReport}` }] },
                ],
              }),
            }
          )
          const data = await res.json()
          aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        }

        if (aiResponse) setContent(aiResponse)
      } catch (err) {
        console.error('Erro IA:', err)
      }
    }

    setLoading(false)
  }, [user, context, mode])

  useEffect(() => { generateReport() }, [generateReport])

  const handleCopy = () => {
    navigator.clipboard.writeText(promptText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/assistant')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          {mode === 'plano' ? <TrendingUp size={20} className="text-teal-700 dark:text-teal-400" /> : <Sparkles size={20} className="text-teal-700 dark:text-teal-400" />}
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {mode === 'plano' ? 'Plano de Ação' : 'Resumo do Mês'}
          </h1>
        </div>
        <button onClick={() => router.push('/assistant/settings')} className="p-2 -mr-2 text-gray-500 dark:text-gray-400">
          <Settings size={20} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-teal-700" size={40} />
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-6">
            <div className="prose dark:prose-invert text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">
              {content}
            </div>
          </div>

          {!apiEnabled && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-4">
              <p className="text-sm text-orange-700 dark:text-orange-300 font-bold mb-3">
                📋 Resumo local gerado. Para análise com IA, configure sua chave de API ou copie o prompt abaixo.
              </p>
              <button
                onClick={handleCopy}
                className="w-full bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-700 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
              >
                {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                {copied ? 'Copiado!' : 'Copiar prompt enviado'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function ReportPage() {
  return (
    <ContextProvider>
      <ReportContent />
    </ContextProvider>
  )
}
