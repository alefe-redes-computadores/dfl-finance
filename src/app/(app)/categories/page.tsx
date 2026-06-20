'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

const ICONS = ['🛒','🏍️','💸','🔧','📦','💰','🛵','🍔','🚗','❤️','🎮','🏠','💼','💻','📋','🎯','⚡','🎵']
const COLORS = ['#16a34a','#dc2626','#ea580c','#0891b2','#7c3aed','#ca8a04','#94a3b8','#ec4899','#14b8a6']

const DEFAULT_CATEGORIES = [
  { name:'Insumos', icon:'📦', color:'#16a34a', type:'expense', context:'dfl', sort_order:1 },
  { name:'Embalagens', icon:'🥤', color:'#0891b2', type:'expense', context:'dfl', sort_order:2 },
  { name:'Fornecedores', icon:'🚚', color:'#ea580c', type:'expense', context:'dfl', sort_order:3 },
  { name:'Marketing', icon:'🎯', color:'#ec4899', type:'expense', context:'dfl', sort_order:4 },
  { name:'Manutenção', icon:'🔧', color:'#ca8a04', type:'expense', context:'dfl', sort_order:5 },

  { name:'Vendas', icon:'🍔', color:'#16a34a', type:'income', context:'dfl', sort_order:1 },
  { name:'Delivery', icon:'🛵', color:'#0891b2', type:'income', context:'dfl', sort_order:2 },
  { name:'Eventos', icon:'🎵', color:'#ec4899', type:'income', context:'dfl', sort_order:3 },

  { name:'Moradia', icon:'🏠', color:'#ca8a04', type:'expense', context:'personal', sort_order:1 },
  { name:'Alimentação', icon:'🛒', color:'#16a34a', type:'expense', context:'personal', sort_order:2 },
  { name:'Transporte', icon:'🚗', color:'#0891b2', type:'expense', context:'personal', sort_order:3 },
  { name:'Saúde', icon:'❤️', color:'#dc2626', type:'expense', context:'personal', sort_order:4 },
  { name:'Lazer', icon:'🎮', color:'#7c3aed', type:'expense', context:'personal', sort_order:5 },

  { name:'Salário', icon:'💼', color:'#16a34a', type:'income', context:'personal', sort_order:1 },
  { name:'Freelance', icon:'💻', color:'#0891b2', type:'income', context:'personal', sort_order:2 },
  { name:'Investimentos', icon:'💰', color:'#ca8a04', type:'income', context:'personal', sort_order:3 },
]

export default function CategoriesPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [categories, setCategories] = useState<any[]>([])
  const [tab, setTab] = useState<'expense'|'income'>('expense')
  const [context, setContext] = useState<'dfl'|'personal'>('dfl')
  
  // Estados do Modal
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any | null>(null) // NOVO
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📋')
  const [color, setColor] = useState('#16a34a')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      initialize()
    }
  }, [user, tab, context])

  async function initialize() {
    await ensureDefaultCategories()
    await loadCategories()
  }

  async function ensureDefaultCategories() {
    const { data: existing } = await supabase
      .from('categories')
      .select('name,type,context')
      .eq('user_id', user!.id)

    const existingKeys = new Set(
      (existing ?? []).map(
        c => `${c.name}-${c.type}-${c.context}`
      )
    )

    const missing = DEFAULT_CATEGORIES.filter(
      cat =>
        !existingKeys.has(
          `${cat.name}-${cat.type}-${cat.context}`
        )
    )

    if (!missing.length) return

    await supabase.from('categories').insert(
      missing.map(cat => ({
        ...cat,
        user_id: user!.id,
        is_default: true,
      }))
    )
  }

  async function loadCategories() {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user!.id)
      .eq('type', tab)
      .eq('context', context)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    setCategories(data ?? [])
  }

  // NOVO: Função para abrir modal de edição
  function openEdit(cat: any) {
    if (cat.is_default) return; 
    setEditingCategory(cat)
    setName(cat.name)
    setIcon(cat.icon)
    setColor(cat.color)
    setShowForm(true)
  }

  async function handleSave() {
    if (!name) return
    setSaving(true)

    // NOVO: Logica de Update vs Insert
    if (editingCategory) {
      await supabase.from('categories').update({
        name, icon, color
      }).eq('id', editingCategory.id)
    } else {
      await supabase.from('categories').insert({
        user_id: user!.id,
        name,
        icon,
        color,
        type: tab,
        context,
        is_default: false,
        sort_order: 999,
      })
    }

    setName('')
    setEditingCategory(null)
    setShowForm(false)
    setSaving(false)
    loadCategories()
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation() // NOVO: Evita clicar no delete e abrir a edição junto
    await supabase.from('categories').delete().eq('id', id)
    loadCategories()
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}>
            <ChevronLeft size={24} className="text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Categorias</h1>
        </div>

        <button
          onClick={() => { setEditingCategory(null); setName(''); setShowForm(!showForm); }}
          className="w-9 h-9 bg-brand-teal rounded-full flex items-center justify-center"
        >
          <Plus size={20} className="text-white" />
        </button>
      </div>

      <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-full p-1 gap-1 mb-4 w-fit">
        {(['dfl','personal'] as const).map(c => (
          <button
            key={c}
            onClick={() => setContext(c)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              context===c ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
            }`}
          >
            {c==='dfl'?'DFL':'Pessoal'}
          </button>
        ))}
      </div>

      <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-full p-1 gap-1 mb-4">
        {([['expense','Despesas'],['income','Receitas']] as const).map(([k,l]) => (
          <button
            key={k}
            onClick={() => setTab(k as any)}
            className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all ${
              tab===k ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm mb-4 space-y-3 relative border border-gray-100 dark:border-zinc-800">
          <div className="flex justify-between items-center mb-2">
             <p className="text-sm font-semibold text-gray-800 dark:text-white">
              {editingCategory ? 'Editar categoria' : 'Nova categoria'}
            </p>
            <button onClick={() => { setShowForm(false); setEditingCategory(null); }} className="text-gray-400"><X size={18}/></button>
          </div>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome da categoria"
            className="w-full bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-sm outline-none text-gray-800 dark:text-white"
          />

          <div>
            <label className="text-xs text-gray-500 mb-2 block">Ícone</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(i => (
                <button
                  key={i}
                  onClick={() => setIcon(i)}
                  className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center ${
                    icon===i ? 'bg-brand-teal' : 'bg-gray-100 dark:bg-zinc-800'
                  }`}
                >
                  {i}
             </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    color===c ? 'border-gray-800 dark:border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !name}
            className="w-full bg-brand-teal text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar categoria'}
          </button>
        </div>
      )}

      {categories.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <span className="text-4xl mb-3">🏷️</span>
          <p className="text-sm font-medium">Nenhuma categoria</p>
          <p className="text-xs mt-1">Clique no + para adicionar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => (
            <div
              key={cat.id}
              onClick={() => openEdit(cat)} // NOVO: Clique no card para editar
              className={`bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 border border-transparent ${!cat.is_default ? 'cursor-pointer hover:border-gray-200' : ''}`}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ backgroundColor: `${cat.color}20` }}
              >
                {cat.icon}
              </div>

              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800 dark:text-white">
                  {cat.name}
                </p>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    cat.is_default ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}
                >
                  {cat.is_default ? 'Padrão' : 'Personalizada'}
                </span>
              </div>

              {!cat.is_default && (
                <button onClick={(e) => handleDelete(cat.id, e)}>
                  <Trash2 size={16} className="text-red-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
