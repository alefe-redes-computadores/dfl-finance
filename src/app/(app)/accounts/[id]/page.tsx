'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Edit2, ArrowRightLeft, Scale, ChevronRight, X, Loader2, Check, Clock,
  Home, Utensils, Car, HeartPulse, GraduationCap, Gamepad2, Shirt,
  Smile, Repeat, Wrench, Dog, FileText, Shield, Gift, MoreHorizontal,
  Briefcase, Laptop, TrendingUp, ShoppingCart, ReceiptIcon, Zap, Music,
  ArrowLeftRight as ArrowLeftRightIcon, Wallet, Search, Building, Trash2
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import BankLogo from '@/components/BankLogo'
import { BANK_LIST } from '@/lib/BankIcons'
import { useToast } from '@/contexts/ToastContext'

const DEFAULT_COLORS = ['#dc2626', '#16a34a', '#0284c7', '#8b5cf6', '#111827', '#f59e0b', '#ec4899', '#64748b']

const ICON_MAP: Record<string, React.ElementType> = {
  home: Home, utensils: Utensils, car: Car, heart: HeartPulse, 
  graduation: GraduationCap, gamepad: Gamepad2, shirt: Shirt, 
  smile: Smile, repeat: Repeat, wrench: Wrench, dog: Dog, 
  file: FileText, shield: Shield, gift: Gift, briefcase: Briefcase, 
  laptop: Laptop, trending: TrendingUp, shopping: ShoppingCart, 
  receipt: ReceiptIcon, zap: Zap, music: Music, other: MoreHorizontal
}

export default function AccountStatementPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  
  const [account, setAccount] = useState<any>(null)
  const [allAccounts, setAllAccounts] = useState<any[]>([]) 
  const [transactions, setTransactions] = useState<any[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [summary, setSummary] = useState({ income: 0, expense: 0 })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showBalanceModal, setShowBalanceModal] = useState(false)
  const [showDestAccModal, setShowDestAccModal] = useState(false)

  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLORS[0])
  const [displayBalance, setDisplayBalance] = useState('')
  const [balanceNum, setBalanceNum] = useState(0)
  const [allowNegative, setAllowNegative] = useState(false)
  const [bankSearch, setBankSearch] = useState('')
  const [filteredBanks, setFilteredBanks] = useState<typeof BANK_LIST>([])
  const [showBankDropdown, setShowBankDropdown] = useState(false)
  const [selectedBank, setSelectedBank] = useState<typeof BANK_LIST[0] | null>(null)

  const [adjustBalanceDisplay, setAdjustBalanceDisplay] = useState('')

  const [destAccountId, setDestAccountId] = useState('')
  const [transferAmountDisplay, setTransferAmountDisplay] = useState('')
  const [transferDate, setTransferDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [transferDesc, setTransferDesc] = useState('')

  const monthLabel = format(currentDate, 'MMMM \'De\' yyyy', { locale: ptBR })

  const loadData = useCallback(async () => {
    if (!id || !user) return
    setLoading(true)

    try {
      const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
      const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

      const { data: accData } = await supabase
        .from('accounts')
        .select('*')
        .match({ user_id: user.id, id: id })
        .single()

      if (accData) setAccount(accData)

      if (accData) {
        const { data: allAccs } = await supabase
          .from('accounts')
          .select('*')
          .match({ user_id: user.id, context: accData.context })
        setAllAccounts((Array.isArray(allAccs) ? allAccs : []).filter(a => a.id !== id))
      }

      const { data: txsData } = await supabase
        .from('transactions')
        .select('*, categories(name, icon, color)')
        .match({ user_id: user.id, account_id: id })
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })

      const txs = Array.isArray(txsData) ? txsData : []
      setTransactions(txs)

      const income = txs.filter(t => t.type === 'income' || (t.type === 'transfer' && t.description?.includes('de '))).reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const expense = txs.filter(t => t.type === 'expense' || t.type === 'sangria' || (t.type === 'transfer' && t.description?.includes('para '))).reduce((a, t) => a + (Number(t.amount) || 0), 0)
      
      setSummary({ income, expense })

    } catch (err) {
      console.error("Erro inesperado:", err)
    } finally {
      setLoading(false)
    }
  }, [id, currentDate, user])

  useEffect(() => { loadData() }, [loadData])

  const formatMoneyInput = (value: string) => {
    const rawValue = value.replace(/\D/g, '')
    const num = Number(rawValue) / 100
    return { num, display: num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
  }

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { num, display } = formatMoneyInput(e.target.value)
    setBalanceNum(num); setDisplayBalance(display)
  }

  const handleAdjustBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdjustBalanceDisplay(formatMoneyInput(e.target.value).display)
  }

  const handleTransferAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTransferAmountDisplay(formatMoneyInput(e.target.value).display)
  }

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

  const selectBank = (bank: typeof BANK_LIST[0]) => {
    setName(bank.name)
    setColor(bank.color)
    setSelectedBank(bank)
    setBankSearch('')
    setFilteredBanks([])
    setShowBankDropdown(false)
  }

  const handleSaveAccountInfo = async () => {
    if (!name.trim() || !user) return
    setActionLoading(true)
    const { error } = await supabase.from('accounts').update({ 
      name: name.trim(), 
      color,
      allow_negative: allowNegative 
    }).eq('id', id)
    
    if (error) {
      showToast('Erro ao salvar alterações.', 'error')
    } else {
      showToast('Conta atualizada com sucesso!', 'success')
    }
    
    setShowForm(false)
    router.refresh()
    loadData()
    setActionLoading(false)
  }

  const handleAdjustBalanceSubmit = async () => {
    if (!user) return
    setActionLoading(true)
    const rawAmount = parseFloat(adjustBalanceDisplay.replace(/\./g, '').replace(',', '.')) || 0;
    const { error } = await supabase.from('accounts').update({ balance: rawAmount }).eq('id', id);
    
    if (error) {
      showToast('Erro ao ajustar saldo.', 'error')
    } else {
      showToast('Saldo ajustado com sucesso!', 'success')
    }
    
    setShowBalanceModal(false);
    router.refresh()
    loadData();
    setActionLoading(false)
  }

  const handleTransferSubmit = async () => {
    if (!destAccountId || !transferAmountDisplay) {
      showToast('Preencha o destino e o valor.', 'warning')
      return
    }
    if (!user) return
    setActionLoading(true)
    
    const rawAmount = parseFloat(transferAmountDisplay.replace(/\./g, '').replace(',', '.')) || 0;
    const destAcc = allAccounts.find(a => a.id === destAccountId);

    if (!destAcc) {
      showToast('Conta de destino não encontrada.', 'error')
      setActionLoading(false)
      return
    }

    try {
      await supabase.from('accounts').update({ balance: Number(account.balance) - rawAmount }).eq('id', id);
      await supabase.from('accounts').update({ balance: Number(destAcc.balance) + rawAmount }).eq('id', destAccountId);

      await supabase.from('transactions').insert({
        account_id: id,
        type: 'transfer',
        amount: rawAmount,
        description: transferDesc || `Transferência para ${destAcc.name}`,
        date: transferDate,
        status: 'done',
        context: account.context,
        user_id: user.id
      });

      await supabase.from('transactions').insert({
        account_id: destAccountId,
        type: 'transfer',
        amount: rawAmount,
        description: transferDesc || `Transferência de ${account.name}`,
        date: transferDate,
        status: 'done',
        context: account.context,
        user_id: user.id
      });

      showToast('Transferência realizada com sucesso!', 'success')
      setShowTransferModal(false);
      setTransferAmountDisplay('');
      setTransferDesc('');
      router.refresh()
      loadData();
    } catch (error) {
      showToast('Erro ao realizar transferência.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const openEditModal = () => {
    if (!account) return
    setName(account.name)
    setColor(account.color)
    setAllowNegative(account.allow_negative || false)
    setSelectedBank(null)
    setBankSearch('')
    setFilteredBanks([])
    setShowBankDropdown(false)
    setShowForm(true)
  }

  const openBalanceModal = () => {
    const safeBalance = Number(account.balance) || 0
    setAdjustBalanceDisplay(safeBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
    setShowBalanceModal(true)
  }

  const formatCurrency = (val: number) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (loading && !account) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
      <Loader2 className="animate-spin text-teal-600" size={40} />
    </div>
  )

  if (!account) return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Conta não encontrada.</div>

  const safeBalance = Number(account.balance) || 0
  const selectedDestAcc = allAccounts.find(a => a.id === destAccountId)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-20 font-sans relative transition-colors duration-300">
      
      <div className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 sticky top-0 z-10 border-b border-gray-50 dark:border-slate-700">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"><ChevronLeft size={24} /></button>
        <h1 className="font-bold text-[17px] text-gray-800 dark:text-gray-100">Detalhes da Conta</h1>
        <div className="flex items-center gap-3 text-teal-700 dark:text-teal-400">
          <button onClick={() => setShowTransferModal(true)} className="p-1 hover:text-teal-800 dark:hover:text-teal-300 transition-colors"><ArrowRightLeft size={20} /></button>
          <button onClick={openBalanceModal} className="p-1 hover:text-teal-800 dark:hover:text-teal-300 transition-colors"><Scale size={20} /></button>
          <button onClick={openEditModal} className="p-1 hover:text-teal-800 dark:hover:text-teal-300 transition-colors"><Edit2 size={20} /></button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-8 flex flex-col items-center shadow-sm border-b border-gray-50 dark:border-slate-700 mb-6">
        <BankLogo color={account.color || '#f97316'} name={account.name} size="lg" />
        <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1 mt-4">{account.name}</p>
        <p className="text-[32px] font-light text-gray-800 dark:text-gray-100 mb-6">{formatCurrency(safeBalance)}</p>

        <div className="flex items-center justify-between w-full max-w-[240px] bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 shadow-sm rounded-full p-1.5 mb-8">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"><ChevronLeft size={16} /></button>
          <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200 capitalize">{monthLabel}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"><ChevronRight size={16} /></button>
        </div>

        <div className="flex w-full justify-center gap-10 px-6">
          <div className="text-center">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold tracking-wider uppercase mb-1">Entradas</p>
            <p className="text-[15px] font-bold text-emerald-600">{formatCurrency(summary.income)}</p>
          </div>
          <div className="w-[1px] bg-gray-100 dark:bg-slate-600"></div>
          <div className="text-center">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold tracking-wider uppercase mb-1">Saídas</p>
            <p className="text-[15px] font-bold text-red-500">{formatCurrency(summary.expense)}</p>
          </div>
        </div>
      </div>

      <div className="px-4">
        <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100 mb-3 px-1">Extrato do Mês</h3>
        {transactions.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-50 dark:border-slate-700 p-10 text-center shadow-sm">
             <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma movimentação neste mês.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-50 dark:border-slate-700 overflow-hidden py-2">
            {transactions.map((tx, index) => {
               const isTransferIn = tx.type === 'transfer' && tx.description?.includes('de ');
               const isIncomeVisual = tx.type === 'income' || isTransferIn;
               const isPending = tx.status === 'pending';
               const IconComp = tx.type === 'transfer' ? ArrowLeftRightIcon : (ICON_MAP[tx.categories?.icon] || ICON_MAP['other'])

               return (
                <div 
                  key={tx.id} 
                  onClick={() => router.push(`/transactions/${tx.id}`)}
                  className={`flex items-center justify-between px-4 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors gap-3 ${index !== transactions.length - 1 ? 'border-b border-gray-50 dark:border-slate-700' : ''}`}
                >
                  {isPending ? (
                    <div className="w-5 h-5 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                      <Clock size={12} className="text-red-400" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      <Check size={12} className="text-emerald-500" />
                    </div>
                  )}

                  <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                    <div className="w-10 h-10 rounded-[12px] flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: tx.categories?.color ? `${tx.categories.color}20` : '#f3f4f6', color: tx.categories?.color || '#64748b' }}>
                      <IconComp size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200 uppercase tracking-tight truncate">{tx.description || tx.categories?.name}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })}</p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className={`text-[14px] font-bold ${isIncomeVisual ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isIncomeVisual ? '+' : '-'} {formatCurrency(Number(tx.amount) || 0)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: EDITAR CONTA */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-t-[32px] sm:rounded-[24px] w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom-10 overflow-y-auto max-h-[85vh]" onClick={e => e.stopPropagation()}>
            
            <div className="flex items-center gap-4 mb-6">
              {selectedBank ? (
                <BankLogo color={selectedBank.color} name={selectedBank.name} size="lg" />
              ) : (
                <BankLogo color={color} name={name || account?.name || '??'} size="lg" />
              )}
              <div className="flex-1">
                <h2 className="font-bold text-[18px] text-gray-800 dark:text-gray-100">Editar Conta</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">Altere nome, cor e configurações</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 self-start">
                <X size={20}/>
              </button>
            </div>

            <div className="relative mb-5">
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Buscar banco</label>
              <div className="flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl border border-gray-100 dark:border-slate-600 overflow-hidden">
                <Search size={16} className="ml-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <input
                  value={bankSearch}
                  onChange={e => handleBankSearch(e.target.value)}
                  onFocus={() => { if (filteredBanks.length > 0) setShowBankDropdown(true) }}
                  placeholder="Digite o nome do banco..."
                  className="w-full bg-transparent py-3 px-3 text-sm outline-none font-medium text-gray-800 dark:text-gray-200 placeholder:text-gray-400"
                />
                {bankSearch && (
                  <button onClick={() => { setBankSearch(''); setFilteredBanks([]); setShowBankDropdown(false) }} className="p-2 mr-1 text-gray-400 dark:text-gray-500 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              {showBankDropdown && filteredBanks.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl mt-1 shadow-lg z-50 max-h-48 overflow-y-auto">
                  {filteredBanks.map(bank => (
                    <button key={bank.key} onClick={() => selectBank(bank)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors border-b border-gray-50 dark:border-slate-600 last:border-b-0">
                      <BankLogo color={bank.color} name={bank.name} size="sm" />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{bank.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-5">
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Nome da conta</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Minha Conta Principal" className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl py-3 px-4 text-sm font-bold text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 transition-colors" />
            </div>

            <div className="mb-5">
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Cor</label>
              <div className="flex flex-wrap gap-3">
                {DEFAULT_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} className="w-9 h-9 rounded-full transition-all duration-200" style={{ backgroundColor: c, transform: color === c ? 'scale(1.2)' : 'scale(1)', boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : 'none' }} />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mb-8 bg-gray-50 dark:bg-slate-700 p-4 rounded-xl">
              <div>
                <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Permitir saldo negativo</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Limite / Cheque especial</p>
              </div>
              <button onClick={() => setAllowNegative(!allowNegative)} className={`w-12 h-7 rounded-full relative transition-colors ${allowNegative ? 'bg-teal-700' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${allowNegative ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <button onClick={handleSaveAccountInfo} disabled={actionLoading || !name.trim()} className="w-full bg-teal-700 hover:bg-teal-800 text-white py-4 rounded-2xl font-bold text-[15px] disabled:opacity-50 transition-colors shadow-lg shadow-teal-700/20 flex justify-center items-center">
              {actionLoading ? <Loader2 className="animate-spin" size={24} /> : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: BALANÇA */}
      {showBalanceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowBalanceModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-t-[32px] sm:rounded-[24px] w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-8">
              <div>
                <h2 className="font-bold text-xl text-gray-800 dark:text-gray-100">Ajustar Saldo</h2>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">Atualize o saldo real da conta no banco.</p>
              </div>
              <button onClick={() => setShowBalanceModal(false)} className="text-gray-400 dark:text-gray-500"><X size={20}/></button>
            </div>
            <div className="bg-gray-50 dark:bg-slate-700 p-4 rounded-[20px] mb-8 flex items-center gap-2 border border-gray-100 dark:border-slate-600">
               <span className="text-xl text-gray-400 dark:text-gray-500 font-light">R$</span>
               <input type="text" inputMode="numeric" value={adjustBalanceDisplay} onChange={handleAdjustBalanceChange} className="w-full bg-transparent text-3xl font-light text-gray-800 dark:text-gray-200 outline-none" />
            </div>
            <button onClick={handleAdjustBalanceSubmit} disabled={actionLoading} className="w-full bg-gray-900 dark:bg-slate-700 text-white py-4 rounded-[20px] font-bold flex justify-center items-center shadow-lg">
              {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Confirmar Novo Saldo'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: TRANSFERÊNCIA */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowTransferModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-t-[32px] sm:rounded-[24px] w-full max-w-sm p-6 shadow-2xl overflow-y-auto max-h-[90vh] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-8">
              <div>
                <h2 className="font-bold text-xl text-gray-800 dark:text-gray-100">Transferência</h2>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">Saindo de: <span className="font-bold text-gray-700 dark:text-gray-300">{account.name}</span></p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-gray-400 dark:text-gray-500"><X size={20}/></button>
            </div>

            <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Conta de Destino</label>
            <button onClick={() => setShowDestAccModal(true)} className="w-full flex items-center justify-between bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 p-4 rounded-[16px] mb-4 text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none shadow-sm">
              <span className={selectedDestAcc ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>
                {selectedDestAcc ? selectedDestAcc.name : 'Selecione o destino...'}
              </span>
              <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" />
            </button>

            <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 mt-4">Valor da Transferência</label>
            <div className="bg-gray-50 dark:bg-slate-700 p-4 rounded-[16px] mb-4 flex items-center gap-2 border border-gray-100 dark:border-slate-600">
               <span className="text-xl text-gray-400 dark:text-gray-500 font-light">R$</span>
               <input type="text" inputMode="numeric" value={transferAmountDisplay} onChange={handleTransferAmountChange} placeholder="0,00" className="w-full bg-transparent text-2xl font-light text-gray-800 dark:text-gray-200 outline-none" />
            </div>

            <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 mt-4">Data</label>
            <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="w-full bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 p-4 rounded-[16px] mb-4 text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none shadow-sm" />

            <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 mt-4">Descrição (Opcional)</label>
            <input type="text" value={transferDesc} onChange={(e) => setTransferDesc(e.target.value)} placeholder="Ex: Pagamento" className="w-full bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 p-4 rounded-[16px] mb-8 text-[14px] font-bold text-gray-800 dark:text-gray-200 outline-none shadow-sm" />

            <button onClick={handleTransferSubmit} disabled={actionLoading} className="w-full bg-teal-700 hover:bg-teal-800 text-white py-4 rounded-[20px] font-bold flex justify-center items-center shadow-lg shadow-teal-700/20">
              {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Efetuar Transferência'}
            </button>
          </div>
        </div>
      )}

      {/* Modal de seleção de conta destino */}
      {showDestAccModal && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50" onClick={() => setShowDestAccModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Conta de Destino</h3>
              <button onClick={() => setShowDestAccModal(false)} className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              {allAccounts.map(acc => {
                const isActive = acc.id === destAccountId
                return (
                  <button key={acc.id} onClick={() => { setDestAccountId(acc.id); setShowDestAccModal(false) }} className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                    <BankLogo color={acc.color} name={acc.name} size="md" />
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{acc.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              {allAccounts.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 mt-10">Nenhuma conta disponível.</p>}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}