'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/contexts/ToastContext'
import {
  X, ArrowRightLeft, Wallet, Loader2, Check, ChevronRight, ArrowDown
} from 'lucide-react'
import BankLogo from '@/components/BankLogo'
import { useAccountsList } from '@/hooks/useAccountsList' // ✅ HOOK ESPECÍFICO
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { transferBetweenAccounts } from '@/lib/accountOperations'

interface TransferModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
  context?: 'dfl' | 'personal'
}

export default function TransferModal({ isOpen, onClose, onComplete, context: forcedContext }: TransferModalProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { success: hapticSuccess, error: hapticError, vibrate } = useHapticFeedback()

  const [fromContext, setFromContext] = useState<'dfl' | 'personal'>(forcedContext || 'dfl')
  const [toContext, setToContext] = useState<'dfl' | 'personal'>(forcedContext === 'dfl' ? 'personal' : 'dfl')
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [amountNum, setAmountNum] = useState(0)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [showFromAccs, setShowFromAccs] = useState(false)
  const [showToAccs, setShowToAccs] = useState(false)

  // ✅ HOOK ESPECÍFICO
  const { data: allAccounts, loading: accountsLoading } = useAccountsList()

  const fromAccounts = useMemo(() => {
    return (allAccounts || [])
      .filter((a: any) => a.context === fromContext)
      .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
  }, [allAccounts, fromContext])

  const toAccounts = useMemo(() => {
    return (allAccounts || [])
      .filter((a: any) => a.context === toContext)
      .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
  }, [allAccounts, toContext])

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

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setAmount('')
      setAmountNum(0)
      return
    }
    const num = parseFloat(digits) / 100
    setAmountNum(num)
    setAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  const handleTransfer = async () => {
    if (!user) {
      showToast('⚠️ Usuário não autenticado.', 'warning')
      return
    }

    if (!fromAccountId || !toAccountId || amountNum <= 0) {
      showToast('⚠️ Preencha todos os campos corretamente.', 'warning')
      hapticError()
      return
    }

    if (fromAccountId === toAccountId && fromContext === toContext) {
      showToast('⚠️ As contas de origem e destino devem ser diferentes.', 'warning')
      hapticError()
      return
    }

    setLoading(true)

    try {
      await transferBetweenAccounts({
        userId: user.id,
        fromAccountId,
        toAccountId,
        amount: amountNum,
        description,
      })

      hapticSuccess()
      showToast('✅ Transferência realizada com sucesso!', 'success')
      onComplete?.()
      onClose()
      router.refresh()
    } catch (e: any) {
      hapticError()
      showToast('❌ Erro: ' + (e?.message || 'erro desconhecido'), 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const fromAcc = fromAccounts.find((a: any) => a.id === fromAccountId)
  const toAcc = toAccounts.find((a: any) => a.id === toAccountId)

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
      <div
        className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 z-10 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />

        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-[18px] text-gray-800 dark:text-gray-100">Transferência Rápida</h2>
          <button
            onClick={() => {
              vibrate([10])
              onClose()
            }}
            className="p-2 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-slate-700 rounded-full active:scale-[0.90] transition-transform"
            aria-label="Fechar modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-6">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 block">Conta de Origem</label>
          <div className="flex gap-2 mb-3 bg-gray-50 dark:bg-slate-700 p-1 rounded-full border border-gray-100 dark:border-slate-600">
            {(['dfl', 'personal'] as const).map(c => (
              <button
                key={c}
                onClick={() => {
                  setFromContext(c)
                  setFromAccountId('')
                  vibrate([10])
                }}
                className={`flex-1 py-2.5 rounded-full text-[13px] font-bold transition-all active:scale-[0.98] ${
                  fromContext === c
                    ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {c === 'dfl' ? 'Empresa (DFL)' : 'Pessoal (PF)'}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setShowFromAccs(true)
              vibrate([10])
            }}
            className="w-full bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 p-4 rounded-[20px] flex items-center justify-between active:scale-[0.98] transition-transform shadow-sm"
          >
            <div className="flex items-center gap-3">
              {fromAcc ? (
                <BankLogo color={fromAcc.color} name={fromAcc.name} size="md" />
              ) : (
                <div className="w-10 h-10 bg-gray-100 dark:bg-slate-600 rounded-full flex items-center justify-center">
                  <Wallet size={20} className="text-gray-400" />
                </div>
              )}
              <span className={`font-bold ${fromAcc ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                {fromAcc ? fromAcc.name : 'Selecionar conta de saída'}
              </span>
            </div>
            <ChevronRight size={18} className="text-gray-300 dark:text-gray-500" />
          </button>
        </div>

        <div className="flex justify-center -my-3 relative z-10 pointer-events-none">
          <div className="bg-teal-50 dark:bg-teal-900/40 p-2.5 rounded-full shadow-sm border border-white dark:border-slate-800">
            <ArrowDown size={20} className="text-teal-600 dark:text-teal-400" />
          </div>
        </div>

        <div className="mb-6 mt-2">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 block">Conta de Destino</label>
          <div className="flex gap-2 mb-3 bg-gray-50 dark:bg-slate-700 p-1 rounded-full border border-gray-100 dark:border-slate-600">
            {(['dfl', 'personal'] as const).map(c => (
              <button
                key={c}
                onClick={() => {
                  setToContext(c)
                  setToAccountId('')
                  vibrate([10])
                }}
                className={`flex-1 py-2.5 rounded-full text-[13px] font-bold transition-all active:scale-[0.98] ${
                  toContext === c
                    ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {c === 'dfl' ? 'Empresa (DFL)' : 'Pessoal (PF)'}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setShowToAccs(true)
              vibrate([10])
            }}
            className="w-full bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 p-4 rounded-[20px] flex items-center justify-between active:scale-[0.98] transition-transform shadow-sm"
          >
            <div className="flex items-center gap-3">
              {toAcc ? (
                <BankLogo color={toAcc.color} name={toAcc.name} size="md" />
              ) : (
                <div className="w-10 h-10 bg-gray-100 dark:bg-slate-600 rounded-full flex items-center justify-center">
                  <Wallet size={20} className="text-gray-400" />
                </div>
              )}
              <span className={`font-bold ${toAcc ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                {toAcc ? toAcc.name : 'Selecionar conta de entrada'}
              </span>
            </div>
            <ChevronRight size={18} className="text-gray-300 dark:text-gray-500" />
          </button>
        </div>

        <div className="mb-4">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 block">Valor a transferir</label>
          <div className="bg-gray-50 dark:bg-slate-700 rounded-[20px] p-4 flex items-center gap-2 border border-gray-100 dark:border-slate-600">
            <span className="text-2xl text-gray-400 font-light">R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0,00"
              className="text-3xl font-bold bg-transparent outline-none w-full text-teal-700 dark:text-teal-400"
            />
          </div>
        </div>

        <div className="mb-8">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 block">Descrição (opcional)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ex: Reembolso de jantar"
            className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 p-4 rounded-[20px] text-[15px] font-medium outline-none text-gray-800 dark:text-gray-200 focus:border-teal-500 transition-colors"
          />
        </div>

        <button
          onClick={() => {
            vibrate([10, 50])
            handleTransfer()
          }}
          disabled={loading || !fromAccountId || !toAccountId || amountNum <= 0}
          className="w-full bg-teal-700 hover:bg-teal-800 text-white py-4 rounded-[24px] font-bold disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-teal-700/20"
        >
          {loading ? <Loader2 size={24} className="animate-spin" /> : <><ArrowRightLeft size={20} /> Transferir Agora</>}
        </button>

        {showFromAccs && (
          <div className="fixed inset-0 z-[160] flex items-end justify-center" onClick={() => setShowFromAccs(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-t-[32px] p-6 max-h-[60vh] overflow-y-auto z-10 animate-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-slate-800 py-2">
                <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Conta de Origem</h3>
                <button onClick={() => setShowFromAccs(false)} className="p-2 bg-gray-100 dark:bg-slate-700 rounded-full active:scale-95">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
              <div className="space-y-3">
                {fromAccounts.map((acc: any) => (
                  <button
                    key={acc.id}
                    onClick={() => {
                      setFromAccountId(acc.id)
                      setShowFromAccs(false)
                      vibrate([10])
                    }}
                    className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-colors active:scale-[0.98] ${
                      acc.id === fromAccountId
                        ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'
                    }`}
                  >
                    <BankLogo color={acc.color} name={acc.name} size="md" />
                    <div className="text-left flex-1">
                      <p className="font-bold text-[15px] text-gray-800 dark:text-gray-200">{acc.name}</p>
                      <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                        R$ {Number(acc.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    {acc.id === fromAccountId && <Check size={22} className="text-teal-600 dark:text-teal-400" />}
                  </button>
                ))}

                {fromAccounts.length === 0 && (
                  <p className="text-center py-6 text-gray-400 font-medium">Nenhuma conta cadastrada neste contexto.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {showToAccs && (
          <div className="fixed inset-0 z-[160] flex items-end justify-center" onClick={() => setShowToAccs(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-t-[32px] p-6 max-h-[60vh] overflow-y-auto z-10 animate-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-slate-800 py-2">
                <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Conta de Destino</h3>
                <button onClick={() => setShowToAccs(false)} className="p-2 bg-gray-100 dark:bg-slate-700 rounded-full active:scale-95">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
              <div className="space-y-3">
                {toAccounts.map((acc: any) => (
                  <button
                    key={acc.id}
                    onClick={() => {
                      setToAccountId(acc.id)
                      setShowToAccs(false)
                      vibrate([10])
                    }}
                    className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-colors active:scale-[0.98] ${
                      acc.id === toAccountId
                        ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'
                    }`}
                  >
                    <BankLogo color={acc.color} name={acc.name} size="md" />
                    <div className="text-left flex-1">
                      <p className="font-bold text-[15px] text-gray-800 dark:text-gray-200">{acc.name}</p>
                      <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                        R$ {Number(acc.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    {acc.id === toAccountId && <Check size={22} className="text-teal-600 dark:text-teal-400" />}
                  </button>
                ))}

                {toAccounts.length === 0 && (
                  <p className="text-center py-6 text-gray-400 font-medium">Nenhuma conta cadastrada neste contexto.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}