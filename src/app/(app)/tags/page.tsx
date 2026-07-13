'use client'

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Search, Plus, X, RefreshCw, Trash2, Tag, Pencil, Save, Hash, ChevronLeft
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"
import { useSafeDb } from '@/hooks/useSafeDb'

const COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", 
  "#EC4899", "#06B6D4", "#F97316", "#14B8A6", "#6366F1",
]

export default function TagsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { context, appMode } = useContext_()
  const { user } = useAuth()
  const { safeDelete, safeUpdate, safeAdd } = useSafeDb()

  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [tagName, setTagName] = useState("")
  const [tagColor, setTagColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)
  
  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: tags, loading, reload } = useLocalData({
    table: 'tags' as any,
    filters: { context: effectiveContext },
  })

  const { data: transactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext },
  })

  const transactionCountByTag = (transactions || []).reduce((acc: Record<string, number>, tx: any) => {
    if (tx.tag_ids && Array.isArray(tx.tag_ids)) {
      tx.tag_ids.forEach((tagId: string) => {
        acc[tagId] = (acc[tagId] || 0) + 1
      })
    }
    return acc
  }, {})

  const handleEdit = (tag: any) => {
    vibrate([5])
    setEditId(tag.id)
    setTagName(tag.name || "")
    setTagColor(tag.color || COLORS[0])
    setShowForm(true)
  }

  const handleNew = () => {
    vibrate([5])
    setEditId(null)
    setTagName("")
    setTagColor(COLORS[0])
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!tagName.trim() || !user) {
      errorHaptic()
      showToast("⚠️ Informe o nome da tag", "warning")
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: tagName.trim(),
        color: tagColor,
        context: effectiveContext,
        updated_at: new Date().toISOString(),
      }

      if (editId) {
        const result = await safeUpdate('tags', editId, payload)
        if (!result.success) throw new Error(result.error)
        success()
        showToast("✅ Tag atualizada!", "success")
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
        const result = await safeAdd('tags', fullPayload)
        if (!result.success) throw new Error(result.error)
        success()
        showToast("✅ Tag criada!", "success")
      }

      setShowForm(false)
      setEditId(null)
      setTagName("")
      reload()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, "error")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal || !user) return
    vibrate([10, 50])
    try {
      const result = await safeDelete('tags', deleteModal)
      if (!result.success) throw new Error(result.error)
      
      success()
      showToast("🗑️ Tag excluída!", "success")
      setDeleteModal(null)
      reload()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, "error")
    }
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY }, [])
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        vibrate([10])
        reload().finally(() => setTimeout(() => setRefreshing(false), 600))
      }
    }
  }, [refreshing, reload, vibrate])

  const filteredTags = (tags || []).filter((tag: any) => {
    if (!search) return true
    return tag.name && tag.name.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f8f9fa] dark:bg-slate-900 transition-colors duration-300">
      {(loadingPulse || loading || pendingCount > 0) && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-sm rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200/70 dark:border-slate-700">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-semibold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* 🔥 HEADER UNIFICADO */}
      <div className="sticky top-0 z-30 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => { vibrate([5]); router.push('/more'); }}
                className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98] shrink-0"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="text-[24px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                  Tags
                </h1>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Organize transações
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { vibrate([5]); setShowSearch(!showSearch); }}
                className="h-11 w-11 rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/40 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
              >
                {showSearch ? <X size={18} /> : <Search size={18} />}
              </button>

              <button
                onClick={handleNew}
                className="h-11 w-11 rounded-[18px] bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98]"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {showSearch && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
                <Search size={18} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar tag..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-[14px] text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none"
                  autoFocus
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className="flex-1 overflow-y-auto px-4 pt-3 pb-28 custom-scrollbar"
      >
        {loading ? (
          <div className="space-y-2.5">
            <Skeleton count={5} height="76px" borderRadius="24px" />
          </div>
        ) : filteredTags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full border border-gray-200/70 dark:border-slate-700 shadow-sm flex items-center justify-center mb-4">
              <Tag size={28} className="opacity-30 text-gray-500" />
            </div>
            <p className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">
              {search ? "Nenhuma tag encontrada" : "Nenhuma tag criada"}
            </p>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1">
              {search ? "Tente outro termo" : "Toque no + para organizar"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 animate-in fade-in duration-500">
            {filteredTags.map((tag: any) => {
              const txCount = transactionCountByTag[tag.id] || 0
              return (
                <div
                  key={tag.id}
                  className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2"
                >
                  <div className="rounded-[18px] p-3 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-10 h-10 rounded-[14px] flex items-center justify-center shadow-sm shrink-0"
                        style={{ backgroundColor: tag.color || COLORS[0] }}
                      >
                        <Hash size={18} className="text-white" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {tag.name}
                        </p>
                        <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                          {txCount} transaç{txCount === 1 ? 'ão' : 'ões'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleEdit(tag)}
                        className="h-9 w-9 rounded-[14px] bg-gray-50 dark:bg-slate-700 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors active:scale-[0.98]"
                      >
                        <Pencil size={15} className="mx-auto" />
                      </button>
                      <button
                        onClick={() => { vibrate([10]); setDeleteModal(tag.id); }}
                        className="h-9 w-9 rounded-[14px] bg-gray-50 dark:bg-slate-700 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors active:scale-[0.98]"
                      >
                        <Trash2 size={15} className="mx-auto" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 🔥 BOTTOM SHEET - FORMULÁRIO */}
      {showForm && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div
            className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />

            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">
                {editId ? "Editar Tag" : "Nova Tag"}
              </h3>
              <button
                onClick={() => { vibrate([5]); setShowForm(false); setEditId(null); }}
                className="h-10 w-10 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-400 flex items-center justify-center active:scale-[0.98]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 mb-6">
              <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
                <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                  Nome da tag
                </label>
                <input
                  type="text"
                  placeholder="Ex: Fixo, Lazer..."
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  className="w-full rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 text-[14px] font-medium text-gray-800 dark:text-gray-200 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-teal-500/20"
                  autoFocus
                />
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
                <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-3 block">
                  Cor temática
                </label>
                <div className="flex flex-wrap gap-3">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => { vibrate([5]); setTagColor(color); }}
                      className={`w-10 h-10 rounded-full transition-transform active:scale-[0.95] ${
                        tagColor === color
                          ? "scale-110 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ring-gray-300 dark:ring-slate-500"
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center p-2">
                <span
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold text-white shadow-sm"
                  style={{ backgroundColor: tagColor }}
                >
                  <Hash size={14} />
                  {tagName || "Nome da tag"}
                </span>
              </div>
            </div>

            <button
              onClick={() => { vibrate([10, 50]); handleSave(); }}
              disabled={saving}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[20px] font-bold text-[15px] shadow-lg shadow-teal-600/20 transition-transform active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {saving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
              {editId ? "Atualizar Tag" : "Criar Tag"}
            </button>
          </div>
        </div>
      )}

      {/* 🔥 MODAL DE EXCLUSÃO */}
      {deleteModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setDeleteModal(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div
            className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <h3 className="text-[20px] font-black text-gray-800 dark:text-gray-100 mb-2 text-center">
              Excluir Tag
            </h3>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-8 text-center px-4 font-medium">
              As transações vinculadas continuarão existindo, apenas perderão a marcação desta tag.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 py-4 rounded-[20px] bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold text-[15px] hover:bg-gray-200 transition-colors active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-4 rounded-[20px] bg-red-500 hover:bg-red-600 text-white font-bold text-[15px] shadow-lg shadow-red-500/20 transition-all active:scale-[0.98]"
              >
                Excluir Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}