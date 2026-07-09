'use client'

import { useState, useRef, useEffect } from 'react'
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
  RefreshCw,
  Image,
  ScanLine,
} from 'lucide-react'
import { getDynamicIcon } from '@/lib/iconUtils'
import { format } from 'date-fns'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import MoneyInput from '@/components/MoneyInput'
import { useLocalData } from '@/hooks/useLocalData'
import { db } from '@/lib/db'
import { useSafeDb } from '@/hooks/useSafeDb'

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

  let formattedDate = format(new Date(), 'yyyy-MM-dd')
  if (date) {
    const parts = date.split('/')
    if (parts.length === 3) {
      formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`
    }
  }

  const formattedAmount = amount !== null && amount !== undefined
    ? amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0,00'

  return {
    amount: formattedAmount,
    date: formattedDate,
    description: description || 'Compra via OCR',
    establishment: rawText?.split('\n')[0] || '',
  }
}

const SavingSkeleton = () => (
  <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
    <div className="relative w-20 h-20 mb-6">
      <div className="absolute inset-0 rounded-full border-4 border-teal-100 dark:border-teal-900 border-t-teal-600 dark:border-t-teal-400 animate-spin" />
      <div className="absolute inset-2 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
        <FileText size={28} className="text-teal-600 dark:text-teal-400" />
      </div>
    </div>
    <p className="text-gray-500 dark:text-gray-400 font-medium">Salvando transação...</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Processando comprovante e dados</p>
  </div>
)

function ImportContent() {
  const router = useRouter()
  const { user } = useAuth()
  const { context, effectiveContext } = useContext_()
  const { safeDelete, safeUpdate, safeAdd } = useSafeDb()
  
  const [step, setStep] = useState<'upload' | 'review' | 'saving'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [ocrResult, setOcrResult] = useState<any>(null)
  const [amountNum, setAmountNum] = useState(0)
  const [amountFormatted, setAmountFormatted] = useState('0,00')
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    category_id: '',
    credit_card_id: '',
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleFileSelect = async (selectedFile: File | null) => {
    if (!selectedFile) return
    setFile(selectedFile)

    const reader = new FileReader()
    reader.onload = (e) => setPreviewUrl(e.target?.result as string)
    reader.readAsDataURL(selectedFile)

    setLoading(true)
    setStep('review')

    try {
      const result = await processOCR(selectedFile)
      setOcrResult(result)
      const numValue = parseFloat(result.amount.replace(/\./g, '').replace(',', '.')) || 0
      setAmountNum(numValue)
      setAmountFormatted(result.amount)
      setFormData({
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

  // 🔥 HANDLE SAVE ATOMICO COM TRANSACTION
  const handleSave = async () => {
    if (isSubmitting) return
    if (!user?.id) return

    const newErrors: Record<string, string> = {}
    if (amountNum <= 0) newErrors.amount = 'Valor inválido'
    if (!formData.date) newErrors.date = 'Data obrigatória'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)
    setStep('saving')

    try {
      const txId = crypto.randomUUID()
      const txPayload = {
        id: txId,
        user_id: user.id,
        amount: amountNum,
        type: 'expense',
        status: 'pending',
        date: formData.date,
        description: formData.description || 'Comprovante importado',
        category_id: formData.category_id || null,
        credit_card_id: formData.credit_card_id || null,
        notes: formData.notes || null,
        context: effectiveContext,
        affects_balance: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
      }

      // 🔥 Atomicidade: transaction garante que a transação e a fila sejam gravadas juntas
      await db.transaction('rw', db.transactions, db.syncQueue, async () => {
        const result = await safeAdd('transactions', txPayload)
        if (!result.success) throw new Error(result.error)
      })

      router.push('/home')
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message)
      setStep('review')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setPreviewUrl(null)
    setOcrResult(null)
    setAmountNum(0)
    setAmountFormatted('0,00')
    setFormData({
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
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <ContextToggle />
        <div className="w-8" />
      </div>

      <h1 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 mb-6">Importar Comprovante</h1>

      {step === 'upload' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-8 shadow-sm border border-gray-50 dark:border-slate-700 flex flex-col items-center justify-center gap-4 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors active:scale-[0.98]"
          >
            <div className="w-16 h-16 bg-teal-50 dark:bg-teal-900/30 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
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
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            />
          </button>

          <button
            onClick={() => router.push('/transactions/new?type=expense')}
            className="w-full bg-white dark:bg-slate-800 rounded-[24px] p-6 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors active:scale-[0.98]"
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
        <div className="space-y-4 animate-in fade-in duration-300">
          {previewUrl && (
            <div className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <Image size={16} className="text-teal-600 dark:text-teal-400" />
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Comprovante</span>
              </div>
              <div className="rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-700">
                <img src={previewUrl} alt="Comprovante" className="w-full h-48 object-cover" />
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100">Revisar comprovante</h3>
              {loading && (
                <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-xs font-medium">Extraindo dados...</span>
                </div>
              )}
              {ocrResult && !loading && (
                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-full">
                  <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Dados extraídos</span>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Valor</label>
              <div className={`flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3 transition-colors ${errors.amount ? 'border border-red-400' : 'focus-within:border-teal-500'}`}>
                <DollarSign size={18} className="text-gray-400 dark:text-gray-500 mr-2" />
                <MoneyInput
                  value={amountNum}
                  onChange={(num, formatted) => {
                    setAmountNum(num)
                    setAmountFormatted(formatted)
                  }}
                  className="bg-transparent w-full outline-none text-gray-800 dark:text-gray-200 font-bold"
                />
              </div>
              {errors.amount && <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.amount}</p>}
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Data</label>
              <div className={`flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3 transition-colors ${errors.date ? 'border border-red-400' : 'focus-within:border-teal-500'}`}>
                <Calendar size={18} className="text-gray-400 dark:text-gray-500 mr-2" />
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-transparent w-full outline-none text-gray-800 dark:text-gray-200"
                />
              </div>
              {errors.date && <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.date}</p>}
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Descrição</label>
              <div className="flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3 focus-within:border-teal-500 transition-colors">
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

            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Estabelecimento</label>
              <div className="flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3 focus-within:border-teal-500 transition-colors">
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
                className="flex-1 py-3 rounded-xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSubmitting}
                className="flex-1 bg-teal-700 text-white py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50 active:scale-95 shadow-lg shadow-teal-700/20 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Confirmar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'saving' && <SavingSkeleton />}
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
// Blindagem Atômica Finalizada