'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import * as Icons from 'lucide-react'
import { ChevronLeft, Plus, Trash2, X, ChevronDown, Tag, Edit3 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import IconPicker from '@/components/IconPicker'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'

const COLORS = ['#16a34a','#dc2626','#ea580c','#0891b2','#7c3aed','#ca8a04','#94a3b8','#ec4899','#14b8a6']

export default function CategoriesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { context, appMode } = useContext_() 
  const { showToast } = useToast()
  
  const { safeDelete, safeUpdate, safeAdd } = useSafeDb()

  // 🔥 CORRIGIDO: effectiveContext garantindo separação PF/PJ
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const [tab, setTab] = useState<'expense'|'income'>('expense')

  const [showForm, setShowForm] = useState(false)
  const [showIconModal, setShowIconModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Tag')
  const [color, setColor] = useState('#16a34a')
  const [saving, setSaving] = useState(false)

  // Lê todas as categorias do banco local, filtrando por contexto e tipo
  const { data: allLocalCategories, loading: catLoading, reload: reloadCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context: effectiveContext, type: tab }
  })

  // Categorias simples e diretas, sem subcategorias
  const categories = useMemo(() => {
    if (!allLocalCategories) return []
    return [...allLocalCategories].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
  }, [allLocalCategories])

  function openEdit(cat: any) {
    setEditingCategory(cat)
    setName(cat.name)
    setColor(cat.color)

    if (cat.icon) {
      const formattedIcon = cat.icon.charAt(0).toUpperCase() + cat.icon.slice(1)
      setIcon(formattedIcon)
    } else {
      setIcon('Tag')
    }

    setShowForm(true)
  }

  function openNew() {
    setEditingCategory(null)
    setName('')
    setIcon('Tag')
    setColor('#16a34a')
    setShowForm(true)
  }

  async function handleSave() {
    if (!name || !user) return
    
    // 🔥 TRAVA LOCAL: Impede de salvar com nome repetido no MESMO contexto e tipo
    const cleanedName = name.trim().toLowerCase()
    const exists = allLocalCategories?.find((c: any) => 
      (c.name || '').trim().toLowerCase() === cleanedName && 
      c.id !== editingCategory?.id // Ignora a si mesmo na hora de editar
    )

    if (exists) {
      showToast('Já existe uma categoria com este nome neste contexto!', 'warning')
      return
    }

    setSaving(true)

    try {
      if (editingCategory) {
        // UPDATE BLINDADO
        const updatePayload = {
          name: name.trim(),
          icon: icon.toLowerCase(),
          color,
          user_id: user.id, 
          context: effectiveContext,
          type: tab,
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        
        const result = await safeUpdate('categories', editingCategory.id, updatePayload)
        if (!result.success) {
          showToast(`Erro ao atualizar: ${result.error}`, 'error')
          return
        }
        showToast('Categoria atualizada e salva!', 'success')
      } else {
        // CREATE BLINDADO
        const id = crypto.randomUUID()
        const fullPayload = {
          id,
          user_id: user.id,
          name: name.trim(),
          icon: icon.toLowerCase(),
          color,
          type: tab,
          context: effectiveContext,
          is_default: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        const result = await safeAdd('categories', fullPayload)
        if (!result.success) {
          showToast(`Erro ao criar: ${result.error}`, 'error')
          return
        }
        showToast('Categoria criada!', 'success')
      }

      setName('')
      setEditingCategory(null)
      setShowForm(false)
      await reloadCategories()
    } catch (err: any) {
      console.error("Erro ao salvar:", err)
      showToast(`Erro ao salvar: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Deseja realmente excluir esta categoria? As transações vinculadas perderão a categoria.')) return
    if (!user) return
    
    try {
      const result = await safeDelete('categories', id)
      if (!result.success) {
        showToast(`Erro ao excluir: ${result.error}`, 'error')
        return
      }
      
      showToast('Categoria excluída com sucesso!', 'success')
      await reloadCategories()
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => openNew()}
            className="w-9 h-9 bg-brand-teal rounded-full flex items-center justify-center transition-transform active:scale-95"
          >
            <Plus size={20} className="text-white" />
          </button>
        </div>
      </div>

      <ContextToggle />

      <div className="flex bg-gray-100 dark:bg-slate-800 rounded-full p-1 gap-1 mb-4 mt-4">
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm mb-4 space-y-4 relative border border-gray-100 dark:border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex justify-between items-center mb-2">
             <p className="text-sm font-semibold text-gray-800 dark:text-white">
              {editingCategory ? 'Editar categoria' : 'Nova categoria'}
            </p>
            <button onClick={() => { setShowForm(false); setEditingCategory(null); }} className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 p-1 rounded-full transition-colors"><X size={18}/></button>
          </div>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome da categoria"
            className="w-full bg-gray-100 dark:bg-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none text-gray-800 dark:text-white focus:ring-2 focus:ring-teal-500/50"
            autoFocus
          />

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-2 block font-medium">Ícone</label>
              <button 
                onClick={() => setShowIconModal(true)}
                className="flex items-center gap-3 bg-gray-100 dark:bg-slate-700 rounded-xl px-3 py-2 w-full text-left transition-colors hover:bg-gray-200 dark:hover:bg-slate-600"
              >
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center" 
                  style={{ backgroundColor: `${color}20`, color: color }}
                >
                  <FormIconComp size={18} />
                </div>
                <span className="text-sm font-medium text-gray-800 dark:text-white flex-1">{icon}</span>
                <ChevronDown size={16} className="text-gray-400" />
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-2 block font-medium">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color===c ? 'border-gray-800 dark:border-white scale-110 shadow-sm' : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !name}
            className="w-full bg-brand-teal hover:bg-teal-700 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50 mt-2 transition-all active:scale-95"
          >
            {saving ? 'Salvando...' : 'Salvar categoria'}
          </button>
        </div>
      )}

      {catLoading && categories.length === 0 ? (
        <div className="py-10 text-center text-gray-500 text-sm font-medium animate-pulse">Carregando categorias...</div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400 dark:text-gray-500">
          <span className="text-4xl mb-3 opacity-50">🏷️</span>
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Nenhuma categoria</p>
          <p className="text-xs mt-1 font-medium">Clique no + para adicionar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat: any) => {
            const catIconName = cat.icon ? cat.icon.charAt(0).toUpperCase() + cat.icon.slice(1) : 'Tag'
            const ListIconComp = (Icons as any)[catIconName] || Icons.Tag

            return (
              <div
                key={cat.id}
                className="bg-white dark:bg-slate-800 rounded-2xl px-4 py-3.5 shadow-sm flex items-center gap-3 border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                >
                  <ListIconComp size={20} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-gray-800 dark:text-white truncate">
                    {cat.name}
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button 
                    onClick={() => openEdit(cat)} 
                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-colors"
                  >
                    <Edit3 size={18} />
                  </button>
                  
                  {!cat.is_default && (
                    <button 
                      onClick={(e) => handleDelete(cat.id, e)} 
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
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
