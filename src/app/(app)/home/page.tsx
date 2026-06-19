'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2, Edit2, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const COLOR_PALETTE = ['#dc2626', '#16a34a', '#0284c7', '#8b5cf6', '#111827', '#f59e0b', '#ec4899', '#64748b']

function BankInitials({ color, name }: { color: string, name: string }) {
  const initials = name ? name.substring(0, 2).toUpperCase() : '??';
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{ backgroundColor: color || '#64748b' }}>
      {initials}
    </div>
  )
}

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [accounts, setAccounts] = useState<any[]>([])
  const [context, setContext] = useState<'personal' | 'dfl'>('personal')
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLOR_PALETTE[0])
  const [balanceNum, setBalanceNum] = useState(0)
  const [displayBalance, setDisplayBalance] = useState('')

  const [selectedAccount, setSelectedAccount] = useState<any | null>(null)
  const [accMonth, setAccMonth] = useState(new Date())
  const [accTransactions, setAccTransactions] = useState<any[]>([])
  const [accSummary, setAccSummary] = useState({ income: 0, expense: 0 })

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const getBalanceStyle = (val: number) => val >= 0 ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold';

  const loadAccounts = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user.id).eq('context', context).order('name')
    setAccounts(data ?? [])
    setLoading(false)
  }, [user, context])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  const loadExtrato = useCallback(async () => {
    if (!selectedAccount) return
    const start = format(startOfMonth(accMonth), 'yyyy-MM-dd')
    const end = format(endOfMonth(accMonth), 'yyyy-MM-dd')
    const { data } = await supabase.from('transactions').select('*, categories(name, icon, color)').or(`account_id.eq.${selectedAccount.id},to_account_id.eq.${selectedAccount.id}`).gte('date', start).lte('date', end).order('date', { ascending: false })
    const txs = data ?? []
    setAccTransactions(txs)
    let inc = 0, exp = 0
    txs.forEach(t => {
      if (t.type === 'income' && t.account_id === selectedAccount.id) inc += Number(t.amount)
      if ((t.type === 'expense' || t.type === 'sangria') && t.account_id === selectedAccount.id) exp += Number(t.amount)
    })
    setAccSummary({ income: inc, expense: exp })
  }, [selectedAccount, accMonth])

  useEffect(() => { loadExtrato() }, [loadExtrato])

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '')
    const num = Number(value) / 100
    setBalanceNum(num)
    setDisplayBalance(num === 0 ? '' : num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  async function handleSave() {
    if (!name.trim() || !user) return
    if (editingId) {
      await supabase.from('accounts').update({ name: name.trim(), balance: balanceNum, color }).eq('id', editingId)
    } else {
      await supabase.from('accounts').insert({ user_id: user.id, name: name.trim(), balance: balanceNum, context, color })
    }
    setShowForm(false)
    loadAccounts()
  }

  // TELA DETALHE
  if (selectedAccount) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 pt-6 pb-24 font-sans">
        <div className="flex items-center justify-between px-4 mb-6">
          <button onClick={() => setSelectedAccount(null)}><ChevronLeft size={24} /></button>
        </div>
        <div className="flex flex-col items-center px-4 mb-8">
          <BankInitials color={selectedAccount.color} name={selectedAccount.name} />
          <h2 className="text-xl font-bold mt-3">{selectedAccount.name}</h2>
          <p className={getBalanceStyle(Number(selectedAccount.balance))}>{formatCurrency(Number(selectedAccount.balance))}</p>
          <div className="flex items-center gap-4 bg-gray-200/60 px-4 py-2 rounded-full mt-4">
            <button onClick={() => setAccMonth(subMonths(accMonth, 1))}><ChevronLeft size={18}/></button>
            <span className="text-xs font-bold w-24 text-center">{format(accMonth, 'MMMM yyyy', { locale: ptBR })}</span>
            <button onClick={() => setAccMonth(addMonths(accMonth, 1))}><ChevronRight size={18}/></button>
          </div>
        </div>
        <div className="px-4 space-y-3">
          {accTransactions.map(t => (
            <div key={t.id} className="bg-white rounded-2xl p-4 flex justify-between shadow-sm border border-gray-100">
              <p className="font-bold text-sm">{t.description || t.categories?.name}</p>
              <p className={`font-bold text-sm ${Number(t.amount) > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>{formatCurrency(Number(t.amount))}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // TELA LISTA
  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 px-4 pt-6 pb-24 font-sans">
      <div className="flex justify-between mb-6 items-center">
        <button onClick={() => router.back()}><ChevronLeft size={24}/></button>
        <h1 className="text-xl font-bold">Contas</h1>
        <button onClick={() => { setShowForm(true); setEditingId(null); setName(''); }}><Plus size={24}/></button>
      </div>

      <div className="flex bg-gray-200 rounded-full p-1 mb-6">
        <button onClick={() => setContext('dfl')} className={`flex-1 py-2 rounded-full font-bold ${context === 'dfl' ? 'bg-white' : ''}`}>DFL</button>
        <button onClick={() => setContext('personal')} className={`flex-1 py-2 rounded-full font-bold ${context === 'personal' ? 'bg-white' : ''}`}>Pessoal</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h2 className="font-bold mb-4">Nova Conta</h2>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome" className="w-full bg-gray-100 p-3 rounded-xl mb-4" />
            <div className="flex flex-wrap gap-2 mb-4">
              {COLOR_PALETTE.map(c => <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full ${color === c ? 'ring-2' : ''}`} style={{backgroundColor: c}} />)}
            </div>
            <input value={displayBalance} onChange={handleBalanceChange} placeholder="Saldo" className="w-full bg-gray-100 p-3 rounded-xl mb-4" />
            <button onClick={handleSave} className="w-full bg-emerald-900 text-white py-3 rounded-xl font-bold">Salvar</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {accounts.map(acc => (
          <button key={acc.id} onClick={() => setSelectedAccount(acc)} className="w-full bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <BankInitials color={acc.color} name={acc.name} />
              <h3 className="font-bold">{acc.name}</h3>
            </div>
            <span className={getBalanceStyle(Number(acc.balance))}>{formatCurrency(Number(acc.balance))}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
