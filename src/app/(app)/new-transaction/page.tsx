'use client'

import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Tag, Wallet, ChevronDown, ChevronUp, Check,
  Camera, Plus, Hash, X, ArrowRightLeft, Building, HandCoins
} from 'lucide-react'
import { addMonths, addWeeks, format } from 'date-fns'
import ReceiptModal from '@/components/ReceiptModal'
import ComingSoonModal from '@/components/ComingSoonModal'

type TxType = 'income' | 'expense' | 'transfer'
type Context = 'dfl' | 'personal'
type Repetition = 'once' | 'installments' | 'recurring'
type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'custom'

function CameraCapture({ isOpen, onClose, onCapture }: { isOpen: boolean; onClose: () => void; onCapture: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        setStream(mediaStream)
        if (videoRef.current) videoRef.current.srcObject = mediaStream
      } catch (err) {
        setError('Não foi possível acessar a câmera. Verifique as permissões.')
      }
    }
    startCamera()
    return () => { stream?.getTracks().forEach(track => track.stop()) }
  }, [isOpen])

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
        onCapture(file)
        onClose()
      }
    }, 'image/jpeg')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="flex justify-between items-center p-4 text-white">
        <button onClick={onClose} className="p-2"><X size={24} /></button>
        <span className="font-bold">Tirar foto</span>
        <div className="w-10" />
      </div>
      {error ? (
        <div className="flex-1 flex items-center justify-center text-white p-4 text-center"><p>{error}</p></div>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline className="flex-1 w-full object-cover" />
          <div className="p-6 flex justify-center">
            <button onClick={handleCapture} className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
              <div className="w-14 h-14 rounded-full border-2 border-gray-800" />
            </button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </>
      )}
    </div>
  )
}

function NewTransactionContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [type, setType] = useState<TxType>((searchParams.get('type') as TxType) || 'expense')
  const [context, setContext] = useState<Context>('dfl')
  const [amount, setAmount] = useState('0,00')
  const [amountNum, setAmountNum] = useState(0)
  const [isPaid, setIsPaid] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [desc, setDesc] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [tagId, setTagId] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [saving, setSaving] = useState(false)

  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [receipt, setReceipt] = useState<File | null>(null)
  const [installments, setInstallments] = useState(1)

  const [repetition, setRepetition] = useState<Repetition>('once')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [isRefund, setIsRefund] = useState(false)
  const [isFinancing, setIsFinancing] = useState(false)
  const [isLoan, setIsLoan] = useState(false)

  const [showCatModal, setShowCatModal] = useState(false)
  const [showAccModal, setShowAccModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)

  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showComingSoon, setShowComingSoon] = useState(false)
  const [showCamera, setShowCamera] = useState(false)

  const handleDateChange = (newDateStr: string) => {
    setDate(newDateStr)
    const selectedDate = new Date(newDateStr + 'T12:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    selectedDate.setHours(0, 0, 0, 0)
    setIsPaid(selectedDate <= today)
  }

  const isIncome = type === 'income'
  const themeColor = isIncome ? 'text-emerald-700' : 'text-red-600'
  const bgColor = isIncome ? 'bg-emerald-700' : 'bg-red-600'
  const selectedCat = categories.find(c => c.id === categoryId)
  const selectedAcc = accounts.find(a => a.id === accountId)
  const selectedTag = tags.find(t => t.id === tagId)

  const loadData = useCallback(async () => {
    if (!user?.id) return
    const catType = type === 'income' ? 'income' : 'expense'

    const [{ data: cats }, { data: accs }, { data: tgs }] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', user.id).eq('context', context).eq('type', catType),
      supabase.from('accounts').select('*').eq('user_id', user.id).eq('context', context).order('name'),
      supabase.from('tags').select('*').eq('user_id', user.id).eq('context', context).order('name')
    ])

    setCategories(Array.isArray(cats) ? cats : [])
    setAccounts(Array.isArray(accs) ? accs : [])
    setTags(Array.isArray(tgs) ? tgs : [])
  }, [user, context, type])

  useEffect(() => { loadData() }, [loadData])

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setAmount(val)
    const rawValue = val.replace(/\./g, '').replace(',', '.')
    const num = parseFloat(rawValue)
    setAmountNum(isNaN(num) ? 0 : num)
  }

  const handleReceiptOption = (option: string) => {
    setShowReceiptModal(false)
    if (option === 'camera') {
      setShowCamera(true)
      return
    }
    if (option === 'galeria' || option === 'pdf') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = option === 'pdf' ? 'application/pdf' : 'image/*'
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0]
        if (file) setReceipt(file)
      }
      input.click()
    }
  }

  const handleCameraCapture = (file: File) => {
    setReceipt(file)
    setShowCamera(false)
  }

  const handleSave = async () => {
    if (!user?.id) return

    const rawAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.')) || 0
    if (rawAmount <= 0) {
      alert('Erro: O valor da transação deve ser maior que R$ 0,00.')
      setSaving(false)
      return
    }

    setSaving(true)

    let receiptUrl: string | null = null
    if (receipt) {
      try {
        const ext = receipt.name.split('.').pop() || 'jpg'
        const uniqueName = `${crypto.randomUUID()}.${ext}`
        const path = `${user.id}/${uniqueName}`
        const { data, error: uploadError } = await supabase.storage.from('receipts').upload(path, receipt)
        if (!uploadError && data) {
          const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
          receiptUrl = urlData.publicUrl
        } else {
          console.error('Erro no upload do comprovante:', uploadError)
        }
      } catch (err) {
        console.error('Erro inesperado no upload:', err)
      }
    }

    let totalParcels = 1
    let recurringGroupId: string | null = null

    if (repetition === 'installments') {
      totalParcels = installments
      recurringGroupId = crypto.randomUUID()
    } else if (repetition === 'recurring') {
      recurringGroupId = crypto.randomUUID()
      switch (frequency) {
        case 'weekly': totalParcels = 52; break
        case 'biweekly': totalParcels = 24; break
        case 'monthly': totalParcels = 12; break
        case 'bimonthly': totalParcels = 6; break
        case 'custom': totalParcels = 12; break
        default: totalParcels = 12
      }
    }

    const installmentAmount = totalParcels > 1 ? rawAmount / totalParcels : rawAmount

    try {
      for (let i = 0; i < totalParcels; i++) {
        let installmentDate: string
        if (repetition === 'recurring') {
          const baseDate = new Date(date)
          if (frequency === 'weekly') {
            installmentDate = format(addWeeks(baseDate, i), 'yyyy-MM-dd')
          } else if (frequency === 'biweekly') {
            installmentDate = format(addWeeks(baseDate, i * 2), 'yyyy-MM-dd')
          } else if (frequency === 'monthly') {
            installmentDate = format(addMonths(baseDate, i), 'yyyy-MM-dd')
          } else if (frequency === 'bimonthly') {
            installmentDate = format(addMonths(baseDate, i * 2), 'yyyy-MM-dd')
          } else {
            installmentDate = format(addMonths(baseDate, i), 'yyyy-MM-dd')
          }
        } else {
          installmentDate = format(addMonths(new Date(date), i), 'yyyy-MM-dd')
        }

        const { error: insertError } = await supabase.from('transactions').insert({
          user_id: user.id,
          type,
          amount: installmentAmount,
          description: desc || null,
          category_id: categoryId || null,
          account_id: accountId || null,
          tag_id: tagId || null,
          date: installmentDate,
          status: isPaid ? 'done' : 'pending',
          context,
          receipt_url: i === 0 ? receiptUrl : null,
          recurring_group_id: recurringGroupId,
          installment_index: totalParcels > 1 ? i + 1 : 1,
          total_installments: totalParcels > 1 ? totalParcels : 1
        })

        if (insertError) throw insertError

        if (isPaid && accountId && i === 0) {
          const { data: acc } = await supabase.from('accounts').select('balance').eq('id', accountId).single()
          if (acc) {
            const currentBalance = Number(acc.balance) || 0
            const newBalance = type === 'income'
              ? currentBalance + installmentAmount
              : currentBalance - installmentAmount

            await supabase.from('accounts').update({ balance: newBalance }).eq('id', accountId)
          }
        }
      }

      router.refresh()
      router.push('/transactions')
    } catch (e) {
      console.error(e)
      alert('Erro ao salvar transação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-black font-sans text-gray-800 overflow-y-auto pb-32">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2 sticky top-0 bg-white dark:bg-black z-40">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
          <ChevronLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-base">Nova Transação</h1>
        <button onClick={() => setShowReceiptModal(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
          <Camera size={18} className="text-gray-700" />
        </button>
      </div>

      {/* Context Selector */}
      <div className="flex justify-center mt-2 mb-1">
        <div className="flex bg-gray-100 p-1 rounded-full">
          {(['dfl', 'personal'] as Context[]).map(c => (
            <button
              key={c}
              onClick={() => setContext(c)}
              className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${context === c ? 'bg-white shadow-sm' : 'text-gray-500'}`}
            >
              {c === 'dfl' ? 'DFL' : 'Pessoal'}
            </button>
          ))}
        </div>
      </div>

      {/* Valor */}
      <div className="py-6 text-center px-6">
        <p className="text-gray-400 text-xs mb-2">Valor</p>
        <div className="flex justify-center items-center gap-1">
          <span className={`text-2xl font-medium ${themeColor} opacity-60`}>R$</span>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={handleAmount}
            className={`text-5xl font-bold outline-none bg-transparent ${themeColor} w-48 text-center`}
          />
        </div>
      </div>

      {/* Card Principal */}
      <div className="bg-white rounded-3xl mx-4 shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="font-medium text-sm">{isIncome ? 'Recebido' : 'Pago'}</span>
          <button onClick={() => setIsPaid(!isPaid)} className={`w-12 h-6 rounded-full transition-colors ${isPaid ? bgColor : 'bg-gray-300'}`}>
            <div className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${isPaid ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <button onClick={() => setShowCatModal(true)} className="w-full flex items-center gap-4 px-5 py-4 border-b border-gray-100">
          <Tag size={18} className="text-gray-400" />
          <span className={`flex-1 text-left text-sm font-medium ${selectedCat ? 'text-gray-800' : 'text-gray-400'}`}>
            {selectedCat ? `${selectedCat.icon} ${selectedCat.name}` : 'Categoria'}
          </span>
          <Plus size={18} className="text-teal-700" />
        </button>

        <button onClick={() => setShowAccModal(true)} className="w-full flex items-center gap-4 px-5 py-4">
          <Wallet size={18} className="text-gray-400" />
          <span className={`flex-1 text-left text-sm font-medium ${selectedAcc ? 'text-gray-800' : 'text-gray-400'}`}>
            {selectedAcc ? selectedAcc.name : 'Conta'}
          </span>
          <Plus size={18} className="text-teal-700" />
        </button>
      </div>

      {/* Detalhes */}
      <div className="mx-4 mt-3">
        <button onClick={() => setShowDetails(!showDetails)} className="text-emerald-800 text-sm font-bold flex items-center gap-1 py-2">
          {showDetails ? 'Ocultar detalhes' : 'Mais detalhes'}
          {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showDetails && (
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden mt-2">
            <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="w-full px-5 py-4 text-sm border-b border-gray-100 outline-none" />
            <input placeholder="Descrição" value={desc} onChange={e => setDesc(e.target.value)} className="w-full px-5 py-4 text-sm border-b border-gray-100 outline-none" />

            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-800 mb-3">Repetição</p>
              <div className="flex gap-2">
                {[
                  { key: 'once', label: 'Única' },
                  { key: 'installments', label: 'Parcelar' },
                  { key: 'recurring', label: 'Recorrente' }
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setRepetition(opt.key as Repetition)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${repetition === opt.key ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {repetition === 'installments' && (
                <div className="mt-3 flex items-center gap-3">
                  <Hash size={16} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Parcelas:</span>
                  <select value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className="text-sm font-medium text-gray-800 bg-gray-100 rounded-lg px-2 py-1 outline-none">
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (<option key={n} value={n}>{n}x</option>))}
                  </select>
                </div>
              )}

              {repetition === 'recurring' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { key: 'weekly', label: 'Semanal' },
                    { key: 'biweekly', label: 'Quinzenal' },
                    { key: 'monthly', label: 'Mensal' },
                    { key: 'bimonthly', label: 'Bimestral' },
                    { key: 'custom', label: 'Personalizar' }
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => {
                        if (f.key === 'custom') {
                          setShowComingSoon(true)
                          return
                        }
                        setFrequency(f.key as Frequency)
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${frequency === f.key ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setShowTagModal(true)} className="w-full flex items-center gap-4 px-5 py-4 border-b border-gray-100">
              <Tag size={18} className="text-gray-400" />
              <span className={`flex-1 text-left text-sm font-medium ${selectedTag ? 'text-gray-800' : 'text-gray-400'}`}>
                {selectedTag ? selectedTag.name : 'Vincular Tag'}
              </span>
            </button>

            {!isIncome && (
              <div className="px-5 py-4 space-y-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><ArrowRightLeft size={16} className="text-gray-400" /><span className="text-sm font-medium text-gray-800">É uma devolução / estorno</span></div>
                  <button onClick={() => setIsRefund(!isRefund)} className={`w-10 h-6 rounded-full relative transition-colors ${isRefund ? 'bg-teal-700' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isRefund ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Building size={16} className="text-gray-400" /><span className="text-sm font-medium text-gray-400">Financiamento</span></div>
                  <button onClick={() => setShowComingSoon(true)} className="w-10 h-6 rounded-full bg-gray-200 relative cursor-pointer"><div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full" /></button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><HandCoins size={16} className="text-gray-400" /><span className="text-sm font-medium text-gray-400">Empréstimo a alguém</span></div>
                  <button onClick={() => setShowComingSoon(true)} className="w-10 h-6 rounded-full bg-gray-200 relative cursor-pointer"><div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full" /></button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-8 w-full flex justify-center z-50">
        <button onClick={handleSave} disabled={saving} className={`w-16 h-16 ${bgColor} rounded-full flex items-center justify-center shadow-xl`}>
          {saving ? <div className="w-6 h-6 border-2 border-white rounded-full animate-spin" /> : <Check size={30} className="text-white" />}
        </button>
      </div>

      {showCatModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCatModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 h-[50vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold">Categorias</h3><button onClick={() => router.push('/categories')} className="text-teal-700"><Plus size={20} /></button></div>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => { setCategoryId(cat.id); setShowCatModal(false) }} className="w-full p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cat.color}20` }}>{cat.icon}</div>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showAccModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowAccModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 h-[50vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold">Contas</h3><button onClick={() => router.push('/accounts')} className="text-teal-700"><Plus size={20} /></button></div>
            {accounts.map(acc => (
              <button key={acc.id} onClick={() => { setAccountId(acc.id); setShowAccModal(false) }} className="w-full p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: acc.color }}>{acc.name.substring(0, 2).toUpperCase()}</div>
                {acc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showTagModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowTagModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 h-[50vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold">Tags</h3><button onClick={() => router.push('/tags')} className="text-teal-700"><Plus size={20} /></button></div>
            {tags.map(tag => (
              <button key={tag.id} onClick={() => { setTagId(tag.id); setShowTagModal(false) }} className="w-full p-3 flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />{tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <ReceiptModal isOpen={showReceiptModal} onClose={() => setShowReceiptModal(false)} onOptionSelect={handleReceiptOption} />
      <CameraCapture isOpen={showCamera} onClose={() => setShowCamera(false)} onCapture={handleCameraCapture} />
      <ComingSoonModal isOpen={showComingSoon} onClose={() => setShowComingSoon(false)} />
    </div>
  )
}

export default function NewTransactionPage() {
  return <Suspense><NewTransactionContent /></Suspense>
}