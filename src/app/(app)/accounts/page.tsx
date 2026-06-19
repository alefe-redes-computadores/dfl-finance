'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2, Landmark, Edit2, ArrowLeftRight, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const PERSONAL_BANKS = [
  { slug: 'bradesco', name: 'Bradesco', color: '#dc2626', emoji: '🔴' },
  { slug: 'caixa', name: 'Caixa', color: '#0284c7', emoji: '🏦' },
  { slug: 'carteira', name: 'Carteira', color: '#16a34a', emoji: '👛' },
  { slug: 'itau', name: 'Itaú', color: '#f97316', emoji: '🟠' },
  { slug: 'nubank', name: 'Nubank', color: '#8b5cf6', emoji: '🟣' },
  { slug: 'outra', name: 'Outra', color: '#94a3b8', emoji: '🏛️' },
]

const DFL_BANKS = [
  { slug: 'cora', name: 'Cora', color: '#7c3aed', emoji: '🟣' },
  { slug: 'ifood-pago', name: 'iFood Pago', color: '#ea1d2c', emoji: '🍔' },
  { slug: 'infinitpay', name: 'InfinitPay', color: '#111827', emoji: '⚫' },
  { slug: 'mercado-pago', name: 'Mercado Pago', color: '#009ee3', emoji: '💙' },
  { slug: 'pagbank', name: 'PagBank', color: '#22c55e', emoji: '💚' },
  { slug: 'stone', name: 'Stone', color: '#00a868', emoji: '🟢' },
  { slug: 'outra', name: 'Outra', color: '#94a3b8', emoji: '🏛️' },
]

const ALL_BANKS = [...PERSONAL_BANKS, ...DFL_BANKS]

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [accounts, setAccounts] = useState<any[]>([])
  const [context, setContext] = useState<'personal' | 'dfl'>('personal')
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [bankSlug, setBankSlug] = useState(PERSONAL_BANKS[0].slug)
  const [color, setColor] = useState(PERSONAL_BANKS[0].color)
  
  // Controle da Máscara para as Contas
  const [balanceNum, setBalanceNum] = useState(0)
  const [displayBalance, setDisplayBalance] = useState('')

  const [selectedAccount, setSelectedAccount] = useState<any | null>(null)
  const [accMonth, setAccMonth] = useState(new Date())
  const [accTransactions, setAccTransactions] = useState<any[]>([])
  const [accSummary, setAccSummary] = useState({ income: 0, expense: 0 })
  const [loadingExtrato, setLoadingExtrato] = useState(false)

  const AVAILABLE_BANKS = context === 'personal' ? PERSONAL_BANKS : DFL_BANKS

  const loadAccounts = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user.id).eq('context', context).order('name')
    setAccounts(data ?? [])
    setLoading(false)
  }, [user, context])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  useEffect(() => {
    if (!editingId && !showForm) {
      const defaultBank = AVAILABLE_BANKS[0]
      setBankSlug(defaultBank.slug)
      setColor(defaultBank.color)
    }
  }, [context, AVAILABLE_BANKS, editingId, showForm])

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

  // Máscara de saldo da Conta
  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '')
    const num = Number(value) / 100
    setBalanceNum(num)
    setDisplayBalance(num === 0 ? '' : num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  function openNewForm() {
    setEditingId(null)
    setName('')
    setBankSlug(AVAILABLE_BANKS[0].slug)
    setColor(AVAILABLE_BANKS[0].color)
    setBalanceNum(0)
    setDisplayBalance('')
    setShowForm(true)
  }

  function openEditForm(acc: any) {
    setEditingId(acc.id)
    setName(acc.name)
    setBankSlug(acc.bank_slug)
    setColor(acc.color)
    const bal = Number(acc.balance)
    setBalanceNum(bal)
    setDisplayBalance(bal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    setShowForm(true)
  }

  async function handleSave() {
    if (!name.trim() || !user) return
    const selectedBank = AVAILABLE_BANKS.find(b => b.slug === bankSlug) || ALL_BANKS.find(b => b.slug === bankSlug)
    const bankColor = selectedBank ? selectedBank.color : color

    if (editingId) {
      const { error } = await supabase.from('accounts').update({ name: name.trim(), bank_slug: bankSlug, balance: balanceNum, color: bankColor }).eq('id', editingId)
      if (!error && selectedAccount?.id === editingId) setSelectedAccount({ ...selectedAccount, name: name.trim(), bank_slug: bankSlug, balance: balanceNum, color: bankColor })
    } else {
      await supabase.from('accounts').insert({ user_id: user.id, name: name.trim(), bank_slug: bankSlug, balance: balanceNum, context, color: bankColor })
    }
    setShowForm(false)
    loadAccounts()
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza? Isso pode quebrar transações vinculadas a esta conta.')) return
    await supabase.from('accounts').delete().eq('id', id)
    setShowForm(false)
    setSelectedAccount(null)
    loadAccounts()
  }

  if (selectedAccount) {
    const bankDef = ALL_BANKS.find(b => b.slug === selectedAccount.bank_slug)
    const monthLabel = format(accMonth, 'MMMM yyyy', { locale: ptBR })
    const accBalance = Number(selectedAccount.balance)

    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 pt-6 pb-24 font-sans animate-in slide-in-from-right-4 duration-200">
        <div className="flex items-center justify-between px-4 mb-6">
          <button onClick={() => setSelectedAccount(null)} className="p-2 -ml-2 text-gray-700"><ChevronLeft size={24} /></button>
          <div className="flex gap-4">
            <button onClick={() => router.push('/new-transaction?type=transfer')} className="text-gray-700 hover:text-emerald-700"><ArrowLeftRight size={22} /></button>
            <button onClick={() => openEditForm(selectedAccount)} className="text-gray-700 hover:text-emerald-700"><Edit2 size={22} /></button>
          </div>
        </div>
        <div className="flex flex-col items-center px-4 mb-8">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-lg mb-4" style={{ backgroundColor: `${selectedAccount.color}20` }}>{bankDef?.emoji || '🏛️'}</div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">{selectedAccount.name}</h2>
          <p className="text-gray-500 mb-2">Saldo atual: <span className={`font-bold ${accBalance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>R$ {accBalance.toFixed(2).replace('.', ',')}</span></p>
          <div className="flex items-center gap-4 bg-gray-200/60 px-4 py-2 rounded-full mt-2">
            <button onClick={() => setAccMonth(subMonths(accMonth, 1))}><ChevronLeft size={18} className="text-gray-500" /></button>
            <span className="text-xs font-bold text-teal-800 capitalize w-24 text-center">{monthLabel}</span>
            <button onClick={() => setAccMonth(addMonths(accMonth, 1))}><ChevronRight size={18} className="text-gray-500" /></button>
          </div>
        </div>
        <div className="flex items-center px-4 mb-8">
          <div className="flex-1 text-center border-r border-gray-200">
            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Entradas do Mês</p>
            <p className="text-lg font-bold text-emerald-600">R$ {accSummary.income.toFixed(2).replace('.', ',')}</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Saídas do Mês</p>
            <p className="text-lg font-bold text-red-500">R$ {accSummary.expense.toFixed(2).replace('.', ',')}</p>
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
              <h2 className="font-bold text-gray-800 mb-4">Editar Conta</h2>
              <div className="space-y-4">
                <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Nome</label><input value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-100 p-3 rounded-xl outline-none text-sm font-bold" /></div>
                <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Instituição</label><select value={bankSlug} onChange={e => setBankSlug(e.target.value)} className="w-full bg-gray-100 p-3 rounded-xl outline-none text-sm font-bold">{ALL_BANKS.map(bank => <option key={bank.slug} value={bank.slug}>{bank.emoji} {bank.name}</option>)}</select></div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Saldo Inicial (R$)</label>
                  <div className="flex items-center bg-gray-100 p-3 rounded-xl">
                    <span className="text-gray-500 mr-1 font-bold">R$</span>
                    <input type="text" inputMode="numeric" value={displayBalance} onChange={handleBalanceChange} placeholder="0,00" className="w-full bg-transparent outline-none text-sm font-bold" />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleSave} className="flex-1 bg-emerald-900 text-white py-3 rounded-xl font-bold">Salvar</button>
                  <button onClick={() => handleDelete(editingId!)} className="w-12 flex items-center justify-center bg-red-100 text-red-600 rounded-xl"><Trash2 size={20}/></button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-4">
          <p className="text-xs font-bold text-gray-400 uppercase mb-4 pl-1 flex items-center gap-2"><Landmark size={14} /> Histórico da Conta</p>
          {loadingExtrato ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-emerald-900 border-t-transparent rounded-full animate-spin" /></div>
          ) : accTransactions.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">Nenhuma movimentação neste mês.</p>
          ) : (
            <div className="space-y-3">
              {accTransactions.map(t => {
                let isIncome = false
                if (t.type === 'income') isIncome = true
                if (t.type === 'transfer' && t.to_account_id === selectedAccount.id) isIncome = true
                return (
                  <div key={t.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isIncome ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>{t.type === 'transfer' ? <ArrowLeftRight size={16} /> : (isIncome ? '↓' : '↑')}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{t.description || t.categories?.name || 'Transferência'}</p>
                      <p className="text-[10px] text-gray-500 font-medium">{t.categories?.name || 'Movimentação'} • {format(new Date(t.date + 'T12:00:00'), "d MMM", { locale: ptBR })}</p>
                    </div>
                    <p className={`text-sm font-bold ${isIncome ? 'text-emerald-600' : 'text-gray-900'}`}>{isIncome ? '+' : '-'} R$ {Number(t.amount).toFixed(2).replace('.', ',')}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 px-4 pt-6 pb-24 font-sans animate-in fade-in duration-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><button onClick={() => router.back()}><ChevronLeft size={24} className="text-gray-700" /></button><h1 className="text-xl font-bold text-gray-900">Contas</h1></div>
        <button onClick={openNewForm}><Plus size={24} className="text-gray-700" /></button>
      </div>

      <div className="flex bg-gray-200 rounded-full p-1 mb-6">
        <button onClick={() => setContext('dfl')} className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${context === 'dfl' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>DFL</button>
        <button onClick={() => setContext('personal')} className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${context === 'personal' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Pessoal</button>
      </div>

      <div className="bg-emerald-900 rounded-3xl p-6 text-white mb-6 shadow-lg">
        <p className="text-emerald-100/80 text-sm font-medium mb-1">Saldo Total ({context === 'dfl' ? 'DFL' : 'Pessoal'})</p>
        <h2 className="text-3xl font-bold">R$ {totalBalance.toFixed(2).replace('.', ',')}</h2>
      </div>

      {showForm && !selectedAccount && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-6 space-y-4 animate-in fade-in">
          <h2 className="font-bold text-gray-800">Nova Conta</h2>
          <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Nome</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Conta Corrente" className="w-full bg-gray-100 p-3 rounded-xl outline-none text-sm font-bold" /></div>
          <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Instituição</label><select value={bankSlug} onChange={e => setBankSlug(e.target.value)} className="w-full bg-gray-100 p-3 rounded-xl outline-none text-sm font-bold">{AVAILABLE_BANKS.map(bank => <option key={bank.slug} value={bank.slug}>{bank.emoji} {bank.name}</option>)}</select></div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Saldo Inicial (R$)</label>
            <div className="flex items-center bg-gray-100 p-3 rounded-xl">
              <span className="text-gray-500 mr-1 font-bold">R$</span>
              <input type="text" inputMode="numeric" value={displayBalance} onChange={handleBalanceChange} placeholder="0,00" className="w-full bg-transparent outline-none text-sm font-bold" />
            </div>
          </div>
          <button onClick={handleSave} className="w-full bg-emerald-900 text-white py-3 rounded-xl font-bold mt-2">Salvar Conta</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-emerald-900 border-t-transparent rounded-full animate-spin" /></div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400"><Landmark size={48} className="mb-4 opacity-20" /><p>Nenhuma conta cadastrada.</p></div>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => {
            const bankDef = ALL_BANKS.find(b => b.slug === acc.bank_slug)
            const curBal = Number(acc.balance || 0)
            return (
              <button key={acc.id} onClick={() => setSelectedAccount(acc)} className="w-full bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100 active:scale-[0.99] transition-transform text-left">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm" style={{ backgroundColor: `${acc.color}20` }}>{bankDef?.emoji || '🏛️'}</div>
                  <div><h3 className="font-bold text-gray-800">{acc.name}</h3><p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">{bankDef?.name || 'Outro'}</p></div>
                </div>
                <div className="text-right">
                  <span className={`font-bold block ${curBal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>R$ {curBal.toFixed(2).replace('.', ',')}</span>
                  <ChevronRight size={16} className="text-gray-300 inline-block mt-1" />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
