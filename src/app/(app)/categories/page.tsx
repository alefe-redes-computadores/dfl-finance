'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { 
  ChevronLeft, Plus, Trash2, X, ChevronDown, ChevronRight,
  // Ícones premium
  Home, Utensils, Car, HeartPulse, GraduationCap, Gamepad2, Shirt,
  Smile, Repeat, Wrench, Dog, FileText, Shield, Gift, MoreHorizontal,
  Briefcase, Laptop, TrendingUp, ShoppingCart, ReceiptIcon, Zap, Music
} from 'lucide-react'
import { useRouter } from 'next/navigation'

// Mapa de Ícones do Lucide
const ICON_MAP: Record<string, React.ElementType> = {
  home: Home, utensils: Utensils, car: Car, heart: HeartPulse, 
  graduation: GraduationCap, gamepad: Gamepad2, shirt: Shirt, 
  smile: Smile, repeat: Repeat, wrench: Wrench, dog: Dog, 
  file: FileText, shield: Shield, gift: Gift, briefcase: Briefcase, 
  laptop: Laptop, trending: TrendingUp, shopping: ShoppingCart, 
  receipt: ReceiptIcon, zap: Zap, music: Music, other: MoreHorizontal
}
const CATEGORY_ICON_NAMES = Object.keys(ICON_MAP)

const COLORS = ['#16a34a','#dc2626','#ea580c','#0891b2','#7c3aed','#ca8a04','#94a3b8','#ec4899','#14b8a6']

const DEFAULT_CATEGORIES = [
  { name:'Insumos', icon:'shopping', color:'#16a34a', type:'expense', context:'dfl', sort_order:1 },
  { name:'Embalagens', icon:'gift', color:'#0891b2', type:'expense', context:'dfl', sort_order:2 },
  { name:'Fornecedores', icon:'briefcase', color:'#ea580c', type:'expense', context:'dfl', sort_order:3 },
  { name:'Marketing', icon:'trending', color:'#ec4899', type:'expense', context:'dfl', sort_order:4 },
  { name:'Manutenção', icon:'wrench', color:'#ca8a04', type:'expense', context:'dfl', sort_order:5 },

  { name:'Vendas', icon:'shopping', color:'#16a34a', type:'income', context:'dfl', sort_order:1 },
  { name:'Delivery', icon:'car', color:'#0891b2', type:'income', context:'dfl', sort_order:2 },
  { name:'Eventos', icon:'music', color:'#ec4899', type:'income', context:'dfl', sort_order:3 },

  { name:'Moradia', icon:'home', color:'#ca8a04', type:'expense', context:'personal', sort_order:1 },
  { name:'Alimentação', icon:'utensils', color:'#16a34a', type:'expense', context:'personal', sort_order:2 },
  { name:'Transporte', icon:'car', color:'#0891b2', type:'expense', context:'personal', sort_order:3 },
  { name:'Saúde', icon:'heart', color:'#dc2626', type:'expense', context:'personal', sort_order:4 },
  { name:'Lazer', icon:'gamepad', color:'#7c3aed', type:'expense', context:'personal', sort_order:5 },

  { name:'Salário', icon:'briefcase', color:'#16a34a', type:'income', context:'personal', sort_order:1 },
  { name:'Freelance', icon:'laptop', color:'#0891b2', type:'income', context:'personal', sort_order:2 },
  { name:'Investimentos', icon:'trending', color:'#ca8a04', type:'income', context:'personal', sort_order:3 },
]

export default function CategoriesPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [categories, setCategories] = useState<any[]>([])
  const [subcategories, setSubcategories] = useState<Record<string, any[]>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'expense'|'income'>('expense')
  const [context, setContext] = useState<'dfl'|'personal'>('dfl')
  
  // Estados do Modal
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('other')
  const [color, setColor] = useState('#16a34a')
  const [parentId, setParentId] = useState<string | null>(null) // NOVO
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
    if (!user) return
    const { data: existing } = await supabase
      .from('categories')
      .select('name,type,context')
      .match({ user_id: user.id })

    const existingKeys = new Set(
      (Array.isArray(existing) ? existing : []).map(
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
        user_id: user.id,
        is_default: true,
      }))
    )
  }

  async function loadCategories() {
    if (!user) return
    
    // Carrega categorias principais (parent_id IS NULL)
    const { data: mainCats } = await supabase
      .from('categories')
      .select('*')
      .match({ user_id: user.id, type: tab, context: context })
      .is('parent_id', null)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    // Carrega TODAS as subcategorias deste contexto/tipo
    const { data: allSubs } = await supabase
      .from('categories')
      .select('*')
      .match({ user_id: user.id, type: tab, context: context })
      .not('parent_id', 'is', null)
      .order('name', { ascending: true })

    // Organiza subcategorias por parent_id
    const subsMap: Record<string, any[]> = {}
    if (Array.isArray(allSubs)) {
      allSubs.forEach(sub => {
        const key = sub.parent_id
        if (!subsMap[key]) subsMap[key] = []
        subsMap[key].push(sub)
      })
    }

    setCategories(Array.isArray(mainCats) ? mainCats : [])
    setSubcategories(subsMap)
  }

  function toggleExpand(catId: string) {
    setExpandedId(expandedId === catId ? null : catId)
  }

  function openEdit(cat: any) {
    if (cat.is_default) return
    setEditingCategory(cat)
    setName(cat.name)
    setIcon(cat.icon)
    setColor(cat.color)
    setParentId(cat.parent_id || null)
    setShowForm(true)
  }

  function openNew(parentId: string | null = null) {
    setEditingCategory(null)
    setName('')
    setIcon('other')
    setColor('#16a34a')
    setParentId(parentId)
    setShowForm(true)
  }

  async function handleSave() {
    if (!name) return
    setSaving(true)

    const payload = {
      name,
      icon,
      color,
      type: tab,
      context,
      parent_id: parentId, // NOVO
      user_id: user!.id,
      is_default: false,
      sort_order: 999,
    }

    if (editingCategory) {
      await supabase.from('categories').update(payload).eq('id', editingCategory.id)
    } else {
      await supabase.from('categories').insert(payload)
    }

    setName('')
    setEditingCategory(null)
    setParentId(null)
    setShowForm(false)
    setSaving(false)
    loadCategories()
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Deseja excluir esta categoria?')) return
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
          onClick={() => openNew()}
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
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm mb-4 space-y-4 relative border border-gray-100 dark:border-zinc-800">
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

          {/* Campo de Categoria Pai (NOVO) */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Categoria pai (opcional)</label>
            <select
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-sm outline-none text-gray-800 dark:text-white"
            >
              <option value="">Nenhuma (categoria principal)</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">Ícone</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ICON_NAMES.map(iconName => {
                const IconComp = ICON_MAP[iconName]
                const isSelected = icon === iconName
                return (
                  <button 
                    key={iconName} 
                    onClick={() => setIcon(iconName)}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${isSelected ? 'scale-110 shadow-md' : 'hover:bg-gray-100 dark:hover:bg-zinc-700'}`}
                    style={isSelected ? { backgroundColor: `${color}20`, color: color } : { backgroundColor: 'transparent', color: '#9ca3af' }}
                  >
                    <IconComp size={20} />
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color===c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !name}
            className="w-full bg-brand-teal text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 mt-2"
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
          {categories.map(cat => {
            const IconComp = ICON_MAP[cat.icon] || ICON_MAP['other']
            const subCount = subcategories[cat.id]?.length || 0
            const isExpanded = expandedId === cat.id
            
            return (
              <div key={cat.id}>
                {/* Categoria principal */}
                <div
                  onClick={() => toggleExpand(cat.id)}
                  className={`bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 border border-transparent cursor-pointer hover:border-gray-200`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                    >
                      <IconComp size={20} />
                    </div>

                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-white">
                        {cat.name}
                      </p>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${
                            cat.is_default ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          }`}
                        >
                          {cat.is_default ? 'Padrão' : 'Personalizada'}
                        </span>
                        {subCount > 0 && (
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                            {subCount} subcategoria{subCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!cat.is_default && (
                        <button onClick={(e) => handleDelete(cat.id, e)} className="p-1">
                          <Trash2 size={16} className="text-red-400 hover:text-red-600 transition-colors" />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); openEdit(cat); }} className="p-1">
                        <ChevronRight size={18} className="text-gray-400" />
                      </button>
                      {isExpanded ? 
                        <ChevronDown size={18} className="text-gray-400" /> : 
                        <ChevronRight size={18} className="text-gray-400" />
                      }
                    </div>
                  </div>
                </div>

                {/* Subcategorias (expandidas) */}
                {isExpanded && (
                  <div className="ml-6 mt-1 space-y-1">
                    {subcategories[cat.id]?.map((sub: any) => {
                      const SubIconComp = ICON_MAP[sub.icon] || ICON_MAP['other']
                      return (
                        <div
                          key={sub.id}
                          onClick={() => openEdit(sub)}
                          className={`bg-white dark:bg-zinc-900 rounded-xl px-4 py-2.5 shadow-sm flex items-center gap-3 border border-transparent ${!sub.is_default ? 'cursor-pointer hover:border-gray-200' : ''}`}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                            style={{ backgroundColor: `${sub.color}20`, color: sub.color }}
                          >
                            <SubIconComp size={16} />
                          </div>
                          <span className="text-sm font-medium text-gray-800 dark:text-white flex-1">
                            {sub.name}
                          </span>
                          {!sub.is_default && (
                            <button onClick={(e) => handleDelete(sub.id, e)} className="p-1">
                              <Trash2 size={14} className="text-red-400 hover:text-red-600 transition-colors" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                    <button
                      onClick={() => openNew(cat.id)}
                      className="w-full bg-gray-50 dark:bg-zinc-800 rounded-xl px-4 py-2.5 flex items-center gap-3 text-gray-500 hover:text-teal-700 hover:bg-gray-100 transition-colors"
                    >
                      <Plus size={16} />
                      <span className="text-xs font-medium">Adicionar subcategoria</span>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}