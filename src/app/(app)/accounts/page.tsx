'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2, Landmark } from 'lucide-react'

// MESMA CONSTANTE DE CORES DA TELA DE CATEGORIAS
const COLORS = ['#16a34a','#dc2626','#ea580c','#0891b2','#7c3aed','#ca8a04','#94a3b8','#ec4899','#14b8a6']

const BANKS = [
  { slug: 'carteira', name: 'Carteira', emoji: '👛' },
  { slug: 'inter', name: 'Inter', emoji: '🟠' },
  { slug: 'stone', name: 'Stone PJ', emoji: '🟢' },
  { slug: 'nubank', name: 'Nubank', emoji: '🟣' },
  { slug: 'bradesco', name: 'Bradesco', emoji: '🔴' },
  { slug: 'itau', name: 'Itaú', emoji: '🟡' },
  { slug: 'caixa', name: 'Caixa', emoji: '🏦' },
]

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [accounts, setAccounts] = useState<any[]>([])
  const [context, setContext] = useState<'personal' | 'dfl'>('personal')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [bankSlug, setBankSlug] = useState('carteira')
  const [color, setColor] = useState('#16a34a')
  const [rawBalance, setRawBalance] = useState('')

  useEffect(() => { if (user) loadAccounts() }, [user, context])

  async function loadAccounts() {
    const { data } = await supabase.from('accounts').select('*')
      .eq('user_id', user!.id).eq('context', context).order('name')
    setAccounts(data ?? [])
  }

  async function handleSave() {
    if (!name) return
    await supabase.from('accounts').insert({
      user_id: user!.id, name, bank_slug: bankSlug, 
      balance: parseInt(rawBalance || '0', 10) / 100, context, color
    })
    setName(''); setRawBalance(''); setShowForm(false); loadAccounts()
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
      {/* HEADER IDÊNTICO AO DE CATEGORIAS */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ChevronLeft size={24} /></button>
          <h1 className="text-xl font-bold">Contas</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="w-9 h-9 bg-brand-teal rounded-full flex items-center justify-center">
          <Plus size={20} className="text-white" />
        </button>
      </div>

      {/* SELETOR DE CONTEXTO (PESSOAL/JURÍDICA) ESTILO CATEGORIAS */}
      <div className="flex bg-gray-100 rounded-full p-1 gap-1 mb-6 w-fit">
        {(['personal', 'dfl'] as const).map(c => (
          <button key={c} onClick={() => setContext(c)}
            className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all ${context===c?'bg-white shadow-sm':'text-gray-500'}`}>
            {c==='personal'?'Pessoal':'Jurídica'}
          </button>
        ))}
      </div>

      {/* MODAL DE CRIAÇÃO (COMPLETO COM SELETOR DE CORES) */}
      {showForm && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 space-y-4">
          <p className="text-sm font-semibold">Nova Conta</p>
          
          <div className="grid grid-cols-4 gap-2">
            {BANKS.map(b => (
              <button key={b.slug} onClick={() => { setBankSlug(b.slug); setName(b.name) }} 
                className={`p-2 rounded-xl flex flex-col items-center gap-1 ${bankSlug===b.slug?'bg-gray-100':''}`}>
                <span className="text-xl">{b.emoji}</span>
                <span className="text-[10px]">{b.name}</span>
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">Cor de Destaque</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 ${color===c?'border-black':'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome" className="w-full bg-gray-100 rounded-xl p-3 text-sm" />
          <input value={(parseInt(rawBalance || '0', 10) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
            onChange={(e) => setRawBalance(e.target.value.replace(/\D/g, ''))} className="w-full bg-gray-100 rounded-xl p-3 font-bold text-lg" />
          
          <button onClick={handleSave} className="w-full bg-brand-teal text-white rounded-xl py-3 text-sm font-semibold">Salvar conta</button>
        </div>
      )}

      {/* LISTA DE CONTAS (FONTE E TAMANHO AJUSTADOS) */}
      <div className="space-y-2">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${acc.color}20`, color: acc.color }}>
              <Landmark size={20} />
            </div>
            <p className="flex-1 text-sm font-medium text-gray-800">{acc.name}</p>
            <p className="text-sm font-bold text-gray-900">{Number(acc.balance).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            <button onClick={() => supabase.from('accounts').delete().eq('id', acc.id).then(loadAccounts)}>
              <Trash2 size={16} className="text-red-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
