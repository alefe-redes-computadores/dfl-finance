'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import * as Icons from 'lucide-react'
import { ChevronLeft, Plus, Trash2, X, ChevronDown, ChevronRight, Tag, Edit3, Eraser } from 'lucide-react'
import { useRouter } from 'next/navigation'
import IconPicker from '@/components/IconPicker'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'
import { db } from '@/lib/db'
import { useSafeDb } from '@/hooks/useSafeDb'

const COLORS = ['#16a34a','#dc2626','#ea580c','#0891b2','#7c3aed','#ca8a04','#94a3b8','#ec4899','#14b8a6']

export default function CategoriesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { context, appMode } = useContext_() 
  const { showToast } = useToast()
  
  const { safeDelete, safeUpdate, safeAdd } = useSafeDb()

  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

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
  const [cleaning, setCleaning] = useState(false)

  const { data: allLocalCategories, loading: catLoading, reload: reloadCategories } = useLocalData({
    table: 'categories' as any,
  })

  const allAvailableParents = useMemo(() => {
    if (!allLocalCategories) return []
    return allLocalCategories
      .filter((c: any) => c.context === effectiveContext && c.type === tab && !c.parent_id)
      .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
  }, [allLocalCategories, effectiveContext, tab])

  const { categories, subcategories } = useMemo(() => {
    if (!allLocalCategories) return { categories: [], subcategories: {} }
    const filtered = allLocalCategories.filter((c: any) => c.context === effectiveContext && c.type === tab)
    const mainCats = filtered.filter((c: any) => !c.parent_id).sort((a: any, b: any) => (a.sort_order || 999) - (b.sort_order || 999))
    const subsMap: Record<string, any[]> = {}
    filtered.filter((c: any) => c.parent_id).forEach((sub: any) => {
      if (!subsMap[sub.parent_id]) subsMap[sub.parent_id] = []
      subsMap[sub.parent_id].push(sub)
    })
    return { categories: mainCats, subcategories: subsMap }
  }, [allLocalCategories, effectiveContext, tab])

  async function forceCleanLocal() {
    if (!confirm("Isso apagará o cache local e recarregará tudo do servidor. Continue se as categorias estiverem zumbificadas.")) return;
    setCleaning(true);
    try {
      await db.table('categories').clear();
      await db.table('sync_queue').clear();
      await reloadCategories();
      showToast("Cache limpo e sincronizado!", "success");
    } catch (e: any) {
      showToast("Erro na limpeza: " + e.message, "error");
    } finally {
      setCleaning(false);
    }
  }

  function openEdit(cat: any) {
    setEditingCategory(cat)
    setName(cat.name)
    setColor(cat.color)
    setParentId(cat.parent_id || null)
    setIcon(cat.icon ? cat.icon.charAt(0).toUpperCase() + cat.icon.slice(1) : 'Tag')
    setShowForm(true)
  }

  function openNew(targetParentId: string | null = null) {
    setEditingCategory(null)
    setName('')
    setIcon('Tag')
    setColor('#16a34a')
    setParentId(targetParentId)
    setShowForm(true)
  }

  async function handleSave() {
    if (!name || !user) return
    setSaving(true)

    try {
      const payload = {
        name: name.trim(),
        icon: icon.toLowerCase(),
        color,
        parent_id: parentId || null, 
        user_id: user.id, 
        context: effectiveContext,
        type: tab,
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
      }
      
      if (editingCategory) {
        await safeUpdate('categories', editingCategory.id, payload)
      } else {
        await safeAdd('categories', { id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() })
      }
      
      setName(''); setEditingCategory(null); setParentId(null); setShowForm(false); await reloadCategories();
      showToast('Salvo com sucesso!', 'success');
    } catch (err: any) {
      showToast(`Erro ao salvar: ${err.message}`, 'error')
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Deseja excluir? ATENÇÃO: Subcategorias serão apagadas!')) return
    try {
      // 🔥 FIX: Cast para any[] para silenciar o erro de build
      const subs = (allLocalCategories || []).filter((c: any) => c.parent_id === id) as any[];
      for (const sub of subs) await safeDelete('categories', sub.id);
      await safeDelete('categories', id)
      await reloadCategories()
    } catch (err: any) { showToast(`Erro: ${err.message}`, 'error') }
  }

  const FormIconComp = (Icons as any)[icon] || Icons.Tag

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-10 bg-[#f8f9fa] dark:bg-slate-900 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}><ChevronLeft size={24} /></button>
          <h1 className="text-xl font-bold">Categorias</h1>
        </div>
        
        <div className="flex items-center gap-2">
           <button onClick={forceCleanLocal} disabled={cleaning} className="p-2 bg-orange-100 rounded-full text-orange-600"><Eraser size={20}/></button>
           <button onClick={() => openNew()} className="w-9 h-9 bg-brand-teal rounded-full flex items-center justify-center"><Plus size={20} className="text-white" /></button>
        </div>
      </div>

      <ContextToggle />

      <div className="flex bg-gray-100 dark:bg-slate-800 rounded-full p-1 gap-1 mb-4">
        {([['expense','Despesas'],['income','Receitas']] as const).map(([k,l]) => (
          <button key={k} onClick={() => setTab(k as any)} className={`flex-1 py-1.5 rounded-full text-xs font-semibold ${tab===k ? 'bg-white shadow-sm' : 'text-gray-500'}`}>{l}</button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm mb-4 space-y-4">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome" className="w-full bg-gray-100 rounded-xl px-3 py-2.5" />
          <select value={parentId || ''} onChange={(e) => setParentId(e.target.value || null)} className="w-full bg-gray-100 rounded-xl px-3 py-2.5">
            <option value="">Nenhuma (Principal)</option>
            {allAvailableParents.map((cat: any) => editingCategory?.id !== cat.id && <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
          <button onClick={handleSave} disabled={saving} className="w-full bg-brand-teal text-white rounded-xl py-3 font-semibold">{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      )}

      {categories.map((cat: any) => {
        const ListIconComp = (Icons as any)[cat.icon ? cat.icon.charAt(0).toUpperCase() + cat.icon.slice(1) : 'Tag'] || Icons.Tag
        const subs = subcategories[cat.id] || []
        return (
          <div key={cat.id} className="bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 mb-2 shadow-sm">
             <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}><ListIconComp size={20} /></div>
                 <p className="text-sm font-medium flex-1">{cat.name}</p>
                 <button onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)}><ChevronRight size={18} /></button>
                 <button onClick={() => openEdit(cat)} className="p-1.5 bg-blue-50 rounded-lg"><Edit3 size={16} className="text-blue-500" /></button>
             </div>
             {expandedId === cat.id && (
                 <div className="mt-3 pl-12 space-y-2">
                    {subs.map((sub: any) => (
                        <div key={sub.id} className="flex items-center gap-2">
                             <p className="text-xs text-gray-500">• {sub.name}</p>
                             <button onClick={() => openEdit(sub)} className="text-blue-500"><Edit3 size={12}/></button>
                        </div>
                    ))}
                    <button onClick={() => openNew(cat.id)} className="text-xs text-brand-teal font-medium">+ Adicionar sub</button>
                 </div>
             )}
          </div>
        )
      })}
    </div>
  )
}
