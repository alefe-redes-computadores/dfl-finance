'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Plus, Loader2, X, Eye, EyeOff,
  Search, Building, Settings, ArrowUp, ArrowDown, Trash2
} from 'lucide-react'
import BankLogo from '@/components/BankLogo'
import { BANK_LIST } from '@/lib/BankIcons'
import { useToast } from '@/contexts/ToastContext'

const DEFAULT_COLORS = ['#dc2626', '#16a34a', '#0284c7', '#8b5cf6', '#111827', '#f59e0b', '#ec4899', '#64748b']

const safeNum = (val: any) => {
  if (!val) return 0
  if (typeof val === 'number') return val
  const parsed = parseFloat(String(val).replace(',', '.').replace(/[^0-9.-]+/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()

  const [accounts, setAccounts] = useState<any[]>([])
  const [context, setContext] = useState<'personal' | 'dfl'>('dfl')
  const [loading, setLoading] = useState(true)
  const [hideBalance, setHideBalance] = useState(false)

  // Modal de criação
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLORS[0])
  const [displayBalance, setDisplayBalance] = useState('')
  const [balanceNum, setBalanceNum] = useState(0)
  const [allowNegative, setAllowNegative] = useState(false)
  const [bankSearch, setBankSearch] = useState('')
  const [filteredBanks, setFilteredBanks] = useState<typeof BANK_LIST>([])
  const [showBankDropdown, setShowBankDropdown] = useState(false)
  const [selectedBank, setSelectedBank] = useState<typeof BANK_LIST[0] | null>(null)

  // Modal de reordenação
  const [showReorderModal, setShowReorderModal] = useState(false)
  const [reorderList, setReorderList] = useState<any[]>([])

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    const num = safeNum(rawValue) / 100
    setBalanceNum(num)
    setDisplayBalance(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  const loadAccounts = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .match({ user_id: user.id, context })
      .order('order', { ascending: true })
      .order('name', { ascending: true })

    setAccounts(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [context, user])

  useEffect(() => { loadAccounts() }, [loadAccounts])

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

  const handleSave = async () => {
    if (!user) return
    if (!name.trim()) {
      showToast('Informe o nome da conta.', 'warning')
      return
    }
    setLoading(true)
    const { error } = await supabase.from('accounts').insert({
      name: name.trim(),
      balance: balanceNum,
      context,
      color,
      allow_negative: allowNegative,
      user_id: user.id,
      order: accounts.length
    })
    if (error) {
      showToast('Erro ao criar conta.', 'error')
    } else {
      showToast('Conta criada com sucesso!', 'success')
      setShowForm(false)
      setName('')
      setDisplayBalance('')
      setBalanceNum(0)
      setColor(DEFAULT_COLORS[0])
      setAllowNegative(false)
      setBankSearch('')
      setFilteredBanks([])
      setShowBankDropdown(false)
      setSelectedBank(null)
      loadAccounts()
    }
    setLoading(false)
  }

  const handleDeleteAccount = async (accId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return
    const { error } = await supabase.from('accounts').delete().eq('id', accId)
    if (error) {
      showToast('Erro ao excluir conta.', 'error')
    } else {
      showToast('Conta excluída com sucesso!', 'success')
      loadAccounts()
    }
  }

  // Reordenação
  const openReorderModal = () => {
    setReorderList([...accounts])
    setShowReorderModal(true)
  }

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newList = [...reorderList]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newList.length) return

    ;[newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]]
    setReorderList(newList)
  }

  const saveReorder = async () => {
    try {
      // Atualiza cada conta individualmente (mais confiável que upsert em lote)
      const updates = reorderList.map((acc, index) => ({
        id: acc.id,
        order: index,
      }))

      await Promise.all(
        updates.map(({ id, order }) =>
          supabase.from('accounts').update({ order }).eq('id', id)
        )
      )

      showToast('Ordem salva com sucesso!', 'success')
      setShowReorderModal(false)
      loadAccounts()
    } catch (error) {
      showToast('Erro ao salvar ordem.', 'error')
    }
  }

  const totalBalance = accounts.reduce((acc, curr) => acc + safeNum(curr.balance), 0)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-24 font-sans relative transition-colors duration-300">
      {/* Header */}
      <div className="bg-[#f8f9fa] dark:bg-slate-900 px-4 pt-6 pb-2 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[17px] font-bold text-gray-800 dark:text-gray-100">Contas</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={openReorderModal}
              className="p-2 -mr-2 text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
              title="Reordenar contas"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="p-2 -mr-2 text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors"
            >
              <Plus size={24} />
            </button>
          </div>
        </div>

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
        {/* Saldo total */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-6 shadow-sm border border-gray-50 dark:border-slate-700 mb-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Saldo total</span>
            <button onClick={() => setHideBalance(!hideBalance)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-[32px] font-light text-gray-800 dark:text-gray-100">
             {hideBalance ? '••••••' : `R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        </div>

        {/* Lista de Contas (sem GripVertical) */}
        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="animate-spin text-teal-700" size={32} /></div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500 text-sm">Nenhuma conta encontrada.</div>
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
                  className="bg-white dark:bg-slate-800 p-4 rounded-[20px] shadow-sm border border-gray-50 dark:border-slate-700 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors group"
                >
                  <div onClick={() => router.push(`/accounts/${acc.id}`)} className="flex items-center gap-4 flex-1 cursor-pointer">
                    <BankLogo color={acc.color} name={acc.name} size="md" />
                    <div>
                      <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">{acc.name}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mt-0.5">Conta Corrente</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteAccount(acc.id)
                      }}
                      className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors p-1"
                      title="Excluir conta"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="text-right">
                      <p className={`font-bold text-[14px] ${balanceColorClass}`}>
                         {hideBalance ? '••••' : `R$ ${bal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL DE CRIAÇÃO */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => {
          setShowForm(false)
          setShowBankDropdown(false)
          setBankSearch('')
        }}>
          <div className="bg-white dark:bg-slate-800 rounded-t-[32px] sm:rounded-[24px] w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom-10 overflow-y-auto max-h-[85vh]" onClick={e => e.stopPropagation()}>
            
            <div className="flex items-center gap-4 mb-6">
              {selectedBank ? (
                <BankLogo color={selectedBank.color} name={selectedBank.name} size="lg" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                  <Building size={28} className="text-gray-400 dark:text-gray-500" />
                </div>
              )}
              <div className="flex-1">
                <h2 className="font-bold text-[18px] text-gray-800 dark:text-gray-100">
                  {selectedBank ? selectedBank.name : 'Nova Conta'}
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">Preencha os dados abaixo</p>
              </div>
              <button onClick={() => {
                setShowForm(false)
                setShowBankDropdown(false)
                setBankSearch('')
                setSelectedBank(null)
              }} className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 self-start">
                <X size={20}/>
              </button>
            </div>

            <div className="relative mb-5">
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Buscar banco
              </label>
              <div className="flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl border border-gray-100 dark:border-slate-600 overflow-hidden">
                <Search size={16} className="ml-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <input
                  value={bankSearch}
                  onChange={e => handleBankSearch(e.target.value)}
                  onFocus={() => {
                    if (filteredBanks.length > 0) setShowBankDropdown(true)
                  }}
                  placeholder="Digite o nome do banco..."
                  className="w-full bg-transparent py-3 px-3 text-sm outline-none font-medium text-gray-800 dark:text-gray-200 placeholder:text-gray-400"
                />
                {bankSearch && (
                  <button
                    onClick={() => {
                      setBankSearch('')
                      setFilteredBanks([])
                      setShowBankDropdown(false)
                    }}
                    className="p-2 mr-1 text-gray-400 dark:text-gray-500 hover:text-gray-600"
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

            <div className="mb-5">
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Nome da conta
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Minha Conta Principal"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl py-3 px-4 text-sm font-bold text-gray-800 dark:text-gray-200 outline-none focus:border-teal-500 transition-colors"
              />
            </div>
            
            <div className="mb-5">
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Cor</label>
              <div className="flex flex-wrap gap-3">
                {DEFAULT_COLORS.map(c => (
                  <button 
                    key={c} 
                    onClick={() => setColor(c)} 
                    className="w-9 h-9 rounded-full transition-all duration-200" 
                    style={{ 
                      backgroundColor: c,
                      transform: color === c ? 'scale(1.2)' : 'scale(1)',
                      boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : 'none'
                    }} 
                  />
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Saldo inicial</label>
              <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4 flex items-center gap-2 border border-gray-100 dark:border-slate-600">
                <span className="text-gray-400 dark:text-gray-500 font-bold text-lg">R$</span>
                <input 
                  type="text" 
                  inputMode="numeric" 
                  value={displayBalance} 
                  onChange={handleBalanceChange} 
                  placeholder="0,00" 
                  className="w-full bg-transparent text-2xl font-light text-gray-800 dark:text-gray-200 outline-none" 
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-8 bg-gray-50 dark:bg-slate-700 p-4 rounded-xl">
              <div>
                <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Permitir saldo negativo</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Limite / Cheque especial</p>
              </div>
              <button
                onClick={() => setAllowNegative(!allowNegative)}
                className={`w-12 h-7 rounded-full relative transition-colors ${allowNegative ? 'bg-teal-700' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${allowNegative ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <button 
              onClick={handleSave} 
              disabled={loading || !name.trim()} 
              className="w-full bg-teal-700 hover:bg-teal-800 text-white py-4 rounded-2xl font-bold text-[15px] disabled:opacity-50 transition-colors shadow-lg shadow-teal-700/20 flex justify-center items-center"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'Criar Conta'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE REORDENAÇÃO */}
      {showReorderModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowReorderModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-t-[32px] sm:rounded-[24px] w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100">Reordenar contas</h2>
              <button onClick={() => setShowReorderModal(false)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Use as setas para organizar a ordem das contas na tela inicial.</p>
            <div className="space-y-2">
              {reorderList.map((acc, index) => (
                <div
                  key={acc.id}
                  className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 transition-all duration-300"
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveItem(index, 'up')}
                      disabled={index === 0}
                      className="p-0.5 text-gray-400 disabled:opacity-30 hover:text-gray-600"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => moveItem(index, 'down')}
                      disabled={index === reorderList.length - 1}
                      className="p-0.5 text-gray-400 disabled:opacity-30 hover:text-gray-600"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                  <BankLogo color={acc.color} name={acc.name} size="sm" />
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{acc.name}</span>
                  <ArrowUp size={16} className="text-gray-400" />
                </div>
              ))}
            </div>
            <button
              onClick={saveReorder}
              className="w-full mt-6 bg-teal-700 text-white py-3 rounded-xl font-bold text-sm hover:bg-teal-800 transition-colors"
            >
              Salvar ordem
            </button>
          </div>
        </div>
      )}
    </div>
  )
}