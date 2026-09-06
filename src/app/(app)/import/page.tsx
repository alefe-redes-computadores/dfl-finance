// src/app/(app)/import/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  DollarSign,
  Edit3,
  FileText,
  Image as ImageIcon,
  Loader2,
  Tag,
} from 'lucide-react'
import { format } from 'date-fns'

import ContextToggle, {
  ContextProvider,
  useContext_,
} from '@/components/ContextToggle'
import MoneyInput from '@/components/MoneyInput'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'

const SavingSkeleton = () => (
  <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
    <div className="relative mb-6 h-20 w-20">
      <div className="absolute inset-0 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600 dark:border-teal-900 dark:border-t-teal-400" />
      <div className="absolute inset-2 flex items-center justify-center rounded-full bg-teal-50 dark:bg-teal-900/30">
        <FileText size={28} className="text-teal-600 dark:text-teal-400" />
      </div>
    </div>
    <p className="font-medium text-gray-500 dark:text-gray-400">
      Salvando transação...
    </p>
    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
      Vinculando o comprovante aos dados revisados
    </p>
  </div>
)

function ImportContent() {
  const router = useRouter()
  const { user } = useAuth()
  const { effectiveContext } = useContext_()
  const { safeAdd } = useSafeDb()
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()

  const [step, setStep] = useState<'upload' | 'review' | 'saving'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [receiptPath, setReceiptPath] = useState<string | null>(null)
  const [ocrResult, setOcrResult] = useState<any>(null)

  const [amountNum, setAmountNum] = useState(0)
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    notes: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const removeUploadedReceipt = async (path: string | null) => {
    if (!path) return

    const { error } = await supabase.storage.from('receipts').remove([path])

    if (error) {
      console.error('Falha ao remover comprovante temporário:', error)
    }
  }

  const handleFileSelect = async (selectedFile: File | null) => {
    if (!selectedFile || !user?.id) return

    if (!selectedFile.type.startsWith('image/')) {
      errorHaptic()
      showToast('Selecione uma imagem do comprovante.', 'warning')
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      errorHaptic()
      showToast('O comprovante deve ter no máximo 10 MB.', 'warning')
      return
    }

    vibrate([8])
    setLoading(true)
    setStep('review')
    setFile(selectedFile)
    setErrors({})

    const reader = new FileReader()
    reader.onload = (event) => setPreviewUrl(event.target?.result as string)
    reader.readAsDataURL(selectedFile)

    try {
      if (receiptPath) {
        await removeUploadedReceipt(receiptPath)
      }

      const extension =
        selectedFile.name.includes('.')
          ? selectedFile.name.split('.').pop()?.toLowerCase() || 'jpg'
          : 'jpg'

      const path = `${user.id}/${crypto.randomUUID()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, selectedFile, { upsert: false })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(path)

      const publicUrl = urlData.publicUrl

      setReceiptPath(path)
      setReceiptUrl(publicUrl)

      try {
        const {
          data: { session: ocrSession },
        } = await supabase.auth.getSession()

        if (!ocrSession?.access_token) {
          throw new Error('Sessão expirada. Entre novamente.')
        }

        const response = await fetch('/api/ocr-receipt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ocrSession.access_token}`,
          },
          body: JSON.stringify({ imageUrl: publicUrl }),
        })

        const payload = await response.json()

        if (!response.ok || !payload?.success || !payload?.data) {
          throw new Error(payload?.error || 'Não foi possível analisar a imagem.')
        }

        const extracted = payload.data
        setOcrResult(extracted)

        if (Number(extracted.amount) > 0) {
          setAmountNum(Number(extracted.amount))
        }

        setFormData({
          date:
            typeof extracted.date === 'string' && extracted.date
              ? extracted.date
              : format(new Date(), 'yyyy-MM-dd'),
          description:
            typeof extracted.description === 'string' && extracted.description.trim()
              ? extracted.description.trim()
              : 'Compra importada',
          notes:
            typeof extracted.suggested_category === 'string' &&
            extracted.suggested_category.trim()
              ? `Categoria sugerida: ${extracted.suggested_category.trim()}`
              : '',
        })

        success()
        showToast('Dados extraídos. Revise antes de salvar.', 'success')
      } catch (ocrError: any) {
        console.error('Erro OCR:', ocrError)
        setOcrResult(null)
        errorHaptic()
        showToast(
          'O comprovante foi anexado, mas a leitura automática falhou. Preencha os dados manualmente.',
          'warning'
        )
      }
    } catch (error: any) {
      setReceiptPath(null)
      setReceiptUrl(null)
      errorHaptic()
      showToast(error?.message || 'Erro ao enviar o comprovante.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (isSubmitting) return

    if (!user?.id) {
      errorHaptic()
      showToast('Sessão expirada. Entre novamente para salvar.', 'error')
      return
    }

    const newErrors: Record<string, string> = {}

    if (amountNum <= 0) newErrors.amount = 'Valor inválido'
    if (!formData.date) newErrors.date = 'Data obrigatória'

    if (Object.keys(newErrors).length > 0) {
      errorHaptic()
      setErrors(newErrors)
      showToast('Revise os campos obrigatórios.', 'warning')
      return
    }

    setIsSubmitting(true)
    setStep('saving')

    try {
      const now = new Date().toISOString()

      const result = await safeAdd('transactions', {
        id: crypto.randomUUID(),
        user_id: user.id,
        amount: amountNum,
        type: 'expense',
        status: 'done',
        date: formData.date,
        description: formData.description || 'Comprovante importado',
        category_id: null,
        credit_card_id: null,
        notes: formData.notes || null,
        receipt_url: receiptUrl,
        context: effectiveContext,
        affects_balance: true,
        created_at: now,
        updated_at: now,
        sync_status: 'pending',
        sync_attempts: 0,
      })

      if (!result.success) throw new Error(result.error)

      success()
      showToast('Comprovante importado e transação salva.', 'success')
      router.push('/home')
    } catch (error: any) {
      errorHaptic()
      showToast(error?.message || 'Erro ao salvar a transação.', 'error')
      setStep('review')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = async () => {
    vibrate([5])

    await removeUploadedReceipt(receiptPath)

    setFile(null)
    setPreviewUrl(null)
    setReceiptUrl(null)
    setReceiptPath(null)
    setOcrResult(null)
    setAmountNum(0)
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      notes: '',
    })
    setErrors({})
    setStep('upload')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div
      ref={containerRef}
      className="mx-auto min-h-screen max-w-md bg-[#f8f9fa] px-4 pb-28 pt-4 font-sans transition-colors duration-300 dark:bg-slate-900"
    >
      <div className="mb-4 rounded-[24px] border border-gray-200/70 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-gray-200/70 bg-gray-50 text-gray-500 transition-colors active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Importar comprovante
              </h1>
              <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">
                Análise assistida e revisão antes de salvar
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
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-4 rounded-[24px] border border-gray-200/70 bg-white p-6 shadow-sm transition-colors active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-teal-50 dark:bg-teal-900/20">
              <Camera size={30} className="text-teal-700 dark:text-teal-400" />
            </div>

            <div className="text-center">
              <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                Escanear cupom fiscal
              </p>
              <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">
                Tire uma foto ou selecione uma imagem
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) =>
                handleFileSelect(event.target.files?.[0] || null)
              }
            />
          </button>

          <div className="rounded-[24px] border border-teal-200/70 bg-teal-50/70 p-4 text-[12px] leading-5 text-teal-800 dark:border-teal-900/50 dark:bg-teal-950/20 dark:text-teal-300">
            A imagem é enviada ao mesmo fluxo de leitura automática usado em Nova
            Transação. Os dados extraídos só são gravados depois da sua revisão.
          </div>

          <button
            type="button"
            onClick={() => router.push('/transactions/new?type=expense')}
            className="flex w-full items-center gap-4 rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm transition-colors active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-gray-100 dark:bg-slate-700">
              <Edit3 size={18} className="text-gray-500 dark:text-gray-400" />
            </div>

            <div className="text-left">
              <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                Lançamento manual rápido
              </p>
              <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">
                Prefiro digitar os dados
              </p>
            </div>
          </button>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {previewUrl && (
            <div className="rounded-[24px] border border-gray-200/70 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center gap-2">
                <ImageIcon size={16} className="text-teal-600 dark:text-teal-400" />
                <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                  Comprovante
                </span>
              </div>

              <div className="overflow-hidden rounded-[18px] bg-gray-100 dark:bg-slate-700">
                <img
                  src={previewUrl}
                  alt="Comprovante"
                  className="h-48 w-full object-cover"
                />
              </div>
            </div>
          )}

          <div className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  Revisar comprovante
                </h3>
                <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">
                  Confirme os dados antes de salvar
                </p>
              </div>

              {loading && (
                <div className="flex shrink-0 items-center gap-2 text-teal-600 dark:text-teal-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-[12px] font-medium">Analisando...</span>
                </div>
              )}

              {ocrResult && !loading && (
                <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 dark:bg-emerald-900/30">
                  <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Dados extraídos
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 ml-1 block text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                  Valor
                </label>

                <div
                  className={`flex items-center rounded-[16px] border bg-gray-50 px-4 py-3 transition-colors dark:bg-slate-900 ${
                    errors.amount
                      ? 'border-red-400 dark:border-red-500'
                      : 'border-gray-200 focus-within:ring-2 focus-within:ring-teal-500/20 dark:border-slate-700'
                  }`}
                >
                  <DollarSign size={18} className="mr-2 text-gray-400 dark:text-gray-500" />
                  <MoneyInput
                    value={amountNum}
                    onChange={(value) => setAmountNum(value)}
                    className="w-full bg-transparent font-semibold text-gray-800 outline-none dark:text-gray-200"
                  />
                </div>

                {errors.amount && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-red-500">
                    <AlertCircle size={12} />
                    {errors.amount}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 ml-1 block text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                  Data
                </label>

                <div
                  className={`flex items-center rounded-[16px] border bg-gray-50 px-4 py-3 transition-colors dark:bg-slate-900 ${
                    errors.date
                      ? 'border-red-400 dark:border-red-500'
                      : 'border-gray-200 focus-within:ring-2 focus-within:ring-teal-500/20 dark:border-slate-700'
                  }`}
                >
                  <Calendar size={18} className="mr-2 text-gray-400 dark:text-gray-500" />
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                    className="w-full bg-transparent text-gray-800 outline-none dark:text-gray-200"
                  />
                </div>

                {errors.date && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-red-500">
                    <AlertCircle size={12} />
                    {errors.date}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 ml-1 block text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                  Descrição
                </label>

                <div className="flex items-center rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900">
                  <Edit3 size={18} className="mr-2 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className="w-full bg-transparent text-gray-800 outline-none dark:text-gray-200"
                    placeholder="Descrição da compra"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 ml-1 block text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                  Observações
                </label>

                <div className="flex items-center rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900">
                  <Tag size={18} className="mr-2 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    className="w-full bg-transparent text-gray-800 outline-none dark:text-gray-200"
                    placeholder="Notas adicionais"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={isSubmitting}
                className="flex-1 rounded-[16px] bg-gray-100 py-3.5 font-bold text-gray-500 transition-colors active:scale-[0.98] disabled:opacity-50 dark:bg-slate-700 dark:text-gray-400"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting || loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-[20px] bg-teal-700 py-3.5 font-bold text-white shadow-lg shadow-teal-700/20 transition-colors active:scale-[0.98] disabled:opacity-50"
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

  if (!isClient) {
    return <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900" />
  }

  return (
    <ContextProvider>
      <ImportContent />
    </ContextProvider>
  )
}
