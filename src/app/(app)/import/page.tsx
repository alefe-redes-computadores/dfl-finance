'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft,
  Upload,
  Camera,
  FileText,
  Loader2,
  Check,
  AlertCircle,
  Edit3,
  Calendar,
  DollarSign,
  Tag,
  CreditCard,
  X,
  Plus,
} from 'lucide-react'
import { getDynamicIcon } from '@/lib/iconUtils'
import { format } from 'date-fns'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

// Função real de OCR usando a API do Google Vision
async function processOCR(file: File): Promise<{
  amount: string
  date: string
  description: string
  establishment: string
}> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/ocr', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Falha no OCR')
  }

  const result = await response.json()
  const { amount, date, description, rawText } = result.data

  // Formatar data de dd/mm/yyyy para yyyy-MM-dd
  let formattedDate = format(new Date(), 'yyyy-MM-dd')
  if (date) {
    const parts = date.split('/')
    if (parts.length === 3) {
      formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`
    }
  }

  // Formatar valor (já vem como string com vírgula)
  const formattedAmount = amount || '0,00'

  return {
    amount: formattedAmount,
    date: formattedDate,
    description: description || 'Compra via OCR',
    establishment: rawText?.split('\n')[0] || '',
  }
}

function ImportContent() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const [step, setStep] = useState<'upload' | 'review' | 'saving'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [ocrResult, setOcrResult] = useState<any>(null)
  const [formData, setFormData] = useState({
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    category_id: '',
    credit_card_id: '',
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (selectedFile: File | null) => {
    if (!selectedFile) return
    setFile(selectedFile)
    setLoading(true)
    setStep('review')

    try {
      const result = await processOCR(selectedFile)
      setOcrResult(result)
      setFormData({
        amount: result.amount,
        date: result.date,
        description: result.description,
        category_id: '',
        credit_card_id: '',
        notes: result.establishment,
      })
    } catch (err) {
      alert('Erro ao processar imagem. Preencha manualmente.')
      setOcrResult(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user?.id) return

    // Validação
    const newErrors: Record<string, string> = {}
    const rawAmount = parseFloat(formData.amount.replace(',', '.')) || 0
    if (rawAmount <= 0) newErrors.amount = 'Valor inválido'
    if (!formData.date) newErrors.date = 'Data obrigatória'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    setStep('saving')

    const payload = {
      user_id: user.id,
      amount: rawAmount,
      type: 'expense',
      status: 'pending',
      date: formData.date,
      description: formData.description || 'Comprovante importado',
      category_id: formData.category_id || null,
      credit_card_id: formData.credit_card_id || null,
      notes: formData.notes || null,
      context,
    }

    const { error } = await supabase.from('transactions').insert([payload])
    if (error) {
      alert('Erro ao salvar: ' + error.message)
      setStep('review')
    } else {
      router.push('/home')
    }
    setLoading(false)
  }

  const handleReset = () => {
    setFile(null)
    setOcrResult(null)
    setFormData({
      amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      category_id: '',
      credit_card_id: '',
      notes: '',
    })
    setErrors({})
    setStep('upload')
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <ContextToggle />
        <div className="w-8" />
      </div>

      <h1 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 mb-6">Importar Comprovante</h1>

      {step === 'upload' && (
        <div className="space-y-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-8 shadow-sm border border-gray-50 dark:border-slate-700 flex flex-col items-center justify-center gap-4 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <div className="w-16 h-16 bg-teal-50 dark:bg-teal-900/30 rounded-full flex items-center justify-center">
              <Camera size={32} className="text-teal-700 dark:text-teal-400" />
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-800 dark:text-gray-200">Escanear Cupom Fiscal</p>
              <p className="text-[12px] text-gray-400 dark:text-gray-500">Tire uma foto ou selecione um arquivo</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            />
          </button>

          <button
            onClick={() => router.push('/transactions/new?type=expense')}
            className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-6 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
              <Edit3 size={20} className="text-gray-500 dark:text-gray-400" />
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-800 dark:text-gray-200">Lançamento Manual Rápido</p>
              <p className="text-[12px] text-gray-400 dark:text-gray-500">Prefiro digitar os dados</p>
            </div>
          </button>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
            <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Revisar comprovante</h3>
            
            {/* Valor */}
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Valor</label>
              <div className={`flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3 ${errors.amount ? 'border border-red-400' : ''}`}>
                <DollarSign size={18} className="text-gray-400 dark:text-gray-500 mr-2" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.amount}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '')
                    if (!digits) {
                      setFormData({ ...formData, amount: '' })
                      return
                    }
                    const formatted = (Number(digits) / 100).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                    setFormData({ ...formData, amount: formatted })
                  }}
                  className="bg-transparent w-full outline-none text-gray-800 dark:text-gray-200 font-bold"
                  placeholder="0,00"
                />
              </div>
              {errors.amount && <p className="text-red-500 text-[10px] mt-1">{errors.amount}</p>}
            </div>

            {/* Data */}
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Data</label>
              <div className={`flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3 ${errors.date ? 'border border-red-400' : ''}`}>
                <Calendar size={18} className="text-gray-400 dark:text-gray-500 mr-2" />
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-transparent w-full outline-none text-gray-800 dark:text-gray-200"
                />
              </div>
              {errors.date && <p className="text-red-500 text-[10px] mt-1">{errors.date}</p>}
            </div>

            {/* Descrição */}
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Descrição</label>
              <div className="flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                <Edit3 size={18} className="text-gray-400 dark:text-gray-500 mr-2" />
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-transparent w-full outline-none text-gray-800 dark:text-gray-200"
                  placeholder="Descrição da compra"
                />
              </div>
            </div>

            {/* Notas (estabelecimento) */}
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Estabelecimento</label>
              <div className="flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                <Tag size={18} className="text-gray-400 dark:text-gray-500 mr-2" />
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="bg-transparent w-full outline-none text-gray-800 dark:text-gray-200"
                  placeholder="Nome do estabelecimento"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3 rounded-xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 bg-teal-700 text-white py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'saving' && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-teal-700 mb-4" size={40} />
          <p className="text-gray-500 dark:text-gray-400">Salvando transação...</p>
        </div>
      )}
    </div>
  )
}

export default function ImportPage() {
  return (
    <ContextProvider>
      <ImportContent />
    </ContextProvider>
  )
}