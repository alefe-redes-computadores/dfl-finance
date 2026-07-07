'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import * as Icons from 'lucide-react'
import { ChevronLeft, Plus, Trash2, X, ChevronDown, ChevronRight, Tag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import IconPicker from '@/components/IconPicker'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'
import { db, addToSyncQueue } from '@/lib/db' // 🔥 ADICIONADO

const COLORS = ['#16a34a','#dc2626','#ea580c','#0891b2','#7c3aed','#ca8a04','#94a3b8','#ec4899','#14b8a6']

const DEFAULT_CATEGORIES = [
  { name:'Insumos', icon:'ShoppingBag', color:'#16a34a', type:'expense', context:'dfl', sort_order:1 },
  { name:'Embalagens', icon:'Gift', color:'#0891b2', type:'expense', context:'dfl', sort_order:2 },
  { name:'Fornecedores', icon:'Briefcase', color:'#ea580c', type:'expense', context:'dfl', sort_order:3 },
  { name:'Vendas', icon:'ShoppingCart', color:'#16a34a', type:'income', context:'dfl', sort_order:1 },
  { name:'Moradia', icon:'Home', color:'#ca8a04', type:'expense', context:'personal', sort_order:1 },
  { name:'Alimentação', icon:'Utensils', color:'#16a34a', type:'expense', context:'personal', sort_order:2 },
  { name:'Salário', icon:'Briefcase', color:'#16a34a', type:'income', context:'personal', sort_order:1 },
]

export default function CategoriesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { context, appMode } = useContext_() 
  const { showToast } = useToast()

  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const [categories, setCategories] = useState<any[]>([])
  const [subcategories, setSubcategories] = useState<Record<string, any[]>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'expense'|'income'>('expense')

  const [showForm, setShowForm] = useState(false)
  const [showIconModal, setShowIconModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Tag')
  const [color, setColor] = useState('#16a34a')
  const [parentId, setParentId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: localCategories, loading: catLoading, reload: reloadCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context: effectiveContext, type: tab },
  })

  useEffect(() => {
    if (user) {
      ensureDefaultCategories()
      loadCategories()
    }
  }, [user, tab, effectiveContext])

  async function ensureDefaultCategories() {
    if (!user) return
    
    const existingCats = (localCategories || []).filter((c: any) => c.context === effectiveContext)
    const existingKeys = new Set(
      existingCats.map((c: any) => `${c.name}-${c.type}-${c.context}`)
    )

    const missing = DEFAULT_CATEGORIES.filter(
      cat =>
        cat.context === effectiveContext &&
        !existingKeys.has(`${cat.name}-${cat.type}-${cat.context}`)
    )

    if (!missing.length) return

    try {
      for (const cat of missing) {
        const id = crypto.randomUUID()
        const payload = {
          id,
          user_id: user.id,
          ...cat,
          is_default: true,
          parent_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        await db.table('categories').add(payload)
        // 🔥 ADICIONA À FILA DE SINCRONIZAÇÃO
        await addToSyncQueue(user.id, 'categories', 'create', id, payload)
      }
      await reloadCategories()
    } catch (e) {
      console.error("Erro ao criar padrões:", e)
    }
  }

  async function loadCategories() {
    if (!user) return
    await reloadCategories()
    
    const allCats = (localCategories || []) as any[]
    const mainCats = allCats.filter((c: any) => c.type === tab && !c.parent_id)
    const subs = allCats.filter((c: any) => c.type === tab && c.parent_id)

    const subsMap: Record<string, any[]> = {}
    subs.forEach((sub: any) => {
      const key = sub.parent_id
      if (!subsMap[key]) subsMap[key] = []
      subsMap[key].push(sub)
    })

    setCategories(mainCats.sort((a: any, b: any) => (a.sort_order || 999) - (b.sort_order || 999)))
    setSubcategories(subsMap)
  }

  function toggleExpand(catId: string) {
    setExpandedId(expandedId === catId ? null : catId)
  }

  function openEdit(cat: any) {
    if (cat.is_default) return
    setEditingCategory(cat)
    setName(cat.name)
    setColor(cat.color)
    setParentId(cat.parent_id || null)

    if (cat.icon) {
      const formattedIcon = cat.icon.charAt(0).toUpperCase() + cat.icon.slice(1)
      setIcon(formattedIcon)
    } else {
      setIcon('Tag')
    }

    setShowForm(true)
  }

  function openNew(parentId: string | null = null) {
    setEditingCategory(null)
    setName('')
    setIcon('Tag')
    setColor('#16a34a')
    setParentId(parentId)
    setShowForm(true)
  }

  async function handleSave() {
    if (!name || !user) return
    setSaving(true)

    const payload = {
      name,
      icon: icon.toLowerCase(),
      color,
      type: tab,
      context: effectiveContext,
      parent_id: parentId,
      is_default: false,
      sort_order: 999,
      updated_at: new Date().toISOString(),
    }

    try {
      if (editingCategory) {
        // 🔥 ATUALIZA NO INDEXEDDB
        await db.table('categories').update(editingCategory.id, payload)
        // 🔥 ADICIONA À FILA DE SINCRONIZAÇÃO
        await addToSyncQueue(user.id, 'categories', 'update', editingCategory.id, payload)
        showToast('Categoria atualizada!', 'success')
      } else {
        const id = crypto.randomUUID()
        const fullPayload = {
          id,
          user_id: user.id,
          ...payload,
          created_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        await db.table('categories').add(fullPayload)
        await addToSyncQueue(user.id, 'categories', 'create', id, fullPayload)
        showToast('Categoria criada!', 'success')
      }

      setName('')
      setEditingCategory(null)
      setParentId(null)
      setShowForm(false)
      await loadCategories()
    } catch (err: any) {
      console.error("Erro ao salvar:", err)
      showToast(`Erro ao salvar: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Deseja excluir esta categoria?')) return
    if (!user) return
    
    try {
      await db.table('categories').delete(id)
      await addToSyncQueue(user.id, 'categories', 'delete', id, { id })
      showToast('Categoria excluída!', 'info')
      await loadCategories()
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    }
  }

  const FormIconComp = (Icons as any)[icon] || Icons.Tag

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-10 bg-[#f8f9fa] dark:bg-slate-900 min-h-screen transition-colors duration-300">
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

      <ContextToggle />

      <div className="flex bg-gray-100 dark:bg-slate-800 rounded-full p-1 gap-1 mb-4">
        {([['expense','Despesas'],['income','Receitas']] as const).map(([k,l]) => (
          <button
            key={k}
            onClick={() => setTab(k as any)}
            className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all ${
              tab===k ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm mb-4 space-y-4 relative border border-gray-100 dark:border-slate-700">
          <div className="flex justify-between items-center mb-2">
             <p className="text-sm font-semibold text-gray-800 dark:text-white">
              {editingCategory ? 'Editar categoria' : 'Nova categoria'}
            </p>
            <button onClick={() => { setShowForm(false); setEditingCategory(null); }} className="text-gray-400 dark:text-gray-500"><X size={18}/></button>
          </div>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome da categoria"
            className="w-full bg-gray-100 dark:bg-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none text-gray-800 dark:text-white"
          />

          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-2 block">Categoria pai (opcional)</label>
            <select
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full bg-gray-100 dark:bg-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none text-gray-800 dark:text-white"
            >
              <option value="">Nenhuma (categoria principal)</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-2 block">Ícone</label>
              <button 
                onClick={() => setShowIconModal(true)}
                className="flex items-center gap-3 bg-gray-100 dark:bg-slate-700 rounded-xl px-3 py-2 w-full text-left"
              >
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center" 
                  style={{ backgroundColor: `${color}20`, color: color }}
                >
                  <FormIconComp size={18} />
                </div>
                <span className="text-sm text-gray-800 dark:text-white flex-1">{icon}</span>
                <ChevronDown size={16} className="text-gray-400" />
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-2 block">Cor</label>
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
        <div className="flex flex-col items-center py-16 text-gray-400 dark:text-gray-500">
          <span className="text-4xl mb-3">🏷️</span>
          <p className="text-sm font-medium">Nenhuma categoria</p>
          <p className="text-xs mt-1">Clique no + para adicionar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => {
            const catIconName = cat.icon ? cat.icon.charAt(0).toUpperCase() + cat.icon.slice(1) : 'Tag'
            const ListIconComp = (Icons as any)[catIconName] || Icons.Tag

            const subCount = subcategories[cat.id]?.length || 0
            const isExpanded = expandedId === cat.id

            return (
              <div key={cat.id}>
                <div
                  onClick={() => toggleExpand(cat.id)}
                  className={`bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 border border-transparent cursor-pointer hover:border-gray-200 dark:hover:border-slate-600`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                    >
                      <ListIconComp size={20} />
                    </div>

                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-white">
                        {cat.name}
                      </p>

                      <div className="flex items-center gap-2">
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
                        <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" />
                      </button>
                      {isExpanded ? 
                        <ChevronDown size={18} className="text-gray-400 dark:text-gray-500" /> : 
                        <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" />
                      }
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="ml-6 mt-1 space-y-1">
                    {subcategories[cat.id]?.map((sub: any) => {
                      const subIconName = sub.icon ? sub.icon.charAt(0).toUpperCase() + sub.icon.slice(1) : 'Tag'
                      const SubIconComp = (Icons as any)[subIconName] || Icons.Tag

                      return (
                        <div
                          key={sub.id}
                          onClick={() => openEdit(sub)}
                          className={`bg-white dark:bg-slate-800 rounded-xl px-4 py-2.5 shadow-sm flex items-center gap-3 border border-transparent ${!sub.is_default ? 'cursor-pointer hover:border-gray-200 dark:hover:border-slate-600' : ''}`}
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
                      className="w-full bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-2.5 flex items-center gap-3 text-gray-500 dark:text-gray-400 hover:text-teal-700 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
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

      <IconPicker
        isOpen={showIconModal}
        onClose={() => setShowIconModal(false)}
        selectedIcon={icon}
        onSelect={setIcon}
      />
    </div>
  )
}