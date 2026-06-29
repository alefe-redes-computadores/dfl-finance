'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useContext_ } from '@/components/ContextToggle'
import {
  ChevronLeft, Upload, FileText, Loader2, Check, X, Edit3,
  Trash2, Plus, AlertTriangle, Download, CreditCard
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/contexts/ToastContext'

interface ExtractedTransaction {
  date: string
  description: string
  amount: number
  suggested_category: string
}

export default function ImportInvoicePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState<ExtractedTransaction[]>([])
  const [importing, setImporting] = useState(false)
  const [creditCardId, setCreditCardId] = useState('')
  const [creditCards, setCreditCards] = useState<any[]>([])
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile || !user?.id) return

    setFile(selectedFile)
    setLoading(true)
    setStep('preview')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('user_id', user.id)
      formData.append('context', context)

      const response = await fetch('/api/extract-invoice', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao extrair transações')
      }

      setTransactions(data.transactions || [])

      // Busca cartões de crédito para associar
      const { data: cardsData } = await supabase
        .from('credit_cards')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('context', context)

      setCreditCards(Array.isArray(cardsData) ? cardsData : [])
    } catch (err: any) {
      showToast(err.message || 'Erro ao processar arquivo', 'error')
      setStep('upload')
    } finally {
      setLoading(false)
    }
  }

  const updateTransaction = (index: number, field: string, value: any) => {
    setTransactions(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const removeTransaction = (index: number) => {
    setTransactions(prev => prev.filter((_, i) => i !== index))
  }

  const handleImport = async () => {
    if (!user?.id || transactions.length === 0) return
    setImporting(true)

    try {
      const payload = transactions.map(tx => ({
        user_id: user.id,
        type: 'expense',
        amount: tx.amount,
        description: tx.description,
        category_id: null, // será mapeado depois
        account_id: null,
        credit_card_id: creditCardId || null,
        date: tx.date,
        status: creditCardId ? 'done' : 'pending',
        context,
      }))

      const { error } = await supabase.from('transactions').insert(payload)

      if (error) throw error

      showToast(`${transactions.length} transações importadas!`, 'success')
      setStep('done')
      router.refresh()
    } catch (err: any) {
      console.error('Erro ao importar:', err)
      showToast(`Erro ao importar: ${err.message}`, 'error')
    } finally {
      setImporting(false)
    }
  }

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f8f9fa] dark:bg-slate-900">
        <Loader2 className="animate-spin text-teal-700" size={48} />
        <p className="text-gray-500 dark:text-gray-400">Processando arquivo com IA...</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Importar Fatura</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Upload inicial */}
        {step === 'upload' && (
          <div className="space-y-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-2xl p-8 flex flex-col items-center gap-3 text-gray-500 hover:border-teal-500 hover:text-teal-600 transition-colors"
            >
              <Upload size={40} />
              <div className="text-center">
                <p className="font-bold text-sm">Selecionar arquivo</p>
                <p className="text-xs text-gray-400 mt-1">PDF ou OFX da sua fatura</p>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.ofx"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {/* Preview das transações */}
        {step === 'preview' && (
          <div className="space-y-4">
            {/* Info do arquivo */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-teal-600" />
                <div>
                  <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{file?.name}</p>
                  <p className="text-xs text-gray-500">{transactions.length} transações encontradas</p>
                </div>
              </div>
            </div>

            {/* Seletor de cartão (opcional) */}
            {creditCards.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">
                  Associar ao cartão (opcional)
                </label>
                <select
                  value={creditCardId}
                  onChange={(e) => setCreditCardId(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl p-3 text-sm outline-none"
                >
                  <option value="">Nenhum cartão</option>
                  {creditCards.map((card) => (
                    <option key={card.id} value={card.id}>{card.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Lista editável */}
            <div className="space-y-2">
              {transactions.map((tx, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between mb-2">
                    <input
                      type="date"
                      value={tx.date}
                      onChange={(e) => updateTransaction(index, 'date', e.target.value)}
                      className="text-sm font-bold bg-transparent outline-none text-gray-800 dark:text-gray-200 w-32"
                    />
                    <button
                      onClick={() => removeTransaction(index)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={tx.description}
                    onChange={(e) => updateTransaction(index, 'description', e.target.value)}
                    className="w-full text-sm bg-transparent outline-none text-gray-700 dark:text-gray-300 mb-2"
                    placeholder="Descrição"
                  />

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={tx.amount}
                      onChange={(e) => updateTransaction(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-28 text-sm font-bold bg-transparent outline-none text-teal-600"
                    />
                    <span className="text-xs text-gray-400 flex-1">{tx.suggested_category}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Botão de importar */}
            <button
              onClick={handleImport}
              disabled={importing || transactions.length === 0}
              className="w-full bg-teal-700 text-white py-4 rounded-2xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {importing ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
              {importing ? 'Importando...' : `Importar ${transactions.length} transações`}
            </button>
          </div>
        )}

        {/* Concluído */}
        {step === 'done' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Importação concluída!</h2>
            <p className="text-gray-500 mb-6">{transactions.length} transações foram importadas com sucesso.</p>
            <button
              onClick={() => router.push('/transactions')}
              className="bg-teal-700 text-white px-6 py-3 rounded-2xl font-bold hover:bg-teal-800 transition-colors"
            >
              Ver transações
            </button>
          </div>
        )}
      </div>
    </div>
  )
}