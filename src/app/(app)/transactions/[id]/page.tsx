'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import * as Icons from 'lucide-react'
import {
  ChevronLeft, Copy, Trash2, Calendar, Edit3, Tag, Wallet, RefreshCw, Check, Loader2, ChevronRight,
  ArrowRightLeft, Building, HandCoins, Plus, X, FileImage, Paperclip, QrCode
} from 'lucide-react'
import { format } from 'date-fns'
import ReceiptModal from '@/components/ReceiptModal'
import CameraCapture from '@/components/CameraCapture'
import QRCodeScanner from '@/components/QRCodeScanner'
import ModalFinancing from '@/components/ModalFinancing'
import ModalEmprestimo from '@/components/ModalEmprestimo'
import { useToast } from '@/contexts/ToastContext'

const getDynamicIcon = (iconName: string) => {
  if (!iconName) return Icons.Tag
  const formattedName = iconName.charAt(0).toUpperCase() + iconName.slice(1)
  return (Icons as any)[formattedName] || Icons.Tag
}

export default function EditTransactionPage() {
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tx, setTx] = useState<any>(null)
  const [isNew, setIsNew] = useState(false)

  const [accounts, setAccounts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [subcategories, setSubcategories] = useState<Record<string, any[]>>({})
  const [tags, setTags] = useState<any[]>([])

  const [amountInput, setAmountInput] = useState('')
  const [isPaid, setIsPaid] = useState(false)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [txType, setTxType] = useState<'income' | 'expense'>('expense')

  const [showDetails, setShowDetails] = useState(false)
  const [notes, setNotes] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isRefund, setIsRefund] = useState(false)
  const [isFinancing, setIsFinancing] = useState(false)
  const [isLoan, setIsLoan] = useState(false)

  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [receiptName, setReceiptName] = useState<string>('')
  const [uploading, setUploading] = useState(false)

  const [financingId, setFinancingId] = useState<string | null>(null)
  const [debtId, setDebtId] = useState<string | null>(null)

  const [showCatModal, setShowCatModal] = useState(false)
  const [showSubCatModal, setShowSubCatModal] = useState(false)
  const [selectedParentCat, setSelectedParentCat] = useState<any>(null)
  const [showAccModal, setShowAccModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [showFinancingModal, setShowFinancingModal] = useState(false)
  const [showLoanModal, setShowLoanModal] = useState(false)

  const handleDateChange = (newDateStr: string) => {
    setDate(newDateStr)
    const selectedDate = new Date(newDateStr + 'T12:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    selectedDate.setHours(0, 0, 0, 0)
    setIsPaid(selectedDate <= today)
  }

  const uploadFile = async (file: File) => {
    if (!user) return
    setUploading(true)
    setReceiptName(file.name)

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setReceiptPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setReceiptPreview(null)
    }

    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const uniqueName = `${crypto.randomUUID()}.${ext}`
      const path = `${user.id}/${uniqueName}`
      
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, file)

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(path)

      if (receiptUrl) {
        const oldPath = receiptUrl.split('/').slice(-2).join('/')
        await supabase.storage.from('receipts').remove([oldPath])
      }

      setReceiptUrl(urlData.publicUrl)
      showToast('Comprovante atualizado!', 'success')
    } catch (err: any) {
      showToast(`Erro ao anexar: ${err.message}`, 'error')
      setReceiptPreview(null)
      setReceiptName('')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveReceipt = async () => {
    if (receiptUrl) {
      const path = receiptUrl.split('/').slice(-2).join('/')
      await supabase.storage.from('receipts').remove([path])
    }
    setReceiptUrl(null)
    setReceiptPreview(null)
    setReceiptName('')
    showToast('Comprovante removido.', 'info')
  }

  const handleReceiptOption = (option: string) => {
    setShowReceiptModal(false)
    if (option === 'camera') {
      setShowCamera(true)
      return
    }
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = option === 'pdf' ? 'application/pdf' : 'image/*'
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0]
      if (file) uploadFile(file)
    }
    input.click()
  }

  const handleCameraCapture = (file: File) => {
    uploadFile(file)
    setShowCamera(false)
  }

  const loadData = useCallback(async () => {
    if (!user?.id) return
    if (id === 'new') {
      setIsNew(true)
      const paramType = searchParams.get('type')
      if (paramType === 'income' || paramType === 'expense') {
        setTxType(paramType)
        if (paramType === 'income') setIsPaid(true)
      }
    }
    setLoading(true)

    try {
      const catType = txType === 'income' ? 'income' : 'expense'

      const [{ data: accData }, { data: catData }, { data: tagData }] = await Promise.all([
        supabase.from('accounts').select('id, name, balance, color').match({ user_id: user.id }).order('name'),
        supabase.from('categories').select('*').match({ user_id: user.id }).eq('type', catType),
        supabase.from('tags').select('id, name, color').match({ user_id: user.id }).order('name')
      ])

      setAccounts(Array.isArray(accData) ? accData : [])
      const allCats = Array.isArray(catData) ? catData : []
      const mainCats = allCats.filter(c => !c.parent_id)
      const subCats = allCats.filter(c => c.parent_id)
      
      const subsMap: Record<string, any[]> = {}
      subCats.forEach(sub => {
        const key = sub.parent_id
        if (!subsMap[key]) subsMap[key] = []
        subsMap[key].push(sub)
      })

      setCategories(mainCats)
      setSubcategories(subsMap)
      setTags(Array.isArray(tagData) ? tagData : [])

      if (id && id !== 'new') {
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .match({ id: id, user_id: user.id })
          .single()

        if (txError) {
          console.error('Erro Supabase:', txError)
          showToast('Erro ao buscar transação.', 'error')
        } else if (txData) {
          setTx(txData)
          setTxType(txData.type)
          setIsPaid(txData.status === 'done')
          setDate(txData.date)
          setDescription(txData.description || '')
          setCategoryId(txData.category_id || '')
          setAccountId(txData.account_id || '')
          setSelectedTags(Array.isArray(txData.tag_ids) ? txData.tag_ids : [])
          setNotes(txData.notes || '')

          const amountSafe = Number(txData.amount) || 0
          setAmountInput(amountSafe.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

          if (txData.receipt_url) {
            setReceiptUrl(txData.receipt_url)
            setReceiptName('Comprovante existente')
            setReceiptPreview(txData.receipt_url)
          }

          if (txData.financing_id) {
            setFinancingId(txData.financing_id)
            setIsFinancing(true)
          }
          if (txData.debt_id) {
            setDebtId(txData.debt_id)
            setIsLoan(true)
          }
          if (txData.notes && txData.notes.includes('[Devolução/Estorno]')) {
            setIsRefund(true)
          }
        }
      }
    } catch (err) {
      console.error('Erro inesperado no loadData:', err)
    } finally {
      setLoading(false)
    }
  }, [id, searchParams, user, txType])

  useEffect(() => { loadData() }, [loadData])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    const num = Number(rawValue) / 100
    setAmountInput(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  const toggleTag = (id: string) => {
    setSelectedTags(prev => {
      if (prev.includes(id)) return prev.filter(t => t !== id)
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }

  const handleSave = async () => {
    if (!user?.id) {
      showToast('Sessão expirada.', 'error')
      return
    }
    setSaving(true)

    const rawAmount = parseFloat(amountInput.replace(/\./g, '').replace(',', '.'))
    if (isNaN(rawAmount) || rawAmount <= 0) {
      showToast('Informe um valor válido.', 'warning')
      setSaving(false)
      return
    }

    let finalNotes = notes
    if (txType === 'expense') {
      const flags = []
      if (isRefund) flags.push('[Devolução/Estorno]')
      if (financingId) flags.push('[Financiamento]')
      if (debtId) flags.push('[Empréstimo]')
      if (flags.length > 0) finalNotes = `${flags.join(' ')} ${notes}`.trim()
    }

    const payload: any = {
      user_id: user.id,
      amount: rawAmount,
      status: isPaid ? 'done' : 'pending',
      date,
      description: description || null,
      category_id: categoryId || null,
      account_id: accountId || null,
      tag_ids: selectedTags.length > 0 ? selectedTags : null,
      notes: finalNotes || null,
      type: txType,
      receipt_url: receiptUrl,
      financing_id: financingId,
      debt_id: debtId,
    }

    try {
      if (!isNew && tx && tx.status === 'done' && tx.account_id) {
        const { data: oldAccData, error: oldAccError } = await supabase
          .from('accounts')
          .select('balance')
          .match({ id: tx.account_id, user_id: user.id })
          .single()

        if (oldAccError) throw oldAccError
        const oldBalance = Number(oldAccData.balance) || 0
        const oldAmount = Number(tx.amount)
        const revertedBalance = tx.type === 'income' ? oldBalance - oldAmount : oldBalance + oldAmount

        await supabase.from('accounts').update({ balance: revertedBalance }).match({ id: tx.account_id, user_id: user.id })
      }

      if (isPaid && accountId) {
        const { data: newAccData, error: newAccError } = await supabase
          .from('accounts')
          .select('balance')
          .match({ id: accountId, user_id: user.id })
          .single()

        if (newAccError) throw newAccError
        const currentBalance = Number(newAccData.balance) || 0
        const updatedBalance = txType === 'income' ? currentBalance + rawAmount : currentBalance - rawAmount

        await supabase.from('accounts').update({ balance: updatedBalance }).match({ id: accountId, user_id: user.id })
      }

      if (isNew) {
        await supabase.from('transactions').insert([payload])
      } else {
        await supabase.from('transactions').update(payload).match({ id: id, user_id: user.id })
      }

      showToast('Transação salva com sucesso!', 'success')
      router.refresh()
      router.back()
    } catch (err: any) {
      console.error('Erro ao salvar:', err)
      showToast('Erro ao salvar transação.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!user?.id) return
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return
    setSaving(true)

    if (tx && tx.status === 'done' && tx.account_id) {
      const { data: accData } = await supabase.from('accounts').select('balance').match({ id: tx.account_id, user_id: user.id }).single()
      if (accData) {
        const oldAmount = Number(tx.amount)
        const currentBalance = Number(accData.balance) || 0
        const newBalance = tx.type === 'income' ? currentBalance - oldAmount : currentBalance + oldAmount
        await supabase.from('accounts').update({ balance: newBalance }).match({ id: tx.account_id, user_id: user.id })
      }
    }
    await supabase.from('transactions').delete().match({ id: id, user_id: user.id })
    showToast('Transação excluída.', 'info')
    router.refresh()
    router.back()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
        <Loader2 className="animate-spin text-teal-700" size={40} />
      </div>
    )
  }

  const isIncome = txType === 'income'
  const typeLabel = isIncome ? 'receita' : 'despesa'
  const colorClass = isIncome ? 'text-emerald-600' : 'text-gray-800 dark:text-gray-200'
  const toggleBgClass = isPaid ? (isIncome ? 'bg-emerald-600' : 'bg-teal-700') : 'bg-gray-300 dark:bg-gray-600'

  const selectedCat = categories.find(c => c.id === categoryId) || 
    Object.values(subcategories).flat().find((s: any) => s.id === categoryId)
  const selectedAcc = accounts.find(a => a.id === accountId)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      <div className="flex justify-between items-center p-4">
        <button onClick={() => router.back()} className="text-gray-800 dark:text-gray-200 p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-bold text-[16px] text-gray-800 dark:text-gray-100 capitalize">{isNew ? `Nova ${typeLabel}` : `Editar ${typeLabel}`}</h1>
        <div className="flex items-center gap-4 text-teal-700 dark:text-teal-400">
          {!isNew && <button><Copy size={20} /></button>}
          {!isNew && <button onClick={handleDelete} className="text-red-500"><Trash2 size={20} /></button>}
        </div>
      </div>

      <div className="px-6 py-4 mb-4">
        <p className="text-gray-500 dark:text-gray-400 text-[13px] font-medium mb-2 capitalize">Valor da {typeLabel}</p>
        <div className="flex items-center gap-2">
          <span className="text-3xl text-gray-400 dark:text-gray-500 font-light">R$</span>
          <input
            type="text"
            inputMode="numeric"
            value={amountInput}
            onChange={handleAmountChange}
            className={`text-4xl font-light bg-transparent outline-none w-full ${colorClass}`}
            placeholder="0,00"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-t-[32px] px-6 py-6 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] dark:shadow-none space-y-6 transition-colors duration-300">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-5">
          <div className="flex items-center gap-4">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${isPaid ? 'bg-gray-800 dark:bg-gray-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <Check size={14} />
            </div>
            <span className="font-bold text-[15px] text-gray-800 dark:text-gray-200">{isIncome ? 'Recebido' : 'Pago'}</span>
          </div>
          <button onClick={() => setIsPaid(!isPaid)} className={`w-12 h-7 rounded-full relative transition-colors duration-300 ${toggleBgClass}`}>
            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${isPaid ? 'right-1' : 'left-1'}`} />
          </button>
        </div>

        {uploading ? (
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700/30 rounded-xl p-3">
            <Loader2 size={20} className="animate-spin text-teal-700" />
            <span className="text-sm text-gray-500">Enviando comprovante...</span>
          </div>
        ) : receiptUrl ? (
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700/30 rounded-xl p-3">
            {receiptPreview ? (
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-200 dark:bg-slate-600 flex-shrink-0">
                <img src={receiptPreview} alt="Comprovante" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                <FileImage size={22} className="text-teal-600 dark:text-teal-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">
                {receiptName || 'Comprovante'}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                Comprovante anexado
              </p>
            </div>
            <button onClick={handleRemoveReceipt} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowReceiptModal(true)}
            className="w-full flex items-center gap-3 py-2 text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          >
            {/* Ícone atualizado para Paperclip */}
            <Paperclip size={20} />
            <span className="text-sm font-medium">Anexar comprovante</span>
          </button>
        )}

        <div className="flex items-center gap-4 border-b border-gray-100 dark:border-slate-700 pb-5 relative">
          <Calendar size={22} className="text-gray-400 dark:text-gray-500" />
          <input
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            className="flex-1 text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none bg-transparent"
          />
        </div>

        <div className="flex items-center gap-4 border-b border-gray-100 dark:border-slate-700 pb-5">
          <Edit3 size={22} className="text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição"
            className="flex-1 text-[15px] text-gray-800 dark:text-gray-200 outline-none bg-transparent placeholder:text-gray-300 dark:placeholder-gray-500"
          />
        </div>

        <button onClick={() => setShowCatModal(true)} className="w-full flex items-center gap-4 border-b border-gray-100 dark:border-slate-700 pb-5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors rounded-lg">
          <Tag size={22} className="text-gray-400 dark:text-gray-500" />
          <div className="flex-1 flex flex-col text-left">
            <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Categoria</span>
            <span className="text-[14px] text-gray-500 dark:text-gray-400 mt-0.5">{selectedCat ? selectedCat.name : 'Selecione...'}</span>
          </div>
          <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
        </button>

        <button onClick={() => setShowAccModal(true)} className="w-full flex items-center gap-4 border-b border-gray-100 dark:border-slate-700 pb-5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors rounded-lg">
          <Wallet size={22} className="text-gray-400 dark:text-gray-500" />
          <div className="flex-1 flex flex-col text-left">
            <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Conta</span>
            <span className="text-[14px] text-gray-500 dark:text-gray-400 mt-0.5">{selectedAcc ? selectedAcc.name : 'Selecione...'}</span>
          </div>
          <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
        </button>

        <div className="flex justify-center pt-2 pb-2">
          <button onClick={() => setShowDetails(!showDetails)} className="text-[14px] font-bold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors">
            {showDetails ? 'Ocultar detalhes' : 'Mais detalhes'}
          </button>
        </div>

        {showDetails && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-4 border-b border-gray-100 dark:border-slate-700 pb-5">
              <RefreshCw size={22} className="text-gray-400 dark:text-gray-500" />
              <div className="flex-1 flex flex-col gap-3">
                <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Repetição</span>
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                  <button className="px-4 py-1.5 rounded-full border border-teal-700 dark:border-teal-500 text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 text-[13px] font-medium whitespace-nowrap">Única</button>
                  <button className="px-4 py-1.5 rounded-full bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 text-[13px] font-medium whitespace-nowrap">Parcelar</button>
                  <button className="px-4 py-1.5 rounded-full bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 text-[13px] font-medium whitespace-nowrap">Recorrente</button>
                </div>
              </div>
            </div>

            {!isIncome && (
              <>
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-5">
                  <div className="flex items-center gap-4">
                    <ArrowRightLeft size={22} className="text-gray-400 dark:text-gray-500" />
                    <div className="flex flex-col">
                      <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">É uma devolução / estorno</span>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">Abate o gasto da categoria no relatório</span>
                    </div>
                  </div>
                  <button onClick={() => setIsRefund(!isRefund)} className={`w-11 h-6 rounded-full relative transition-colors ${isRefund ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isRefund ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-5 cursor-pointer" onClick={() => setShowFinancingModal(true)}>
                  <div className="flex items-center gap-4">
                    <Building size={22} className="text-gray-400 dark:text-gray-500" />
                    <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Financiamento</span>
                  </div>
                  <button className={`w-11 h-6 rounded-full relative transition-colors ${financingId ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${financingId ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-5 cursor-pointer" onClick={() => setShowLoanModal(true)}>
                  <div className="flex items-center gap-4">
                    <HandCoins size={22} className="text-gray-400 dark:text-gray-500" />
                    <div className="flex flex-col">
                      <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Empréstimo a alguém</span>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">Vira saldo a receber em "Quem me deve"</span>
                    </div>
                  </div>
                  <button className={`w-11 h-6 rounded-full relative transition-colors ${debtId ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${debtId ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              </>
            )}

            <div className="flex items-center gap-4 border-b border-gray-100 dark:border-slate-700 pb-5">
              <Edit3 size={22} className="text-gray-400 dark:text-gray-500 opacity-50" />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações"
                className="flex-1 text-[14px] text-gray-800 dark:text-gray-200 outline-none bg-transparent placeholder:text-gray-300 dark:placeholder-gray-500"
              />
            </div>

            <button onClick={() => setShowTagModal(true)} className="w-full flex items-center gap-4 pb-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors rounded-lg">
              <Tag size={22} className="text-gray-400 dark:text-gray-500 opacity-50" />
              <div className="flex-1 flex flex-col text-left">
                <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">Tags</span>
                <span className="text-[14px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {selectedTags.length > 0 ? `${selectedTags.length} tag(ns) selecionada(s)` : 'Nenhuma tag'}
                </span>
              </div>
              <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
            </button>
          </div>
        )}
      </div>

      {showCatModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCatModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Categorias</h3>
              <button onClick={() => { setShowCatModal(false); router.push('/categories'); }} className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 p-2 rounded-full"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {categories.map(cat => {
                const IconComp = getDynamicIcon(cat.icon)
                const subCount = subcategories[cat.id]?.length || 0
                const isActive = cat.id === categoryId
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCategoryId(cat.id)
                      setSelectedParentCat(cat)
                      if (subCount > 0) {
                        setShowSubCatModal(true)
                      } else {
                        setShowCatModal(false)
                      }
                    }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                      <IconComp size={20} />
                    </div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{cat.name}</span>
                    {subCount > 0 && <span className="text-xs text-gray-400 dark:text-gray-500 font-medium mr-2">{subCount}</span>}
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                    {subCount > 0 && <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />}
                  </button>
                )
              })}
              {categories.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 mt-10">Nenhuma categoria encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      {showSubCatModal && selectedParentCat && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50" onClick={() => setShowSubCatModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <button onClick={() => setShowSubCatModal(false)} className="p-1 -ml-2"><ChevronLeft size={22} className="text-gray-700 dark:text-gray-300" /></button>
              <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Subcategorias</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedParentCat.name}</p>
              </div>
            </div>
            <div className="space-y-2">
              {(subcategories[selectedParentCat.id] || []).map((sub: any) => {
                const SubIconComp = getDynamicIcon(sub.icon)
                const isActive = sub.id === categoryId
                return (
                  <button key={sub.id} onClick={() => { setCategoryId(sub.id); setShowSubCatModal(false); setShowCatModal(false) }} className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${sub.color}20`, color: sub.color }}><SubIconComp size={20} /></div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{sub.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              <button onClick={() => { setShowSubCatModal(false); setShowCatModal(false) }} className="w-full p-3 flex items-center justify-center gap-2 rounded-2xl bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors text-gray-500 dark:text-gray-400 font-medium">Usar "{selectedParentCat.name}" sem subcategoria</button>
            </div>
          </div>
        </div>
      )}

      {showAccModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowAccModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Contas</h3>
              <button onClick={() => { setShowAccModal(false); router.push('/accounts'); }} className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 p-2 rounded-full"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {accounts.map(acc => {
                const isActive = acc.id === accountId
                return (
                  <button key={acc.id} onClick={() => { setAccountId(acc.id); setShowAccModal(false) }} className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: acc.color }}>{acc.name.substring(0, 2).toUpperCase()}</div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{acc.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              {accounts.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 mt-10">Nenhuma conta encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      {showTagModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowTagModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Tags</h3>
              <button onClick={() => { setShowTagModal(false); router.push('/tags'); }} className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 p-2 rounded-full"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {tags.map(tag => {
                const isActive = selectedTags.includes(tag.id);
                return (
                  <button key={tag.id} onClick={() => toggleTag(tag.id)} className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{tag.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                );
              })}
              {tags.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 mt-10">Nenhuma tag encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      <ReceiptModal isOpen={showReceiptModal} onClose={() => setShowReceiptModal(false)} onOptionSelect={handleReceiptOption} />
      <CameraCapture isOpen={showCamera} onClose={() => setShowCamera(false)} onCapture={handleCameraCapture} />
      
      <ModalFinancing isOpen={showFinancingModal} onClose={() => setShowFinancingModal(false)} onSave={(id) => { setFinancingId(id); setIsFinancing(true); }} />
      <ModalEmprestimo isOpen={showLoanModal} onClose={() => setShowLoanModal(false)} onSave={(id) => { setDebtId(id); setIsLoan(true); }} />

      <div className="fixed bottom-6 left-0 w-full flex justify-center pointer-events-none z-50">
        <button onClick={handleSave} disabled={saving} className="w-14 h-14 bg-teal-700 rounded-full flex items-center justify-center text-white shadow-xl pointer-events-auto hover:bg-teal-800 transition-colors">
          {saving ? <Loader2 className="animate-spin" size={24} /> : <Check size={28} />}
        </button>
      </div>
    </div>
  )
}
