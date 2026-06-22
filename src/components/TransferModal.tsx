'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { X, ArrowRight, Loader2, Calendar, FileText } from 'lucide-react'

export default function TransferModal({ isOpen, onClose, fromAccountId, onComplete }: any) {
  const [step, setStep] = useState(1)
  const [accounts, setAccounts] = useState<any[]>([])
  const [fromAccount, setFromAccount] = useState<any>(null)
  const [toAccount, setToAccount] = useState<any>(null)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      supabase.from('accounts').select('*').then(({ data }) => {
        const accs = data || []
        setAccounts(accs)
        setFromAccount(accs.find(a => a.id === fromAccountId))
      })
    }
  }, [isOpen, fromAccountId])

  const handleTransfer = async () => {
    if (!toAccount || !amount) return
    setLoading(true)
    
    // Insere a transferência no banco
    const { error } = await supabase.from('transactions').insert({
      account_id: fromAccountId,
      to_account_id: toAccount.id,
      amount: parseFloat(amount.replace(',', '.')),
      type: 'transfer',
      status: 'done',
      date: date,
      description: description || `Transferência para ${toAccount.name}`
    })

    if (!error) {
      onComplete()
      onClose()
    }
    setLoading(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <button onClick={onClose}><X size={24} /></button>
          <h2 className="font-bold text-lg">{step === 1 ? 'Conta de destino' : 'Detalhes'}</h2>
          <div className="w-6" />
        </div>

        {step === 1 ? (
          <div className="space-y-2">
            {accounts.filter(a => a.id !== fromAccountId).map(acc => (
              <button key={acc.id} onClick={() => { setToAccount(acc); setStep(2) }} 
                className="w-full p-4 bg-gray-50 rounded-2xl flex justify-between items-center hover:bg-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center font-bold">🏢</div>
                  <div className="text-left"><p className="font-bold">{acc.name}</p></div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-700">R$ {Number(acc.balance).toFixed(2)}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between text-sm font-bold">
              <span>{fromAccount?.name}</span>
              <ArrowRight size={16} className="text-gray-400" />
              <span>{toAccount?.name}</span>
            </div>
            
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} 
              placeholder="R$ 0,00" className="w-full text-center text-4xl font-bold outline-none" />
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Calendar size={20} className="text-gray-500"/>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent w-full outline-none text-sm" />
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <FileText size={20} className="text-gray-500"/>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" className="bg-transparent w-full outline-none text-sm" />
              </div>
            </div>

            <button onClick={handleTransfer} className="w-full bg-teal-700 text-white py-4 rounded-2xl font-bold">
              {loading ? <Loader2 className="animate-spin" /> : 'Transferir'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
