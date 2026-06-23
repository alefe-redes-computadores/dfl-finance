'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { X, ArrowRight, Loader2, Calendar, FileText } from 'lucide-react'
import { format } from 'date-fns'

export default function TransferModal({ isOpen, onClose, initialFromAccountId = null, onComplete = () => {} }: any) {
  const [step, setStep] = useState(1)
  const [accounts, setAccounts] = useState<any[]>([])
  
  const [fromAccount, setFromAccount] = useState<any>(null)
  const [toAccount, setToAccount] = useState<any>(null)
  
  const [amountInput, setAmountInput] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  // Reseta e carrega as contas sempre que o modal abre
  useEffect(() => {
    if (isOpen) {
      setStep(initialFromAccountId ? 2 : 1)
      setFromAccount(null)
      setToAccount(null)
      setAmountInput('')
      setDescription('')
      setDate(format(new Date(), 'yyyy-MM-dd'))
      setLoading(true)

      supabase.from('accounts').select('*').order('name').then(({ data }) => {
        const accs = data || []
        setAccounts(accs)
        
        if (initialFromAccountId) {
          const initialAcc = accs.find(a => a.id === initialFromAccountId)
          if (initialAcc) setFromAccount(initialAcc)
        }
        setLoading(false)
      })
    }
  }, [isOpen, initialFromAccountId])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    const num = Number(rawValue) / 100
    setAmountInput(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  const handleTransfer = async () => {
    if (!fromAccount || !toAccount || !amountInput) return
    setLoading(true)
    
    const rawAmount = parseFloat(amountInput.replace(/\./g, '').replace(',', '.')) || 0
    if (rawAmount <= 0) {
      alert("O valor da transferência deve ser maior que zero.")
      setLoading(false)
      return
    }

    // 🚨 NOVA TRAVA DE SEGURANÇA: Impede transferência se a conta não tiver cheque especial
    if (!fromAccount.allow_negative && (Number(fromAccount.balance) - rawAmount < 0)) {
      alert(`A conta ${fromAccount.name} não permite saldo negativo. Seu saldo atual é R$ ${Number(fromAccount.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`)
      setLoading(false)
      return
    }

    try {
      // 1. Atualiza o saldo da conta de ORIGEM (subtrai)
      await supabase.from('accounts').update({ 
        balance: Number(fromAccount.balance) - rawAmount 
      }).eq('id', fromAccount.id)

      // 2. Atualiza o saldo da conta de DESTINO (soma)
      await supabase.from('accounts').update({ 
        balance: Number(toAccount.balance) + rawAmount 
      }).eq('id', toAccount.id)

      // 3. Registra a saída no extrato da ORIGEM
      await supabase.from('transactions').insert({
        account_id: fromAccount.id,
        user_id: fromAccount.user_id,
        context: fromAccount.context,
        type: 'transfer',
        amount: rawAmount,
        status: 'done',
        date: date,
        description: description || `Transferência para ${toAccount.name}`
      })

      // 4. Registra a entrada no extrato do DESTINO
      await supabase.from('transactions').insert({
        account_id: toAccount.id,
        user_id: toAccount.user_id,
        context: toAccount.context,
        type: 'transfer',
        amount: rawAmount,
        status: 'done',
        date: date,
        description: description || `Transferência de ${fromAccount.name}`
      })

      onComplete()
      onClose()
    } catch (err) {
      console.error("Erro na transferência:", err)
      alert("Ocorreu um erro ao processar a transferência.")
    } finally {
      setLoading(false)
    }
  }

  const getBalanceStyle = (balance: number) => {
    if (balance > 0) return 'text-emerald-600'
    if (balance < 0) return 'text-red-600'
    return 'text-gray-400'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-[#f4f6f8] w-full max-w-md rounded-t-[32px] sm:rounded-[24px] p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
        
        <div className="flex justify-between items-center mb-6">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
          <h2 className="font-bold text-lg text-gray-800">
            {step === 1 ? 'Conta de Origem' : step === 2 ? 'Conta de Destino' : 'Detalhes'}
          </h2>
          <div className="w-6" /> {/* Espaçador para centralizar título */}
        </div>

        {loading && step < 3 ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-teal-700" size={32} /></div>
        ) : step === 1 ? (
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">De onde o dinheiro vai sair?</p>
            {accounts.map(acc => (
              <button key={acc.id} onClick={() => { setFromAccount(acc); setStep(2) }} 
                className="w-full p-4 bg-white rounded-[20px] shadow-sm flex justify-between items-center hover:bg-gray-50 transition-colors border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-[14px] flex items-center justify-center font-bold text-white shadow-sm" style={{ backgroundColor: acc.color || '#64748b' }}>
                    {acc.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-800 text-[15px]">{acc.name}</p>
                    <p className="text-[11px] text-gray-400 font-bold uppercase mt-0.5">{acc.context === 'dfl' ? 'Empresa' : 'Pessoal'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-[14px] ${getBalanceStyle(Number(acc.balance))}`}>
                    R$ {Number(acc.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : step === 2 ? (
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Para onde o dinheiro vai?</p>
            {accounts.filter(a => a.id !== fromAccount?.id).length === 0 && (
               <p className="text-center text-sm text-gray-400 py-4">Nenhuma outra conta cadastrada.</p>
            )}
            {accounts.filter(a => a.id !== fromAccount?.id).map(acc => (
              <button key={acc.id} onClick={() => { setToAccount(acc); setStep(3) }} 
                className="w-full p-4 bg-white rounded-[20px] shadow-sm flex justify-between items-center hover:bg-gray-50 transition-colors border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-[14px] flex items-center justify-center font-bold text-white shadow-sm" style={{ backgroundColor: acc.color || '#64748b' }}>
                    {acc.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-800 text-[15px]">{acc.name}</p>
                    <p className="text-[11px] text-gray-400 font-bold uppercase mt-0.5">{acc.context === 'dfl' ? 'Empresa' : 'Pessoal'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-[14px] ${getBalanceStyle(Number(acc.balance))}`}>
                    R$ {Number(acc.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Resumo visual da rota do dinheiro */}
            <div className="bg-white p-4 rounded-[20px] flex items-center justify-between text-sm shadow-sm border border-gray-100">
              <div className="text-center flex-1">
                 <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Origem</p>
                 <span className="font-bold text-gray-800 bg-gray-100 px-3 py-1.5 rounded-full">{fromAccount?.name}</span>
              </div>
              <div className="w-8 flex justify-center"><ArrowRight size={20} className="text-teal-600" /></div>
              <div className="text-center flex-1">
                 <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Destino</p>
                 <span className="font-bold text-gray-800 bg-gray-100 px-3 py-1.5 rounded-full">{toAccount?.name}</span>
              </div>
            </div>
            
            <div className="text-center px-4 pt-2">
              <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">Valor da Transferência</p>
              <div className="flex justify-center items-center gap-2">
                <span className="text-3xl text-gray-400 font-light">R$</span>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={amountInput} 
                  onChange={handleAmountChange} 
                  placeholder="0,00" 
                  className="w-full text-center text-4xl font-light outline-none text-gray-800 bg-transparent" 
                />
              </div>
            </div>
            
            <div className="space-y-3 bg-white p-4 rounded-[20px] shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-50">
                <Calendar size={22} className="text-gray-400"/>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent w-full outline-none text-[15px] font-bold text-gray-800" />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <FileText size={22} className="text-gray-400"/>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (Opcional)" className="bg-transparent w-full outline-none text-[14px] text-gray-800 placeholder:text-gray-300" />
              </div>
            </div>

            <button onClick={handleTransfer} disabled={loading} className="w-full bg-teal-700 hover:bg-teal-800 text-white py-4 rounded-[20px] font-bold flex justify-center items-center transition-colors shadow-lg shadow-teal-700/20 mt-4">
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'Confirmar Transferência'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
