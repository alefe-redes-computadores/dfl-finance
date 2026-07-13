'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft,
  Camera,
  FileText,
  Loader2,
  Check,
  AlertCircle,
  Edit3,
  Calendar,
  DollarSign,
  Tag,
  Image as ImageIcon
} from 'lucide-react'
import { format } from 'date-fns'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import MoneyInput from '@/components/MoneyInput'
import { db } from '@/lib/db'
import { useSafeDb } from '@/hooks/useSafeDb'

import { extractReceiptFromFile } from '@/lib/services/ocrService'

// 🔥 SKELETON ATUALIZADO
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
  const { effectiveContext } = useContext_()
  const { safeAdd } = useSafeDb()
  
  const [step, setStep] = useState<'upload' | 'review' | 'saving'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [ocrResult, setOcrResult] = useState<any>(null)
  
  const [apiKey, setApiKey] = useState('')
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

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key')
    if (savedKey) setApiKey(savedKey)
  }, [])

  const handleFileSelect = async (selectedFile: File | null) => {
    if (!selectedFile) return
    
    const currentKey = localStorage.getItem('gemini_api_key') || apiKey
    if (!currentKey) {
      alert('Por favor, configure sua chave de API Gemini no campo abaixo antes de enviar.')
      return
    }

    setFile(selectedFile)

    const reader = new FileReader()
    reader.onload = (e) => setPreviewUrl(e.target?.result as string)
    reader.readAsDataURL(selectedFile)

    setLoading(true)
    setStep('review')

    try {
      const result = await extractReceiptFromFile(selectedFile, currentKey)
      setOcrResult(result)
      
      const numValue = result.amount || 0
      setAmountNum(numValue)
      setAmountFormatted(numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
      
      setFormData({
        date: result.date || format(new Date(), 'yyyy-MM-dd'),
        description: result.description || 'Compra importada',
        category_id: '',
        credit_card_id: '',
        notes: result.suggested_category ? `Categoria Sugerida: ${result.suggested_category}` : '',
      })
    } catch (err: any) {
      alert('Erro ao processar imagem: ' + err.message + '. Preencha manualmente.')
      setOcrResult(null)
    } finally {
      setLoading(false)
    }
  }

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
    <div
      ref={containerRef}
      className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-4 transition-colors duration-300"
    >
      <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm px-4 py-4 mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => router.back()}
              className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                Importar comprovante
              </h1>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                Extração local com revisão antes de salvar
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <ContextToggle />
          </div>
        </div>
      </div>

      {step === 'upload' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-6 flex flex-col items-center justify-center gap-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]"
          >
            <div className="w-16 h-16 rounded-[20px] bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
              <Camera size={30} className="text-teal-700 dark:text-teal-400" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                Escanear cupom fiscal
              </p>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                Tire uma foto ou selecione um arquivo
              </p>
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

          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
            <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
              Chave API Gemini
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value)
                localStorage.setItem('gemini_api_key', e.target.value)
              }}
              placeholder="Sua chave (opcional se já salva)"
              className="w-full rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 text-[14px] text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500/20 outline-none"
            />
          </div>

          <button
            onClick={() => router.push('/transactions/new?type=expense')}
            className="w-full bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-[16px] bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
              <Edit3 size={18} className="text-gray-500 dark:text-gray-400" />
            </div>
            <div className="text-left">
              <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                Lançamento manual rápido
              </p>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                Prefiro digitar os dados
              </p>
            </div>
          </button>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {previewUrl && (
            <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon size={16} className="text-teal-600 dark:text-teal-400" />
                <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                  Comprovante
                </span>
              </div>
              <div className="rounded-[18px] overflow-hidden bg-gray-100 dark:bg-slate-700">
                <img src={previewUrl} alt="Comprovante" className="w-full h-48 object-cover" />
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4 gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  Revisar comprovante
                </h3>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Confirme os dados antes de salvar
                </p>
              </div>

              {loading && (
                <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 shrink-0">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-[12px] font-medium">Extraindo...</span>
                </div>
              )}

              {ocrResult && !loading && (
                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-full shrink-0">
                  <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Dados extraídos
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                  Valor
                </label>
                <div className={`flex items-center rounded-[16px] bg-gray-50 dark:bg-slate-900 border px-4 py-3 transition-colors ${
                  errors.amount ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-teal-500/20'
                }`}>
                  <DollarSign size={18} className="text-gray-400 dark:text-gray-500 mr-2" />
                  <MoneyInput
                    value={amountNum}
                    onChange={(num, formatted) => {
                      setAmountNum(num)
                      setAmountFormatted(formatted)
                    }}
                    className="bg-transparent w-full outline-none text-gray-800 dark:text-gray-200 font-semibold"
                  />
                </div>
                {errors.amount && (
                  <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {errors.amount}
                  </p>
                )}
              </div>

              <div>
                <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                  Data
                </label>
                <div className={`flex items-center rounded-[16px] bg-gray-50 dark:bg-slate-900 border px-4 py-3 transition-colors ${
                  errors.date ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-teal-500/20'
                }`}>
                  <Calendar size={18} className="text-gray-400 dark:text-gray-500 mr-2" />
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="bg-transparent w-full outline-none text-gray-800 dark:text-gray-200"
                  />
                </div>
                {errors.date && (
                  <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {errors.date}
                  </p>
                )}
              </div>

              <div>
                <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                  Descrição
                </label>
                <div className="flex items-center rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/20 transition-colors">
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

              <div>
                <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                  Observações
                </label>
                <div className="flex items-center rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/20 transition-colors">
                  <Tag size={18} className="text-gray-400 dark:text-gray-500 mr-2" />
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="bg-transparent w-full outline-none text-gray-800 dark:text-gray-200"
                    placeholder="Notas adicionais"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleReset}
                className="flex-1 py-3.5 rounded-[16px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSubmitting}
                className="flex-1 bg-teal-700 text-white py-3.5 rounded-[20px] font-bold hover:bg-teal-800 transition-colors disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-teal-700/20 flex items-center justify-center gap-2"
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
  const [isClient, setIsClient] = useState(false)
  useEffect(() => setIsClient(true), [])
  if (!isClient) return <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900" />

  return (
    <ContextProvider>
      <ImportContent />
    </ContextProvider>
  )
}