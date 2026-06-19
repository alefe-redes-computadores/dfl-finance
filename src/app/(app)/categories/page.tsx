'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2, Landmark } from 'lucide-react'

const BANKS = [
  { slug: 'carteira', name: 'Carteira', color: '#16a34a', emoji: '👛' },
  { slug: 'inter', name: 'Inter', color: '#ea580c', emoji: '🟠' },
  { slug: 'stone', name: 'Stone PJ', color: '#00a868', emoji: '🟢' },
  { slug: 'nubank', name: 'Nubank', color: '#820ad1', emoji: '🟣' },
  { slug: 'bradesco', name: 'Bradesco', color: '#dc2626', emoji: '🔴' },
  { slug: 'itau', name: 'Itaú', color: '#ca8a04', emoji: '🟡' },
  { slug: 'caixa', name: 'Caixa', color: '#0284c7', emoji: '🏦' },
]

const COLORS = ['#16a34a','#dc2626','#ea580c','#0891b2','#7c3aed','#ca8a04','#94a3b8','#ec4899','#14b8a6']

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
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user!.id).eq('context', context).order('name')
    setAccounts(data ?? [])
  }

  async function handleSave() {
    if (!name) return
    await supabase.from('accounts').insert({
      user_id: user!.id, name, bank_slug: bankSlug, 
      balance: parseInt(rawBalance || '0', 10) / 100, context, color
    })
    setName(''); setShowForm(false); loadAccounts()
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 p-4 font-sans text-sm">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()}><ChevronLeft size={24} /></button>
        <h1 className="text-base font-bold">Contas</h1>
        <button onClick={() => setShowForm(true)} className="bg-emerald-900 text-white p-2 rounded-full"><Plus size={20} /></button>
      </div>

      <div className="flex bg-slate-200 p-1 rounded-xl mb-6">
        <button onClick={() => setContext('personal')} className={`flex-1 py-2 rounded-lg font-bold transition ${context === 'personal' ? 'bg-white shadow' : 'text-slate-500'}`}>Pessoal</button>
        <button onClick={() => setContext('dfl')} className={`flex-1 py-2 rounded-lg font-bold transition ${context === 'dfl' ? 'bg-white shadow' : 'text-slate-500'}`}>Jurídica</button>
      </div>

      <div className="space-y-3">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-white p-3 rounded-2xl flex items-center gap-3 border border-slate-100 shadow-sm">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: `${acc.color}20`, color: acc.color }}><Landmark size={20}/></div>
            <div className="flex-1"><p className="font-bold">{acc.name}</p></div>
            <p className="font-bold">{Number(acc.balance).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            <button onClick={() => supabase.from('accounts').delete().eq('id', acc.id).then(loadAccounts)}><Trash2 size={16} className="text-red-300" /></button>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold mb-4">Nova Conta</h2>
            
            <div className="grid grid-cols-4 gap-4 mb-6">
              {BANKS.map(b => (
                <button key={b.slug} onClick={() => { setBankSlug(b.slug); setName(b.name); setColor(b.color) }} className="flex flex-col items-center gap-1">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${bankSlug === b.slug ? 'border-emerald-900' : 'border-transparent'}`} style={{ backgroundColor: b.color + '20' }}>{b.emoji}</div>
                  <span className="text-[10px] text-center w-full truncate">{b.name}</span>
                </button>
              ))}
            </div>

            {/* SELETOR DE CORES ADICIONADO AQUI */}
            <div className="mb-6">
              <label className="text-xs text-gray-500 mb-2 block font-bold">Personalizar cor de destaque</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 ${color===c?'border-black':'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>

            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da conta" className="w-full bg-slate-50 p-4 rounded-xl mb-3 text-sm" />
            <input value={(parseInt(rawBalance || '0', 10) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} onChange={(e) => setRawBalance(e.target.value.replace(/\D/g, ''))} className="w-full bg-slate-50 p-4 rounded-xl mb-6 font-bold text-lg" />
            <button onClick={handleSave} className="w-full bg-emerald-900 text-white py-4 rounded-xl font-bold">Salvar conta</button>
          </div>
        </div>
      )}
    </div>
  )
}
