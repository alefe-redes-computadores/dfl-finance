'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

const ICONS = ['🛒','🏍️','💸','🔧','📦','💰','🛵','🍔','🚗','❤️','🎮','🏠','💼','💻','📋','🎯','⚡','🎵']
const COLORS = ['#16a34a','#dc2626','#ea580c','#0891b2','#7c3aed','#ca8a04','#94a3b8','#ec4899','#14b8a6']

export default function CategoriesPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [categories, setCategories] = useState<any[]>([])
  const [tab, setTab] = useState<'expense'|'income'>('expense')
  const [context, setContext] = useState<'dfl'|'personal'>('dfl')
  
  // Estados do Modal
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📋')
  const [color, setColor] = useState('#16a34a')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) loadCategories()
  }, [user, tab, context])

  async function loadCategories() {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user!.id)
      .eq('type', tab)
      .eq('context', context)
      .order('name', { ascending: true })

    setCategories(data ?? [])
  }

  function openEdit(cat: any) {
    if (cat.is_default) return; // Bloqueia edição de categorias padrão
    setEditingCategory(cat)
    setName(cat.name)
    setIcon(cat.icon)
    setColor(cat.color)
    setShowForm(true)
  }

  async function handleSave() {
    if (!name) return
    setSaving(true)

    if (editingCategory) {
      await supabase.from('categories').update({ name, icon, color }).eq('id', editingCategory.id)
    } else {
      await supabase.from('categories').insert({
        user_id: user!.id, name, icon, color, type: tab, context, is_default: false, sort_order: 999
      })
    }

    setName(''); setEditingCategory(null); setShowForm(false); setSaving(false)
    loadCategories()
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await supabase.from('categories').delete().eq('id', id)
    loadCategories()
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ChevronLeft size={24} className="text-gray-700" /></button>
          <h1 className="text-xl font-bold text-gray-900">Categorias</h1>
        </div>
        <button onClick={() => { setEditingCategory(null); setShowForm(true); }} className="w-9 h-9 bg-brand-teal rounded-full flex items-center justify-center">
          <Plus size={20} className="text-white" />
        </button>
      </div>

      {/* Tabs de Contexto e Tipo */}
      <div className="flex bg-gray-100 rounded-full p-1 gap-1 mb-4 w-fit">
        {(['dfl','personal'] as const).map(c => (
          <button key={c} onClick={() => setContext(c)} className={`px-4 py-1.5 rounded-full text-xs font-semibold ${context===c ? 'bg-white shadow-sm' : 'text-gray-500'}`}>{c==='dfl'?'DFL':'Pessoal'}</button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-4 shadow-xl border border-gray-100 mb-6 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-bold">{editingCategory ? 'Editar categoria' : 'Nova categoria'}</p>
            <button onClick={() => setShowForm(false)}><X size={18}/></button>
          </div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome" className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-sm outline-none" />
          <div className="flex flex-wrap gap-2">
            {ICONS.map(i => <button key={i} onClick={() => setIcon(i)} className={`w-9 h-9 rounded-xl ${icon===i ? 'bg-brand-teal' : 'bg-gray-100'}`}>{i}</button>)}
          </div>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full ${color===c ? 'ring-2' : ''}`} style={{ backgroundColor: c }} />)}
          </div>
          <button onClick={handleSave} className="w-full bg-brand-teal text-white rounded-xl py-3 text-sm font-semibold">{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      )}

      <div className="space-y-2">
        {categories.map(cat => (
          <div key={cat.id} onClick={() => openEdit(cat)} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 cursor-pointer border border-transparent hover:border-gray-200">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: `${cat.color}20` }}>{cat.icon}</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{cat.name}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${cat.is_default ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                {cat.is_default ? 'Padrão' : 'Personalizada'}
              </span>
            </div>
            {!cat.is_default && (
              <button onClick={(e) => handleDelete(cat.id, e)}><Trash2 size={16} className="text-red-400" /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
