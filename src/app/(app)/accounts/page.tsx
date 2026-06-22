'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, GripVertical, Loader2, X } from 'lucide-react'

const DEFAULT_COLORS = ['#dc2626', '#16a34a', '#0284c7', '#8b5cf6', '#111827', '#f59e0b', '#ec4899', '#64748b']

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [accounts, setAccounts] = useState<any[]>([])
  const [context, setContext] = useState<'personal' | 'dfl'>('personal')
  const [loading, setLoading] = useState(true)
  
  // Estados do Modal de Criação
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLORS[0])
  const [displayBalance, setDisplayBalance] = useState('')
  const [balanceNum, setBalanceNum] = useState(0)

  // Máscara de Real para o Saldo Inicial
  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    const num = Number(rawValue) / 100
    setBalanceNum(num)
    setDisplayBalance(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  const loadAccounts = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
      .order('name')
    
    setAccounts(data ?? [])
    setLoading(false)
  }, [user, context])

  useEffect(() => { 
    loadAccounts() 
  }, [loadAccounts])

  const handleSave = async () => {
    if (!name.trim()) return
    setLoading(true)
    const data = { 
      user_id: user?.id, 
      name: name.trim(), 
      balance: balanceNum, 
      context, 
      color 
    }
    
    await supabase.from('accounts').insert(data)
    
    // Limpa o formulário e fecha o modal
    setShowForm(false)
    setName('')
    setDisplayBalance('')
    setBalanceNum(0)
    setColor(DEFAULT_COLORS[0])
    
    loadAccounts()
  }

  const totalBalance = accounts.reduce((acc, curr) => acc + Number(curr.balance), 0)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] pb-24 font-sans relative">
      
      {/* Header */}
      <div className="p-4 flex items-center justify-between bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="text-gray-800">
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-bold text-lg text-gray-800">Contas</h1>
        <button 
          onClick={() => setShowForm(true)} 
          className="text-teal-700 hover:text-teal-800 transition-colors"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Saldo Total e Toggle */}
      <div className="p-4">
        <div className="bg-white rounded-3xl p-6 shadow-sm mb-6 border border-gray-100 text-center">
          <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-1">Saldo total</p>
          <p className="text-3xl font-light text-gray-800">
            R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="flex bg-gray-200 rounded-full p-1 mb-6">
          <button 
            onClick={() => setContext('dfl')} 
            className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${context === 'dfl' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
          >
            DFL
          </button>
          <button 
            onClick={() => setContext('personal')} 
            className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${context === 'personal' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
          >
            Pessoal
          </button>
        </div>
      </div>

      {/* Lista de Contas */}
      <div className="px-4 space-y-3">
        {loading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="animate-spin text-teal-700" size={32} />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center p-6 text-gray-400 text-sm">
            Nenhuma conta encontrada neste contexto.
          </div>
        ) : (
          accounts.map((acc) => (
            <div 
              key={acc.id} 
              onClick={() => router.push(`/accounts/${acc.id}`)}
              className="bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <GripVertical className="text-gray-300 cursor-grab" size={20} />
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-sm" 
                  style={{ backgroundColor: acc.color }}
                >
                  {acc.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-[14px] text-gray-800">{acc.name}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-0.5">Conta Corrente</p>
                </div>
              </div>
              <p className={`font-bold text-[14px] ${Number(acc.balance) >= 0 ? 'text-teal-700' : 'text-red-500'}`}>
                R$ {Number(acc.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Modal de Criação */}
      {showForm && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" 
          onClick={() => setShowForm(false)}
        >
          <div 
            className="bg-white rounded-[24px] w-full max-w-sm p-6 shadow-2xl" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-xl text-gray-800">Nova Conta</h2>
              <button 
                onClick={() => setShowForm(false)} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20}/>
              </button>
            </div>
            
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Nome</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Ex: Nubank, Inter" 
              className="w-full bg-gray-50 p-4 rounded-2xl mb-6 font-bold text-gray-800 outline-none focus:ring-2 focus:ring-teal-500 transition-all" 
            />
            
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Cor da Conta</label>
            <div className="flex flex-wrap gap-3 mb-6 items-center">
              {DEFAULT_COLORS.map(c => (
                <button 
                  key={c} 
                  onClick={() => setColor(c)} 
                  className={`w-10 h-10 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'}`} 
                  style={{ backgroundColor: c, ringColor: c }} 
                />
              ))}
              <label className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                <Plus size={18} className="text-gray-400" />
                <input type="color" className="hidden" onChange={(e) => setColor(e.target.value)} />
              </label>
            </div>

            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Saldo Inicial (R$)</label>
            <input 
              type="text" 
              inputMode="numeric"
              value={displayBalance} 
              onChange={handleBalanceChange} 
              placeholder="0,00" 
              className="w-full bg-gray-50 p-4 rounded-2xl mb-8 font-bold text-lg text-gray-800 outline-none focus:ring-2 focus:ring-teal-500 transition-all" 
            />
            
            <button 
              onClick={handleSave} 
              className="w-full bg-teal-700 hover:bg-teal-800 text-white py-4 rounded-2xl font-bold flex justify-center items-center transition-colors"
            >
              Salvar Conta
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
