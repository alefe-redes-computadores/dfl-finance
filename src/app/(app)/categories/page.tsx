// src/app/(app)/categories/page.tsx
'use client'

import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { ChevronLeft, Plus, Trash2, X, ChevronDown, Tag, Edit3, ArrowUp, ArrowDown, ListOrdered } from 'lucide-react'
import IconPicker from '@/components/IconPicker'
import { getDynamicIcon, normalizeIconName } from '@/lib/iconUtils'
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
  
  const { safeDelete, safeUpdate, safeAdd, safeReorderCategories } = useSafeDb()
  const { success: hapticSuccess, error: hapticError, vibrate } = useHapticFeedback()

  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const [tab, setTab] = useState<'expense'|'income'>('expense')
  const [showForm, setShowForm] = useState(false)
  const [isReordering, setIsReordering] = useState(false)
  const [showIconModal, setShowIconModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Tag')
  const [color, setColor] = useState('#16a34a')
  const [saving, setSaving] = useState(false)
  const [reorderingId, setReorderingId] = useState<string | null>(null)

  const { data: allLocalCategories, loading: catLoading, reload: reloadCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context: effectiveContext, type: tab }
  })

  const categories = useMemo(() => {
    const cats = (allLocalCategories || [])
    return [...cats].sort((a: any, b: any) => {
      const orderA = a.order_index ?? 9999
      const orderB = b.order_index ?? 9999
      if (orderA !== orderB) return orderA - orderB
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [allLocalCategories])

  const { data: transactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext },
  })

  const transactionCountByCategory = useMemo(() => {
    return (transactions || []).reduce((counts: Record<string, number>, tx: any) => {
      if (tx.category_id) counts[tx.category_id] = (counts[tx.category_id] || 0) + 1
      return counts
    }, {})
  }, [transactions])

  function openEdit(cat: any) {
    vibrate([5])
    setIsReordering(false)
    setEditingCategory(cat)
    setName(cat.name)
    setColor(cat.color)

    if (cat.icon) {
      setIcon(normalizeIconName(cat.icon) || 'Tag')
    } else {
      setIcon('Tag')
    }

    setShowForm(true)
  }

  function openNew() {
    vibrate([5])
    setIsReordering(false)
    setEditingCategory(null)
    setName('')
    setIcon('Tag')
    setColor('#16a34a')
    setShowForm(true)
  }

  async function handleSave() {
    if (!user) return

    const trimmedName = name.trim()

    if (!trimmedName) {
      showToast(
        'Informe um nome para a categoria.',
        'warning'
      )
      hapticError()
      return
    }

    const cleanedName = trimmedName.toLowerCase()
    const exists = (allLocalCategories || []).find((c: any) => 
      (c.name || '').trim().toLowerCase() === cleanedName && 
      c.id !== editingCategory?.id 
    )

    if (exists) {
      showToast('Já existe uma categoria com este nome.', 'warning')
      hapticError()
      return
    }

    setSaving(true)

    try {
      if (editingCategory) {
        const updatePayload = {
          name: trimmedName,
          icon: normalizeIconName(icon) || 'Tag',
          color,
          updated_at: new Date().toISOString()
        }
        
        const result = await safeUpdate('categories', editingCategory.id, updatePayload)
        if (!result.success) throw new Error(result.error)
        
        showToast('Categoria atualizada.', 'success')
      } else {
        const id = crypto.randomUUID()
        const newOrderIndex = categories.length > 0 
          ? Math.max(...categories.map(c => c.order_index || 0)) + 1 
          : 0

        const fullPayload = {
          id,
          user_id: user.id,
          name: trimmedName,
          icon: normalizeIconName(icon) || 'Tag',
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
        
        showToast('Categoria criada.', 'success')
      }

      hapticSuccess()
      setName('')
      setEditingCategory(null)
      setShowForm(false)
      await reloadCategories()
    } catch (err: any) {
      console.error("Erro ao salvar:", err)
      showToast(`Erro ao salvar: ${err.message}`, 'error')
      hapticError()
    } finally {
      setSaving(false)
    }
  }

  function requestDelete(cat: any, e: React.MouseEvent) {
    e.stopPropagation()
    vibrate([10])
    setDeleteTarget(cat)
  }

  async function confirmDeleteCategory() {
    if (!deleteTarget || !user) return

    try {
      const result = await safeDelete('categories', deleteTarget.id)
      if (!result.success) throw new Error(result.error)

      setDeleteTarget(null)
      showToast('Categoria excluída.', 'success')
      hapticSuccess()
      await reloadCategories()
    } catch (err: any) {
      showToast(err?.message || 'Não foi possível excluir a categoria.', 'error')
      hapticError()
    }
  }

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (reorderingId) return

    if (
      direction === 'up' &&
      index === 0
    ) return

    if (
      direction === 'down' &&
      index === categories.length - 1
    ) return

    const swapIndex =
      direction === 'up'
        ? index - 1
        : index + 1

    const itemA = categories[index]
    const itemB = categories[swapIndex]

    const orderA =
      itemA.order_index ?? index

    const orderB =
      itemB.order_index ?? swapIndex

    vibrate([10])
    setReorderingId(itemA.id)

    try {
      const result =
        await safeReorderCategories(
          itemA.id,
          itemB.id,
          orderA,
          orderB
        )

      if (!result.success) {
        throw new Error(
          result.error ||
          'Erro ao reordenar categorias'
        )
      }

      await reloadCategories()
    } catch (err: any) {
      console.error(
        'Erro ao reordenar:',
        err
      )

      showToast(
        err?.message ||
        'Erro ao reordenar categorias.',
        'error'
      )

      hapticError()
    } finally {
      setReorderingId(null)
    }
  }

  const FormIconComp = getDynamicIcon(icon)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-950 pb-28 font-sans px-4 pt-4 transition-colors duration-300">
      
      {/* HEADER */}
      <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm px-4 py-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/more')}
              className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="min-w-0">
              <h1 className="text-[20px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                Categorias
              </h1>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                Organize receitas e despesas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {categories.length > 1 && (
              <button
                onClick={() => {
                  setIsReordering(!isReordering)
                  setShowForm(false)
                  vibrate([10])
                }}
                aria-label={
                  isReordering
                    ? 'Encerrar reordenação'
                    : 'Reordenar categorias'
                }
                className={`h-10 w-10 rounded-[16px] border transition-all active:scale-[0.98] ${
                  isReordering
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900/40 text-orange-600'
                    : 'bg-gray-50 dark:bg-slate-900 border-gray-200/70 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                }`}
              >
                <ListOrdered size={18} className="mx-auto" />
              </button>
            )}

            <button
              onClick={() => openNew()}
              aria-label="Nova categoria"
              className="h-10 w-10 bg-teal-600 rounded-[16px] flex items-center justify-center transition-transform active:scale-[0.98] shadow-lg shadow-teal-600/20 hover:bg-teal-700"
            >
              <Plus size={20} className="text-white" />
            </button>
          </div>
        </div>

        <div className="mb-3">
          <ContextToggle />
        </div>

        <div className="bg-gray-50 dark:bg-slate-900 rounded-[20px] p-1 border border-gray-200/70 dark:border-slate-700">
          <div className="flex gap-1">
            {([['expense','Despesas'],['income','Receitas']] as const).map(([k,l]) => (
              <button
                key={k}
                onClick={() => {
                  setTab(k as any)
                  setIsReordering(false)
                  setShowForm(false)
                  setEditingCategory(null)
                  setShowIconModal(false)
                }}
                className={`flex-1 h-10 rounded-[16px] text-[13px] font-semibold transition-all active:scale-[0.98] ${
                  tab === k
                    ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800/70'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LISTA DE CATEGORIAS */}
      {catLoading && categories.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm py-10 text-center text-gray-500 text-sm font-medium animate-pulse">
          Carregando categorias...
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center py-16 animate-in fade-in">
          <div className="w-16 h-16 bg-gray-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
            <Tag size={28} className="text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-[16px] font-semibold text-gray-800 dark:text-gray-100 mb-1">
            Nenhuma categoria
          </p>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">
            Clique no + para organizar suas transações.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 animate-in fade-in duration-300">
          {categories.map((cat: any, index: number) => {
            const ListIconComp = getDynamicIcon(cat.icon || 'Tag')
            const txCount = transactionCountByCategory[cat.id] || 0

            return (
              <div
                key={cat.id}
                className="bg-white dark:bg-slate-900 rounded-[20px] border border-gray-200/70 dark:border-slate-800 shadow-sm p-1.5 transition-all"
              >
                <div className="rounded-[18px] p-3 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-[14px] flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                  >
                    <ListIconComp size={18} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-gray-900 dark:text-white truncate">
                      {cat.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
                      <span>{txCount} transaç{txCount === 1 ? 'ão' : 'ões'}</span>
                      {cat.is_default && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-500 dark:bg-slate-800 dark:text-gray-400">
                          Padrão
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isReordering ? (
                      <>
                        <button
                          onClick={() => handleMove(index, 'up')}
                          aria-label={`Mover ${cat.name} para cima`}
                          disabled={index === 0 || Boolean(reorderingId)}
                          className="h-9 w-9 rounded-[14px] flex items-center justify-center text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors disabled:opacity-30 active:scale-[0.98]"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          onClick={() => handleMove(index, 'down')}
                          aria-label={`Mover ${cat.name} para baixo`}
                          disabled={index === categories.length - 1 || Boolean(reorderingId)}
                          className="h-9 w-9 rounded-[14px] flex items-center justify-center text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors disabled:opacity-30 active:scale-[0.98]"
                        >
                          <ArrowDown size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => openEdit(cat)}
                          aria-label={`Editar ${cat.name}`}
                          className="h-9 w-9 rounded-[14px] flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors active:scale-[0.98]"
                        >
                          <Edit3 size={16} />
                        </button>

                        {!cat.is_default && (
                          <button
                            onClick={(e) => requestDelete(cat, e)}
                            aria-label={`Excluir ${cat.name}`}
                            className="h-9 w-9 rounded-[14px] flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors active:scale-[0.98]"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[120000] flex items-end justify-center" onClick={() => { setShowForm(false); setEditingCategory(null) }}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
          <div
            className="relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[32px] border border-b-0 border-gray-200/70 bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-16px_60px_rgba(15,23,42,0.18)] animate-in slide-in-from-bottom-6 duration-200 dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />

            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">
                  {editingCategory ? 'Editar categoria' : `Nova categoria de ${tab === 'income' ? 'receita' : 'despesa'}`}
                </h3>
                <p className="mt-0.5 text-[12px] text-gray-400">Nome, ícone e cor ajudam a reconhecer rápido.</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingCategory(null) }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 active:scale-[0.97] dark:bg-slate-800"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 ml-1 block text-[12px] font-semibold text-gray-500 dark:text-gray-400">Nome</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Mercado, Salário, Transporte..."
                  className="w-full rounded-[18px] border border-gray-200 bg-gray-50 px-4 py-3.5 text-[14px] font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1.5 ml-1 block text-[12px] font-semibold text-gray-500 dark:text-gray-400">Ícone</label>
                <button
                  type="button"
                  onClick={() => { vibrate([5]); setShowIconModal(true) }}
                  className="flex w-full items-center gap-3 rounded-[18px] border border-gray-200 bg-gray-50 px-4 py-3 text-left active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px]" style={{ backgroundColor: `${color}20`, color }}>
                    <FormIconComp size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{icon}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">Toque para trocar</p>
                  </div>
                  <ChevronDown size={18} className="text-gray-400" />
                </button>
              </div>

              <div>
                <label className="mb-2 ml-1 block text-[12px] font-semibold text-gray-500 dark:text-gray-400">Cor</label>
                <div className="flex flex-wrap gap-3 rounded-[20px] border border-gray-200/70 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                  {COLORS.map((itemColor) => (
                    <button
                      type="button"
                      key={itemColor}
                      onClick={() => { vibrate([5]); setColor(itemColor) }}
                      aria-label={`Selecionar cor ${itemColor}`}
                      className={`h-10 w-10 rounded-full transition-transform active:scale-[0.9] ${color === itemColor ? 'scale-110 ring-2 ring-gray-300 ring-offset-2 ring-offset-gray-50 dark:ring-slate-500 dark:ring-offset-slate-800' : ''}`}
                      style={{ backgroundColor: itemColor }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center py-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200/70 bg-white px-4 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex h-7 w-7 items-center justify-center rounded-[10px]" style={{ backgroundColor: `${color}20`, color }}>
                    <FormIconComp size={15} />
                  </div>
                  <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">{name.trim() || 'Prévia da categoria'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-teal-600 py-4 text-[15px] font-bold text-white shadow-lg shadow-teal-600/20 active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? 'Salvando...' : editingCategory ? 'Salvar alterações' : 'Criar categoria'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {deleteTarget && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[120000] flex items-end justify-center" onClick={() => setDeleteTarget(null)}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg rounded-t-[32px] border border-b-0 border-gray-200/70 bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-16px_60px_rgba(15,23,42,0.18)] animate-in slide-in-from-bottom-6 duration-200 dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />
            <h3 className="text-center text-[20px] font-bold text-gray-900 dark:text-gray-100">Excluir categoria?</h3>
            <p className="mx-auto mt-2 max-w-sm text-center text-[13px] leading-5 text-gray-500 dark:text-gray-400">
              {transactionCountByCategory[deleteTarget.id]
                ? `“${deleteTarget.name}” está em ${transactionCountByCategory[deleteTarget.id]} transação(ões). O histórico financeiro é protegido e a exclusão será bloqueada.`
                : `“${deleteTarget.name}” será removida. Esta ação não pode ser desfeita.`}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-[18px] bg-gray-100 py-3.5 text-[14px] font-bold text-gray-600 active:scale-[0.98] dark:bg-slate-800 dark:text-gray-300">
                Cancelar
              </button>
              <button type="button" onClick={confirmDeleteCategory} className="rounded-[18px] bg-red-500 py-3.5 text-[14px] font-bold text-white shadow-lg shadow-red-500/20 active:scale-[0.98]">
                Excluir
              </button>
            </div>
          </div>
        </div>,
        document.body
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