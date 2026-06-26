'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, GripVertical, Loader2, X, Eye, EyeOff, Search } from 'lucide-react'
import BankLogo from '@/components/BankLogo'
import { getBankLogoSvg } from '@/lib/BankIcons'

const DEFAULT_COLORS = ['#dc2626', '#16a34a', '#0284c7', '#8b5cf6', '#111827', '#f59e0b', '#ec4899', '#64748b']

const safeNum = (val: any) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(',', '.').replace(/[^0-9.-]+/g,""));
  return isNaN(parsed) ? 0 : parsed;
}

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [accounts, setAccounts] = useState<any[]>([])
  const [context, setContext] = useState<'personal' | 'dfl'>('dfl') 
  const [loading, setLoading] = useState(true)
  const [hideBalance, setHideBalance] = useState(false)
  
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLORS[0])
  const [displayBalance, setDisplayBalance] = useState('')
  const [balanceNum, setBalanceNum] = useState(0)
  const [allowNegative, setAllowNegative] = useState(false)

  // Estados do seletor de banco
  const [bankSearch, setBankSearch] = useState('')
  const [filteredBanks, setFilteredBanks] = useState<typeof BANK_LIST>([])
  const [showBankDropdown, setShowBankDropdown] = useState(false)

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    const num = safeNum(rawValue) / 100
    setBalanceNum(num)
    setDisplayBalance(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  const loadAccounts = useCallback(async () => {
    if (!user) return;
    setLoading(true)
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .match({ user_id: user.id, context: context })
      .order('name')
    
    setAccounts(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [context, user])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  // Handler de busca de banco
  const handleBankSearch = (value: string) => {
    setBankSearch(value)
    if (value.trim().length === 0) {
      setFilteredBanks([])
      setShowBankDropdown(false)
      return
    }
    const filtered = BANK_LIST.filter(b =>
      b.name.toLowerCase().includes(value.toLowerCase())
    )
    setFilteredBanks(filtered)
    setShowBankDropdown(filtered.length > 0)
  }

  // Selecionar banco da lista
  const selectBank = (bank: typeof BANK_LIST[0]) => {
    setName(bank.name)
    setColor(bank.color)
    setBankSearch('')
    setFilteredBanks([])
    setShowBankDropdown(false)
  }

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) return
    setLoading(true)
    const data = { 
      name: name.trim(), 
      balance: balanceNum, 
      context, 
      color,
      allow_negative: allowNegative,
      user_id: user.id
    }
    await supabase.from('accounts').insert(data)
    setShowForm(false)
    setName('')
    setDisplayBalance('')
    setBalanceNum(0)
    setColor(DEFAULT_COLORS[0])
    setAllowNegative(false)
    setBankSearch('')
    setFilteredBanks([])
    setShowBankDropdown(false)
    loadAccounts()
  }

  const totalBalance = accounts.reduce((acc, curr) => acc + safeNum(curr.balance), 0)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-24 font-sans relative transition-colors duration-300">
      
      {/* Header Premium */}
      <div className="bg-[#f8f9fa] dark:bg-slate-900 px-4 pt-6 pb-2 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[17px] font-bold text-gray-800 dark:text-gray-100">Contas</h1>
          <button onClick={() => setShowForm(true)} className="p-2 -mr-2 text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors">
            <Plus size={24} />
          </button>
        </div>

        {/* Seletor Estilo Kontto */}
        <div className="flex bg-white dark:bg-slate-800 rounded-full p-1 border border-gray-100 dark:border-slate-700 max-w-[220px] mx-auto shadow-sm">
          {(['dfl', 'personal'] as const).map(c => (
            <button
              key={c}
              onClick={() => setContext(c)}
              className={`flex-1 py-1.5 rounded-full text-[13px] font-bold transition-all duration-300 ${
                context === c ? 'bg-[#f4f6f8] dark:bg-slate-700 text-gray-800 dark:text-gray-200 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {c === 'dfl' ? 'DFL' : 'Pessoal'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-6">
        {/* Card de Saldo Premium */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-none border border-gray-50 dark:border-slate-700 mb-6 text-center flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Saldo total</span>
            <button onClick={() => setHideBalance(!hideBalance)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-[32px] font-light text-gray-800 dark:text-gray-100">
             {hideBalance ? '••••••' : `R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        </div>

        {/* Lista de Contas (Visual Limpo) */}
        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="animate-spin text-teal-700" size={32} /></div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500 text-[14px]">Nenhuma conta encontrada.</div>
        ) : (
          <div className="space-y-3">
            {accounts.map((acc) => {
              const bal = safeNum(acc.balance);
              let balanceColorClass = 'text-gray-400 dark:text-gray-500';
              if (bal > 0) balanceColorClass = 'text-emerald-600';
              if (bal < 0) balanceColorClass = 'text-red-500';

              return (
                <div 
                  key={acc.id} 
                  onClick={() => router.push(`/accounts/${acc.id}`)} 
                  className="bg-white dark:bg-slate-800 p-4 rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-none border border-gray-50 dark:border-slate-700 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <GripVertical className="text-gray-300 dark:text-gray-600 cursor-grab hover:text-gray-500 dark:hover:text-gray-400 transition-colors" size={18} />
                    <BankLogo color={acc.color} name={acc.name} size="md" />
                    <div>
                      <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">{acc.name}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mt-0.5">Conta Corrente</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-[14px] ${balanceColorClass}`}>
                       {hideBalance ? '••••' : `R$ ${bal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL COMPLETO DE CRIAÇÃO (com Seletor de Banco Inteligente + Cheque Especial) */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => {
          setShowForm(false)
          setShowBankDropdown(false)
          setBankSearch('')
        }}>
          <div className="bg-white dark:bg-slate-800 rounded-t-[32px] sm:rounded-[24px] w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom-10 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-[18px] text-gray-800 dark:text-gray-100">Nova Conta</h2>
              <button onClick={() => {
                setShowForm(false)
                setShowBankDropdown(false)
                setBankSearch('')
              }} className="p-2 -mr-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><X size={20}/></button>
            </div>

            {/* NOVO: Seletor Inteligente de Banco */}
            <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Buscar Banco (opcional)
            </label>
            <div className="relative mb-4">
              <div className="flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl border border-gray-100 dark:border-slate-600 overflow-hidden">
                <Search size={16} className="ml-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <input
                  value={bankSearch}
                  onChange={e => handleBankSearch(e.target.value)}
                  onFocus={() => {
                    if (filteredBanks.length > 0) setShowBankDropdown(true)
                  }}
                  placeholder="Ex: Nubank, Itaú, Bradesco..."
                  className="w-full bg-transparent py-3 px-3 text-sm outline-none font-medium text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
                {bankSearch && (
                  <button
                    onClick={() => {
                      setBankSearch('')
                      setFilteredBanks([])
                      setShowBankDropdown(false)
                    }}
                    className="p-2 mr-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {showBankDropdown && filteredBanks.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl mt-1 shadow-lg z-50 max-h-48 overflow-y-auto">
                  {filteredBanks.map(bank => (
                    <button
                      key={bank.key}
                      onClick={() => selectBank(bank)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors border-b border-gray-50 dark:border-slate-600 last:border-b-0"
                    >
                      <BankLogo color={bank.color} name={bank.name} size="sm" />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{bank.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Nome da Instituição</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Nubank, Inter"
              className="w-full bg-transparent border-b-2 border-gray-100 dark:border-slate-600 py-3 mb-6 text-[16px] outline-none focus:border-teal-600 font-bold text-gray-800 dark:text-gray-200 transition-colors"
            />
            
            <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Cor da Conta</label>
            <div className="flex flex-wrap gap-4 mb-6 items-center justify-center">
              {DEFAULT_COLORS.map(c => (
                <button 
                  key={c} 
                  onClick={() => setColor(c)} 
                  className="w-10 h-10 rounded-full transition-all duration-200 shadow-sm" 
                  style={{ 
                    backgroundColor: c,
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                    boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : 'none'
                  }} 
                />
              ))}
            </div>

            <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Saldo Inicial (R$)</label>
            <div className="bg-gray-50 dark:bg-slate-700 rounded-2xl p-4 flex items-center gap-2 mb-6 border border-gray-100 dark:border-slate-600">
               <span className="text-gray-400 dark:text-gray-500 font-bold text-lg">R$</span>
               <input type="text" inputMode="numeric" value={displayBalance} onChange={handleBalanceChange} placeholder="0,00" className="w-full bg-transparent text-2xl font-light text-gray-800 dark:text-gray-200 outline-none" />
            </div>
            
            {/* Toggle de Permitir Saldo Negativo (Cheque Especial) */}
            <label className="flex items-center justify-between mb-8 cursor-pointer bg-gray-50 dark:bg-slate-700 p-4 rounded-[20px] border border-gray-100 dark:border-slate-600">
              <div>
                <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Permitir Saldo Negativo</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Conta possui limite / cheque especial</p>
              </div>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={allowNegative} onChange={(e) => setAllowNegative(e.target.checked)} />
                <div className={`block w-11 h-6 rounded-full transition-colors ${allowNegative ? 'bg-teal-700' : 'bg-gray-200 dark:bg-gray-600'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${allowNegative ? 'transform translate-x-5' : ''}`}></div>
              </div>
            </label>

            <button onClick={handleSave} disabled={loading || !name.trim()} className="w-full bg-teal-700 hover:bg-teal-800 text-white py-4 rounded-[20px] font-bold text-[15px] disabled:opacity-50 transition-colors shadow-lg shadow-teal-700/20 flex justify-center items-center">
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'Salvar Instituição'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}