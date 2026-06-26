'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import {
  X, ArrowRightLeft, Wallet, Loader2, Check, ChevronRight, ArrowDown, Building2, RefreshCw
} from 'lucide-react'
import BankLogo from '@/components/BankLogo'

interface TransferModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
  // Se passado, força um contexto de origem (ex: ao abrir da tela de contas)
  context?: 'dfl' | 'personal'
}

export default function TransferModal({ isOpen, onClose, onComplete, context: forcedContext }: TransferModalProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [fromContext, setFromContext] = useState<'dfl' | 'personal'>(forcedContext || 'dfl')
  const [toContext, setToContext] = useState<'dfl' | 'personal'>(forcedContext === 'dfl' ? 'personal' : 'dfl')
  const [fromAccounts, setFromAccounts] = useState<any[]>([])
  const [toAccounts, setToAccounts] = useState<any[]>([])
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [amountNum, setAmountNum] = useState(0)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [showFromAccs, setShowFromAccs] = useState(false)
  const [showToAccs, setShowToAccs] = useState(false)

  // Reset ao abrir
  useEffect(() => {
    if (isOpen) {
      setFromContext(forcedContext || 'dfl')
      setToContext(forcedContext === 'dfl' ? 'personal' : 'dfl')
      setFromAccountId('')
      setToAccountId('')
      setAmount('')
      setAmountNum(0)
      setDescription('')
    }
  }, [isOpen, forcedContext])

  // Carregar contas do contexto de origem
  useEffect(() => {
    if (!user) return
    supabase
      .from('accounts')
      .select('id, name, color, balance')
      .match({ user_id: user.id, context: fromContext })
      .order('name')
      .then(({ data }) => setFromAccounts(data || []))
  }, [fromContext, user])

  // Carregar contas do contexto de destino
  useEffect(() => {
    if (!user) return
    supabase
      .from('accounts')
      .select('id, name, color, balance')
      .match({ user_id: user.id, context: toContext })
      .order('name')
      .then(({ data }) => setToAccounts(data || []))
  }, [toContext, user])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setAmount('0,00')
      setAmountNum(0)
      return
    }
    const num = parseFloat(digits) / 100
    setAmountNum(num)
    setAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
  }

  const handleTransfer = async () => {
    if (!user || !fromAccountId || !toAccountId || amountNum <= 0) {
      showToast('Preencha todos os campos', 'warning')
      return
    }
    if (fromAccountId === toAccountId && fromContext === toContext) {
      showToast('Escolha contas diferentes', 'warning')
      return
    }
    setLoading(true)

    const fromAcc = fromAccounts.find(a => a.id === fromAccountId)
    const toAcc = toAccounts.find(a => a.id === toAccountId)
    const transferGroup = crypto.randomUUID()

    try {
      // Atualiza saldos
      const { error: err1 } = await supabase
        .from('accounts')
        .update({ balance: Number(fromAcc.balance) - amountNum })
        .eq('id', fromAccountId)
      if (err1) throw err1

      const { error: err2 } = await supabase
        .from('accounts')
        .update({ balance: Number(toAcc.balance) + amountNum })
        .eq('id', toAccountId)
      if (err2) throw err2

      // Cria transações
      const basePayload = {
        user_id: user.id,
        type: 'transfer',
        amount: amountNum,
        status: 'done',
        transfer_group_id: transferGroup,
        date: new Date().toISOString().split('T')[0],
      }

      await supabase.from('transactions').insert([
        {
          ...basePayload,
          account_id: fromAccountId,
          context: fromContext,
          description: description || `Transferência para ${toAcc.name} (${toContext === 'dfl' ? 'DFL' : 'Pessoal'})`,
        },
        {
          ...basePayload,
          account_id: toAccountId,
          context: toContext,
          description: description || `Transferência de ${fromAcc.name} (${fromContext === 'dfl' ? 'DFL' : 'Pessoal'})`,
        },
      ])

      showToast('Transferência realizada!', 'success')
      onComplete?.()
      onClose()
      router.refresh()
    } catch (e: any) {
      showToast('Erro: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const fromAcc = fromAccounts.find(a => a.id === fromAccountId)
  const toAcc = toAccounts.find(a => a.id === toAccountId)

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-2xl animate-slide-up z-10 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mb-6" />
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100">Transferência entre Contextos</h2>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500"><X size={20} /></button>
        </div>

        {/* Origem */}
        <div className="mb-6">
          <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">De</label>
          <div className="flex gap-2 mb-3">
            {(['dfl', 'personal'] as const).map(c => (
              <button
                key={c}
                onClick={() => setFromContext(c)}
                className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${fromContext === c ? 'bg-teal-700 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}
              >{c === 'dfl' ? 'DFL' : 'Pessoal'}</button>
            ))}
          </div>
          <button onClick={() => setShowFromAccs(true)} className="w-full bg-gray-50 dark:bg-slate-700 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              {fromAcc ? <BankLogo color={fromAcc.color} name={fromAcc.name} size="sm" /> : <Wallet size={20} className="text-gray-400" />}
              <span className={fromAcc ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-400'}>
                {fromAcc ? fromAcc.name : 'Selecionar conta'}
              </span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Seta animada */}
        <div className="flex justify-center -my-2">
          <div className="bg-teal-100 dark:bg-teal-900/30 p-2 rounded-full"><ArrowDown size={24} className="text-teal-600 dark:text-teal-400" /></div>
        </div>

        {/* Destino */}
        <div className="mb-6 mt-2">
          <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">Para</label>
          <div className="flex gap-2 mb-3">
            {(['dfl', 'personal'] as const).map(c => (
              <button
                key={c}
                onClick={() => setToContext(c)}
                className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${toContext === c ? 'bg-teal-700 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}
              >{c === 'dfl' ? 'DFL' : 'Pessoal'}</button>
            ))}
          </div>
          <button onClick={() => setShowToAccs(true)} className="w-full bg-gray-50 dark:bg-slate-700 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              {toAcc ? <BankLogo color={toAcc.color} name={toAcc.name} size="sm" /> : <Wallet size={20} className="text-gray-400" />}
              <span className={toAcc ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-400'}>
                {toAcc ? toAcc.name : 'Selecionar conta'}
              </span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Valor */}
        <div className="mb-4">
          <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">Valor</label>
          <div className="bg-gray-50 dark:bg-slate-700 rounded-2xl p-4 flex items-center gap-2">
            <span className="text-xl text-gray-400 font-light">R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0,00"
              className="text-2xl font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>

        {/* Descrição */}
        <div className="mb-6">
          <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">Descrição (opcional)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ex: Reembolso"
            className="w-full bg-gray-50 dark:bg-slate-700 p-4 rounded-xl text-sm outline-none text-gray-800 dark:text-gray-200"
          />
        </div>

        <button
          onClick={handleTransfer}
          disabled={loading || !fromAccountId || !toAccountId || amountNum <= 0}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-2xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={22} className="animate-spin" /> : <><ArrowRightLeft size={20} /> Transferir</>}
        </button>

        {/* Modais de seleção de conta */}
        {showFromAccs && (
          <div className="fixed inset-0 z-[160] flex items-end justify-center" onClick={() => setShowFromAccs(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-t-[32px] p-5 max-h-[60vh] overflow-y-auto z-10" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-100">Conta de Origem</h3>
              {fromAccounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => { setFromAccountId(acc.id); setShowFromAccs(false) }}
                  className={`w-full p-3 flex items-center gap-3 rounded-xl ${acc.id === fromAccountId ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                >
                  <BankLogo color={acc.color} name={acc.name} size="md" />
                  <div className="text-left flex-1">
                    <p className="font-medium text-gray-800 dark:text-gray-200">{acc.name}</p>
                    <p className="text-xs text-gray-400">R$ {Number(acc.balance || 0).toFixed(2)}</p>
                  </div>
                  {acc.id === fromAccountId && <Check size={20} className="text-teal-600" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {showToAccs && (
          <div className="fixed inset-0 z-[160] flex items-end justify-center" onClick={() => setShowToAccs(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-t-[32px] p-5 max-h-[60vh] overflow-y-auto z-10" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-100">Conta de Destino</h3>
              {toAccounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => { setToAccountId(acc.id); setShowToAccs(false) }}
                  className={`w-full p-3 flex items-center gap-3 rounded-xl ${acc.id === toAccountId ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                >
                  <BankLogo color={acc.color} name={acc.name} size="md" />
                  <div className="text-left flex-1">
                    <p className="font-medium text-gray-800 dark:text-gray-200">{acc.name}</p>
                    <p className="text-xs text-gray-400">R$ {Number(acc.balance || 0).toFixed(2)}</p>
                  </div>
                  {acc.id === toAccountId && <Check size={20} className="text-teal-600" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}