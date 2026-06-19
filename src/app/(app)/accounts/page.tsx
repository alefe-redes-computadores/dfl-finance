'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Edit2, ChevronRight, ArrowLeftRight, Scale, Trash2, X } from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const DEFAULT_COLORS = ['#dc2626', '#16a34a', '#0284c7', '#8b5cf6', '#111827', '#f59e0b', '#ec4899', '#64748b']

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [accounts, setAccounts] = useState<any[]>([])
  const [context, setContext] = useState<'personal' | 'dfl'>('personal')
  const [showForm, setShowForm] = useState(false)
  
  // Estados do Formulário
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLORS[0])
  const [displayBalance, setDisplayBalance] = useState('')
  const [balanceNum, setBalanceNum] = useState(0)

  // Máscara de Real para o Saldo
  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    const num = Number(rawValue) / 100
    setBalanceNum(num)
    setDisplayBalance(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }

  const loadAccounts = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user.id).eq('context', context).order('name')
    setAccounts(data ?? [])
  }, [user, context])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  const handleSave = async () => {
    if (!name.trim()) return
    const data = { user_id: user?.id, name: name.trim(), balance: balanceNum, context, color }
    if (editingId) await supabase.from('accounts').update(data).eq('id', editingId)
    else await supabase.from('accounts').insert(data)
    setShowForm(false)
    loadAccounts()
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 px-4 pt-6 pb-24 font-sans">
      <div className="flex justify-between mb-6 items-center">
        <button onClick={() => router.back()}><ChevronLeft size={24}/></button>
        <h1 className="text-xl font-bold">Contas</h1>
        <button onClick={() => { setShowForm(true); setEditingId(null); setName(''); setDisplayBalance(''); }}><Plus size={24}/></button>
      </div>

      {/* Toggle PJ/Pessoal */}
      <div className="flex bg-gray-200 rounded-full p-1 mb-6">
        <button onClick={() => setContext('dfl')} className={`flex-1 py-2 rounded-full font-bold ${context === 'dfl' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>DFL</button>
        <button onClick={() => setContext('personal')} className={`flex-1 py-2 rounded-full font-bold ${context === 'personal' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>Pessoal</button>
      </div>

      {/* Modal de Criação/Edição */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4"><h2 className="font-bold text-xl">{editingId ? 'Editar' : 'Nova Conta'}</h2><button onClick={() => setShowForm(false)}><X size={20}/></button></div>
            
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da Conta" className="w-full bg-gray-100 p-3 rounded-xl mb-4 font-bold" />
            
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              {DEFAULT_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full ${color === c ? 'ring-2 ring-offset-2' : ''}`} style={{backgroundColor: c}} />
              ))}
              {/* Botão de Cor Personalizada (Abre seletor RGB) */}
              <label className="w-8 h-8 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center cursor-pointer">
                <Plus size={16} className="text-gray-400" />
                <input type="color" className="hidden" onChange={(e) => setColor(e.target.value)} />
              </label>
            </div>

            <input 
              type="text" 
              inputMode="numeric"
              value={displayBalance} 
              onChange={handleBalanceChange} 
              placeholder="R$ 0,00" 
              className="w-full bg-gray-100 p-3 rounded-xl mb-4 font-bold text-lg" 
            />
            
            <button onClick={handleSave} className="w-full bg-emerald-900 text-white py-3 rounded-xl font-bold">Salvar</button>
          </div>
        </div>
      )}

      {/* Lista de Contas */}
      <div className="space-y-3">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: acc.color }}>
                {acc.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="text-left"><h3 className="font-bold text-sm text-gray-800">{acc.name}</h3><p className="text-[10px] font-bold text-gray-400 uppercase">Conta</p></div>
            </div>
            <span className="font-bold text-gray-900">R$ {Number(acc.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
