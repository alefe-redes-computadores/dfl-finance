'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { X, ArrowRight, Loader2 } from 'lucide-react'

export default function TransferModal({ isOpen, onClose, initialFromId, onComplete }: any) {
  const [step, setStep] = useState(1)
  const [accounts, setAccounts] = useState<any[]>([])
  const [fromAccount, setFromAccount] = useState<any>(null)
  const [toAccount, setToAccount] = useState<any>(null)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setFromAccount(initialFromId ? { id: initialFromId } : null)
      supabase.from('accounts').select('*').then(({ data }) => setAccounts(data || []))
    }
  }, [isOpen, initialFromId])

  const handleTransfer = async () => {
    setLoading(true)
    // Lógica de registro no Supabase
    const { error } = await supabase.from('transactions').insert({
      account_id: fromAccount.id,
      to_account_id: toAccount.id,
      amount: parseFloat(amount),
      type: 'transfer',
      status: 'done',
      date: new Date().toISOString()
    })
    if (!error) onComplete()
    setLoading(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex justify-between mb-6">
          <h2 className="font-bold text-xl">{step === 1 ? 'Conta de origem' : step === 2 ? 'Conta de destino' : 'Detalhes'}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {step === 1 && (
          <div className="space-y-2">
            {accounts.map(acc => (
              <button key={acc.id} onClick={() => { setFromAccount(acc); setStep(2) }} className="w-full p-4 bg-gray-50 rounded-xl text-left font-bold">{acc.name}</button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            {accounts.filter(a => a.id !== fromAccount.id).map(acc => (
              <button key={acc.id} onClick={() => { setToAccount(acc); setStep(3) }} className="w-full p-4 bg-gray-50 rounded-xl text-left font-bold">{acc.name}</button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="R$ 0,00" className="w-full p-4 bg-gray-50 rounded-xl font-bold text-lg" />
            <button onClick={handleTransfer} className="w-full bg-teal-700 text-white py-4 rounded-xl font-bold flex justify-center">
              {loading ? <Loader2 className="animate-spin" /> : 'Transferir'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
