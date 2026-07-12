'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import * as Icons from 'lucide-react'
import { ChevronLeft, Plus, Trash2, X, ChevronDown, Tag, Edit3, ArrowUp, ArrowDown, ListOrdered } from 'lucide-react'
import IconPicker from '@/components/IconPicker'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

const COLORS = ['#16a34a','#dc2626','#ea580c','#0891b2','#7c3aed','#ca8a04','#94a3b8','#ec4899','#14b8a6']

export default function CategoriesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { context, appMode } = useContext_() 
  const { showToast } = useToast()
  
  const { safeDelete, safeUpdate, safeAdd } = useSafeDb()
  const { success: hapticSuccess, error: hapticError, vibrate } = useHapticFeedback()

  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const [tab, setTab] = useState<'expense'|'income'>('expense')
  const [showForm, setShowForm] = useState(false)
  const [isReordering, setIsReordering] = useState(false)
  const [showIconModal, setShowIconModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any | null>(null)
  
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Tag')
  const [color, setColor] = useState('#16a34a')
  const [saving, setSaving] = useState(false)

  const { data: allLocalCategories, loading: catLoading, reload: reloadCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context: effectiveContext, type: tab }
  })

  // 🔥 ORGANIZAÇÃO POR ORDER_INDEX OU ALFABÉTICA
  const categories = useMemo(() => {
    const cats = (allLocalCategories || [])
    return [...cats].sort((a: any, b: any) => {
      const orderA = a.order_index ?? 9999
      const orderB = b.order_index ?? 9999
      if (orderA !== orderB) return orderA - orderB
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [allLocalCategories])

  function openEdit(cat: any) {
    setIsReordering(false)
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
    setIsReordering(false)
    setEditingCategory(null)
    setName('')
    setIcon('Tag')
    setColor('#16a34a')
    setShowForm(true)
  }

  async function handleSave() {
    if (!name || !user) return
    
    const cleanedName = name.trim().toLowerCase()
    const exists = (allLocalCategories || []).find((c: any) => 
      (c.name || '').trim().toLowerCase() === cleanedName && 
      c.id !== editingCategory?.id 
    )

    if (exists) {
      showToast('⚠️ Já existe uma categoria com este nome!', 'warning')
      hapticError()
      return
    }

    setSaving(true)

    try {
      if (editingCategory) {
        const updatePayload = {
          name: name.trim(),
          icon: icon.toLowerCase(),
          color,
          updated_at: new Date().toISOString()
        }
        
        const result = await safeUpdate('categories', editingCategory.id, updatePayload)
        if (!result.success) throw new Error(result.error)
        
        showToast('✅ Categoria atualizada!', 'success')
      } else {
        const id = crypto.randomUUID()
        const newOrderIndex = categories.length > 0 
          ? Math.max(...categories.map(c => c.order_index || 0)) + 1 
          : 0

        const fullPayload = {
          id,
          user_id: user.id,
          name: name.trim(),
          icon: icon.toLowerCase(),
          color,
          type: tab,
          context: effectiveContext,
          is_default: false,
          order_index: newOrderIndex,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }
        const result = await safeAdd('categories', fullPayload)
        if (!result.success) throw new Error(result.error)
        
        showToast('✅ Categoria criada!', 'success')
      }

      hapticSuccess()
      setName('')
      setEditingCategory(null)
      setShowForm(false)
      await reloadCategories()
    } catch (err: any) {
      console.error("Erro ao salvar:", err)
      showToast(`❌ Erro ao salvar: ${err.message}`, 'error')
      hapticError()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Deseja realmente excluir esta categoria?')) return
    if (!user) return
    
    try {
      const result = await safeDelete('categories', id)
      if (!result.success) throw new Error(result.error)
      
      showToast('✅ Categoria excluída!', 'success')
      hapticSuccess()
      await reloadCategories()
    } catch (err: any) {
      showToast(`❌ Erro ao excluir: ${err.message}`, 'error')
      hapticError()
    }
  }

  // 🔥 LÓGICA DE REORDENAÇÃO ATÔMICA
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === categories.length - 1) return

    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const itemA = categories[index]
    const itemB = categories[swapIndex]

    const orderA = itemA.order_index ?? index
    const orderB = itemB.order_index ?? swapIndex

    vibrate([10])

    try {
      await safeUpdate('categories', itemA.id, { order_index: orderB, updated_at: new Date().toISOString() })
      await safeUpdate('categories', itemB.id, { order_index: orderA, updated_at: new Date().toISOString() })
      await reloadCategories()
    } catch (err) {
      console.error("Erro ao reordenar:", err)
      showToast('❌ Erro ao reordenar', 'error')
    }
  }

  const FormIconComp = (Icons as any)[icon] || Icons.Tag

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/more')} 
            className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors active:scale-[0.95]"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">Categorias</h1>
        </div>

        <div className="flex items-center gap-2">
          {categories.length > 1 && (
            <button
              onClick={() => {
                setIsReordering(!isReordering)
                setShowForm(false)
                vibrate([10])
              }}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-[0.95] ${
                isReordering ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' : 'bg-gray-100 text-gray-600 dark:bg-slate-800'
              }`}
            >
              <ListOrdered size={18} />
            </button>
          )}
          <button
            onClick={() => openNew()}
            className="w-9 h-9 bg-teal-700 rounded-full flex items-center justify-center transition-transform active:scale-[0.95] shadow-md shadow-teal-700/20"
          >
            <Plus size={20} className="text-white" />
          </button>
        </div>
      </div>

      <ContextToggle />

      <div className="flex bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 p-1 rounded-full mb-6 mt-4">
        {([['expense','Despesas'],['income','Receitas']] as const).map(([k,l]) => (
          <button
            key={k}
            onClick={() => {
              setTab(k as any)
              setIsReordering(false)
            }}
            className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-all active:scale-[0.98] ${
              tab === k 
                ? 'bg-[#f4f6f8] dark:bg-slate-700 text-gray-900 dark:text-gray-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]' 
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-[28px] p-5 shadow-sm mb-6 relative border border-gray-100 dark:border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex justify-between items-center mb-4">
             <p className="text-sm font-bold text-gray-800 dark:text-white">
              {editingCategory ? 'Editar categoria' : 'Nova categoria'}
            </p>
            <button onClick={() => { setShowForm(false); setEditingCategory(null); }} className="text-gray-400 hover:text-gray-600 transition-colors active:scale-[0.95]">
              <X size={20}/>
            </button>
          </div>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome da categoria"
            className="w-full bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-3 text-sm font-medium outline-none text-gray-800 dark:text-white mb-4 focus:ring-2 focus:ring-teal-500/50 transition-colors"
          />

          <div className="mb-4">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 block uppercase">Ícone</label>
            <button 
              onClick={() => setShowIconModal(true)}
              className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-3 w-full text-left transition-colors active:scale-[0.98]"
            >
              <div 
                className="w-8 h-8 rounded-xl flex items-center justify-center" 
                style={{ backgroundColor: `${color}20`, color: color }}
              >
                <FormIconComp size={18} />
              </div>
              <span className="text-sm font-bold text-gray-800 dark:text-white flex-1">{icon}</span>
              <ChevronDown size={18} className="text-gray-400" />
            </button>
          </div>

          <div className="mb-6">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 block uppercase">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform active:scale-[0.90] ${
                    color === c ? 'border-gray-800 dark:border-white scale-110 shadow-sm' : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !name}
            className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-xl py-3.5 text-sm font-bold disabled:opacity-50 transition-all active:scale-[0.98] shadow-md shadow-teal-700/20"
          >
            {saving ? 'Salvando...' : 'Salvar categoria'}
          </button>
        </div>
      )}

      {catLoading && categories.length === 0 ? (
        <div className="py-10 text-center text-gray-500 text-sm font-medium animate-pulse">Carregando categorias...</div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in">
          <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Tag size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Nenhuma categoria</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Clique no + para organizar suas transações.</p>
        </div>
      ) : (
        <div className="space-y-3 animate-in fade-in duration-300">
          {categories.map((cat: any, index: number) => {
            const catIconName = cat.icon ? cat.icon.charAt(0).toUpperCase() + cat.icon.slice(1) : 'Tag'
            const ListIconComp = (Icons as any)[catIconName] || Icons.Tag

            return (
              <div
                key={cat.id}
                className="bg-white dark:bg-slate-800 rounded-[24px] px-4 py-3.5 shadow-sm flex items-center gap-3 border border-gray-50 dark:border-slate-700 transition-all"
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
                  {isReordering ? (
                    <>
                      <button 
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0}
                        className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-xl transition-colors disabled:opacity-30 active:scale-[0.95]"
                      >
                        <ArrowUp size={18} />
                      </button>
                      <button 
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === categories.length - 1}
                        className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-xl transition-colors disabled:opacity-30 active:scale-[0.95]"
                      >
                        <ArrowDown size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => openEdit(cat)} 
                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-colors active:scale-[0.95]"
                      >
                        <Edit3 size={18} />
                      </button>
                      
                      {!cat.is_default && (
                        <button 
                          onClick={(e) => handleDelete(cat.id, e)} 
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors active:scale-[0.95]"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </>
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
