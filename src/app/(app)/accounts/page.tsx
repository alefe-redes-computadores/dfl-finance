'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2, Landmark, Edit2, ArrowLeftRight, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Paleta de cores para o Seletor (Igual ao que você pediu)
const COLOR_PALETTE = ['#dc2626', '#16a34a', '#0284c7', '#8b5cf6', '#111827', '#f59e0b', '#ec4899', '#64748b']

// Componente de Iniciais (Visual Profissional)
function BankInitials({ color, name }: { color: string, name: string }) {
  const initials = name ? name.substring(0, 2).toUpperCase() : '??';
  return (
    <div 
      className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm"
      style={{ backgroundColor: color || '#64748b' }}
    >
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
  const [loadingExtrato, setLoadingExtrato] = useState(false)

  // Formatação de Moeda
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Cor do saldo (Negrito e Colorido)
  const getBalanceStyle = (val: number) => {
    if (val > 0) return 'text-emerald-600 font-bold';
    if (val < 0) return 'text-red-500 font-bold';
    return 'text-gray-600 font-bold';
  }

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
    setLoadingExtrato(true)
    const start = format(startOfMonth(accMonth), 'yyyy-MM-dd')
    const end = format(endOfMonth(accMonth), 'yyyy-MM-dd')

    const { data } = await supabase.from('transactions').select('*, categories(name, icon, color)').or(`account_id.eq.${selectedAccount.id},to_account_id.eq.${selectedAccount.id}`).gte('date', start).lte('date', end).order('date', { ascending: false })
    const txs = data ?? []
    setAccTransactions(txs)

    let inc = 0
    let exp = 0
    txs.forEach(t => {
      if (t.type === 'income' && t.account_id === selectedAccount.id) inc += Number(t.amount)
      if ((t.type === 'expense' || t.type === 'sangria') && t.account_id === selectedAccount.id) exp += Number(t.amount)
      if (t.type === 'transfer') {
        if (t.account_id === selectedAccount.id) exp += Number(t.amount)
        if (t.to_account_id === selectedAccount.id) inc += Number(t.amount)
      }
    })
    setAccSummary({ income: inc, expense: exp })
    setLoadingExtrato(false)
  }, [selectedAccount, accMonth])

  useEffect(() => { loadExtrato() }, [loadExtrato])

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '')
    const num = Number(value) / 100
    setBalanceNum(num)
    setDisplayBalance(num === 0 ? '' : num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  function openNewForm() {
    setEditingId(null)
    setName('')
    setColor(COLOR_PALETTE[0])
    setBalanceNum(0)
    setDisplayBalance('')
    setShowForm(true)
  }

  function openEditForm(acc: any) {
    setEditingId(acc.id)
    setName(acc.name)
    setColor(acc.color)
    const bal = Number(acc.balance)
    setBalanceNum(bal)
    setDisplayBalance(bal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    setShowForm(true)
  }

  async function handleSave() {
    if (!name.trim() || !user) return
    if (editingId) {
      await supabase.from('accounts').update({ name: name.trim(), balance: balanceNum, color: color }).eq('id', editingId)
      if (selectedAccount?.id === editingId) setSelectedAccount({ ...selectedAccount, name: name.trim(), balance: balanceNum, color: color })
    } else {
      await supabase.from('accounts').insert({ user_id: user.id, name: name.trim(), balance: balanceNum, context, color: color })
    }
    setShowForm(false)
    loadAccounts()
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza? Isso apagará a conta.')) return
    await supabase.from('accounts').delete().eq('id', id)
    setShowForm(false)
    setSelectedAccount(null)
    loadAccounts()
  }

  // TELA DETALHE DA CONTA
  if (selectedAccount) {
    const accBalance = Number(selectedAccount.balance)
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 pt-6 pb-24 font-sans animate-in slide-in-from-right-4 duration-200">
        <div className="flex items-center justify-between px-4 mb-6">
          <button onClick={() => setSelectedAccount(null)} className="p-2 -ml-2 text-gray-700"><ChevronLeft size={24} /></button>
          <div className="flex gap-4">
            <button onClick={() => openEditForm(selectedAccount)} className="text-gray-700 hover:text-emerald-700"><Edit2 size={22} /></button>
          </div>
        </div>
        <div className="flex flex-col items-center px-4 mb-8">
          <BankInitials color={selectedAccount.color} name={selectedAccount.name} />
          <h2 className="text-xl font-bold text-gray-900 mt-3 mb-1">{selectedAccount.name}</h2>
          <p className="text-gray-500 mb-2">Saldo: <span className={`${getBalanceStyle(accBalance)}`}>{formatCurrency(accBalance)}</span></p>
          <div className="flex items-center gap-4 bg-gray-200/60 px-4 py-2 rounded-full mt-2">
            <button onClick={() => setAccMonth(subMonths(accMonth, 1))}><ChevronLeft size={18} className="text-gray-500" /></button>
            <span className="text-xs font-bold text-teal-800 capitalize w-24 text-center">{format(accMonth, 'MMMM yyyy', { locale: ptBR })}</span>
            <button onClick={() => setAccMonth(addMonths(accMonth, 1))}><ChevronRight size={18} className="text-gray-500" /></button>
          </div>
        </div>
        {/* ... restante do extrato igual ... */}
        <div className="flex items-center px-4 mb-8">
          <div className="flex-1 text-center border-r border-gray-200">
            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Entradas</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(accSummary.income)}</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Saídas</p>
            <p className="text-lg font-bold text-red-500">{formatCurrency(accSummary.expense)}</p>
          </div>
        </div>
        
        {/* Histórico Transações */}
        <div className="px-4">
            {accTransactions.map(t => (
                <div key={t.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 mb-3">
                    <p className="text-sm font-bold text-gray-800 flex-1">{t.description}</p>
                    <p className={`text-sm font-bold ${Number(t.amount) > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>{formatCurrency(Number(t.amount))}</p>
                </div>
            ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 px-4 pt-6 pb-24 font-sans animate-in fade-in duration-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><button onClick={() => router.back()}><ChevronLeft size={24} className="text-gray-700" /></button><h1 className="text-xl font-bold text-gray-900">Contas</h1></div>
        <button onClick={openNewForm}><Plus size={24} className="text-gray-700" /></button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <h2 className="font-bold text-gray-800 mb-4">{editingId ? 'Editar Conta' : 'Nova Conta'}</h2>
            <div className="space-y-4">
                <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Nome</label><input value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-100 p-3 rounded-xl outline-none text-sm font-bold" /></div>
                
                {/* SELETOR DE CORES NOVO */}
                <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Cor da Conta</label>
                    <div className="flex flex-wrap gap-2">
                        {COLOR_PALETTE.map(c => (
                            <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`} style={{backgroundColor: c}} />
                        ))}
                    </div>
                </div>

                <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Saldo Inicial (R$)</label><input type="text" value={displayBalance} onChange={handleBalanceChange} className="w-full bg-gray-100 p-3 rounded-xl outline-none text-sm font-bold" /></div>
                <button onClick={handleSave} className="w-full bg-emerald-900 text-white py-3 rounded-xl font-bold">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Contas */}
      <div className="space-y-3">
        {accounts.map(acc => {
            const val = Number(acc.balance)
            return (
                <button key={acc.id} onClick={() => setSelectedAccount(acc)} className="w-full bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <BankInitials color={acc.color} name={acc.name} />
                        <h3 className="font-bold text-gray-800">{acc.name}</h3>
                    </div>
                    <span className={getBalanceStyle(val)}>{formatCurrency(val)}</span>
                </button>
            )
        })}
      </div>
    </div>
  )
}
