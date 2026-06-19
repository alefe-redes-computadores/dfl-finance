'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Calendar, Tag, Wallet, ChevronDown, Check, Plus, Paperclip } from 'lucide-react'

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
  
  const [showDetails, setShowDetails] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])

  const themeColor = type === 'income' ? 'text-emerald-700' : 'text-red-600'
  const bgColor = type === 'income' ? 'bg-emerald-700' : 'bg-red-600'

  const loadData = useCallback(async () => {
    if (!user?.id) return
    const catType = type === 'income' ? 'income' : 'expense'
    const { data: cats } = await supabase.from('categories').select('*').eq('user_id', user.id).eq('context', context).eq('type', catType)
    const { data: accs } = await supabase.from('accounts').select('*').eq('user_id', user.id).eq('context', context)
    setCategories(cats ?? [])
    setAccounts(accs ?? [])
  }, [user, context, type])

  useEffect(() => { loadData() }, [loadData])

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    let num = Number(val) / 100
    setAmountNum(num)
    setAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
  }

  const handleSave = async () => {
    if (amountNum <= 0) { alert('Informe um valor.'); return }
    if (!accountId) { alert('Selecione uma conta.'); return }
    
    setSaving(true)
    try {
      await supabase.from('transactions').insert({ 
        user_id: user!.id, type, amount: amountNum, description: desc, 
        category_id: categoryId || null, account_id: accountId, date, 
        status: isPaid ? 'done' : 'pending', context 
      })
      router.push('/transactions')
    } catch (e) {
      console.error(e)
      alert('Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans text-gray-800 pb-32">
      {/* Header Limpo */}
      <div className="flex items-center p-4">
        <button onClick={() => router.back()}><ChevronLeft size={24} /></button>
        <h1 className="flex-1 text-center font-bold text-lg capitalize">Nova {type === 'income' ? 'Receita' : 'Despesa'}</h1>
      </div>

      {/* Valor em destaque */}
      <div className="py-6 text-center">
        <p className="text-gray-400 text-sm mb-1">Valor</p>
        <div className="flex justify-center items-center">
            <span className="text-2xl font-medium text-gray-400 mr-1">R$</span>
            <input 
                type="text" 
                value={amount} 
                onChange={handleAmount}
                className={`w-40 text-4xl font-bold outline-none ${themeColor} placeholder-gray-200`}
                placeholder="0,00"
            />
        </div>
      </div>

      {/* Switch de Pagamento */}
      <div className="mx-6 p-4 flex items-center justify-between border-b border-gray-100">
        <span className="font-medium text-gray-700">{type === 'income' ? 'Recebido' : 'Pago'}</span>
        <button onClick={() => setIsPaid(!isPaid)} className={`w-12 h-6 rounded-full transition-colors ${isPaid ? bgColor : 'bg-gray-300'}`}>
            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${isPaid ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Lista de Seleção (Sem caixas feias) */}
      <div className="px-6 space-y-6 pt-4">
        <div className="flex items-center gap-4 border-b border-gray-100 pb-2">
            <Calendar size={20} className="text-gray-400" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full outline-none font-medium text-gray-700" />
        </div>
        <div className="flex items-center gap-4 border-b border-gray-100 pb-2">
            <div className="w-5" />
            <input placeholder="Descrição" value={desc} onChange={e => setDesc(e.target.value)} className="w-full outline-none font-medium text-gray-700" />
        </div>
        <div className="flex items-center gap-4 border-b border-gray-100 pb-2">
            <Tag size={20} className="text-gray-400" />
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full outline-none bg-transparent font-medium text-gray-700">
                <option value="">Categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
        </div>
        <div className="flex items-center gap-4 border-b border-gray-100 pb-2">
            <Wallet size={20} className="text-gray-400" />
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full outline-none bg-transparent font-medium text-gray-700">
                <option value="">Conta</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
        </div>
      </div>

      {/* Detalhes Expansíveis */}
      <div className="px-6 mt-4">
        <button onClick={() => setShowDetails(!showDetails)} className="text-teal-800 text-sm font-bold flex items-center gap-1">
            {showDetails ? 'Ocultar detalhes' : 'Mais detalhes'}
            {showDetails ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </button>
      </div>

      {/* Botão de Salvar Centralizado embaixo */}
      <div className="fixed bottom-10 w-full flex justify-center">
        <button onClick={handleSave} disabled={saving} className={`w-16 h-16 ${bgColor} rounded-full flex items-center justify-center shadow-lg text-white`}>
            {saving ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Check size={32} />}
        </button>
      </div>
    </div>
  )
}
