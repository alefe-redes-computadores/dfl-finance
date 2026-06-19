'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Calendar, Tag, Wallet, Paperclip, ChevronDown, ChevronUp, Check } from 'lucide-react'

type TxType = 'income' | 'expense' | 'sangria' | 'transfer'
type Context = 'dfl' | 'personal'

export default function NewTransactionPage() {
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
  const [toAccountId, setToAccountId] = useState('')
  
  const [showDetails, setShowDetails] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])

  const loadData = useCallback(async () => {
    if (!user?.id) return
    
    const catType = type === 'income' ? 'income' : 'expense'
    
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
      .eq('type', catType)
    
    const { data: accs } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
    
    setCategories(cats ?? [])
    setAccounts(accs ?? [])
  }, [user, context, type])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    let num = Number(val) / 100
    setAmountNum(num)
    setAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
  }

  const handleSave = async () => {
    if (amountNum <= 0) {
      alert('Informe um valor válido maior que zero.')
      return
    }
    if (!accountId) {
      alert('Selecione uma conta.')
      return
    }
    
    setSaving(true)

    try {
      if (type === 'transfer') {
        if (!toAccountId) {
          alert('Selecione a conta de destino.')
          setSaving(false)
          return
        }
        // Saída da origem
        await supabase.from('transactions').insert({ user_id: user!.id, type: 'expense', amount: amountNum, description: desc || 'Transf. enviada', account_id: accountId, date, status: isPaid ? 'done' : 'pending', context })
        // Entrada no destino
        await supabase.from('transactions').insert({ user_id: user!.id, type: 'income', amount: amountNum, description: desc || 'Transf. recebida', account_id: toAccountId, date, status: isPaid ? 'done' : 'pending', context })
      } else {
        await supabase.from('transactions').insert({ user_id: user!.id, type, amount: amountNum, description: desc, category_id: categoryId || null, account_id: accountId, date, status: isPaid ? 'done' : 'pending', context })
      }
      
      router.push('/transactions')
    } catch (e) {
      console.error(e)
      alert('Erro ao salvar no banco de dados.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans text-gray-800 pb-20">
      <div className="flex items-center p-4">
        <button onClick={() => router.back()}><ChevronLeft size={24} /></button>
        <h1 className="flex-1 text-center font-bold text-lg">Nova {type === 'income' ? 'Receita' : 'Despesa'}</h1>
      </div>

      <div className="p-8 text-center">
        <p className="text-gray-400 text-sm mb-1">Valor</p>
        <div className="flex justify-center items-baseline">
            <span className="text-2xl font-medium text-gray-400 mr-1">R$</span>
            <input 
                type="text" 
                value={amount} 
                onChange={handleAmount}
                className="w-40 text-4xl font-bold outline-none text-teal-800"
            />
        </div>
      </div>

      <div className="px-6 mb-6 flex justify-between items-center bg-gray-50 p-4 rounded-2xl mx-4">
        <span className="font-medium text-gray-600">{type === 'income' ? 'Recebido' : 'Pago'}</span>
        <button onClick={() => setIsPaid(!isPaid)} className={`w-12 h-6 rounded-full transition-colors ${isPaid ? 'bg-teal-700' : 'bg-gray-300'}`}>
            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${isPaid ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <div className="px-4 space-y-1">
        <div className="flex items-center gap-4 p-4 border-b border-gray-100">
            <Calendar size={20} className="text-gray-400" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full outline-none" />
        </div>
        <div className="flex items-center gap-4 p-4 border-b border-gray-100">
            <input placeholder="Descrição" value={desc} onChange={e => setDesc(e.target.value)} className="w-full outline-none" />
        </div>
        <div className="flex items-center gap-4 p-4 border-b border-gray-100">
            <Tag size={20} className="text-gray-400" />
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full outline-none bg-transparent">
                <option value="">Categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
        </div>
        <div className="flex items-center gap-4 p-4 border-b border-gray-100">
            <Wallet size={20} className="text-gray-400" />
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full outline-none bg-transparent">
                <option value="">Conta</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
        </div>
        {type === 'transfer' && (
            <div className="flex items-center gap-4 p-4 border-b border-gray-100">
                <Wallet size={20} className="text-gray-400" />
                <select value={toAccountId} onChange={e => setToAccountId(e.target.value)} className="w-full outline-none bg-transparent">
                    <option value="">Conta Destino</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
            </div>
        )}
      </div>

      <div className="px-4 mt-2">
        <button onClick={() => setShowDetails(!showDetails)} className="text-teal-800 text-sm font-bold p-4 flex items-center gap-1">
            {showDetails ? 'Ocultar detalhes' : 'Mais detalhes'}
            {showDetails ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </button>
        {showDetails && (
            <div className="p-4 bg-gray-50 rounded-xl mx-4 text-sm text-gray-500">
                <div className="flex items-center gap-2"><Paperclip size={16}/> Anexar comprovante</div>
            </div>
        )}
      </div>

      <div className="fixed bottom-8 left-0 right-0 flex justify-center">
        <button onClick={handleSave} disabled={saving} className="w-16 h-16 bg-teal-800 rounded-full flex items-center justify-center shadow-lg text-white">
            {saving ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Check size={32} />}
        </button>
      </div>
    </div>
  )
}
