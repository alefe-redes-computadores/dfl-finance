"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Plus,
  X,
  RefreshCw,
  Trash2,
  Tag,
  Pencil,
  Save,
  Hash,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useLocalSync } from "@/hooks/useLocalSync"
import { useContext_ } from '@/components/ContextToggle'
import Skeleton from '@/components/Skeleton'
import { useAuth } from "@/lib/hooks/useAuth"
import { db } from '@/lib/db'
import { useSafeDb } from '@/hooks/useSafeDb'

const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
  "#14B8A6",
  "#6366F1",
]

export default function TagsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  // 🔥 CORREÇÃO: Pegando o appMode para calcular o effectiveContext
  const { context, appMode } = useContext_()
  const { user } = useAuth()
  const { safeDelete, safeUpdate, safeAdd } = useSafeDb()

  // 🔥 CORREÇÃO: Aplicando o effectiveContext para o modo Apenas PF funcionar
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
    filters: { context: effectiveContext }, // 🔥 Usando effectiveContext
  })

  const { data: transactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext }, // 🔥 Usando effectiveContext
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
    setEditId(tag.id)
    setTagName(tag.name || "")
    setTagColor(tag.color || COLORS[0])
    setShowForm(true)
  }

  const handleNew = () => {
    setEditId(null)
    setTagName("")
    setTagColor(COLORS[0])
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!tagName.trim() || !user) {
      showToast("Informe o nome da tag", "warning")
      errorHaptic()
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: tagName.trim(),
        color: tagColor,
        context: effectiveContext, // 🔥 Usando effectiveContext
        updated_at: new Date().toISOString(),
      }

      if (editId) {
        const result = await safeUpdate('tags', editId, payload)
        if (!result.success) {
          showToast(`Erro ao atualizar: ${result.error}`, "error")
          errorHaptic()
          return
        }
        showToast("Tag atualizada com sucesso!", "success")
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
        if (!result.success) {
          showToast(`Erro ao criar: ${result.error}`, "error")
          errorHaptic()
          return
        }
        showToast("Tag criada com sucesso!", "success")
      }

      success()
      setShowForm(false)
      setEditId(null)
      setTagName("")
      reload()
    } catch (err: any) {
      showToast(err?.message || "Erro ao salvar tag", "error")
      errorHaptic()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal || !user) return
    try {
      const result = await safeDelete('tags', deleteModal)
      if (!result.success) {
        showToast(`Erro ao excluir: ${result.error}`, "error")
        errorHaptic()
        return
      }
      showToast("Tag excluída com sucesso!", "success")
      success()
      setDeleteModal(null)
      reload()
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, "error")
      errorHaptic()
    }
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        reload().finally(() => {
          setTimeout(() => setRefreshing(false), 600)
        })
      }
    }
  }, [refreshing, reload])

  const filteredTags = (tags || []).filter((tag: any) => {
    if (!search) return true
    const s = search.toLowerCase()
    return tag.name && tag.name.toLowerCase().includes(s)
  })

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950">
      {(loadingPulse || loading || pendingCount > 0) && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pb-3">
        <div className="flex items-center justify-between pt-4 mb-3">
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-slate-100">Tags</h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Organize suas transações</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {showSearch ? <X size={18} /> : <Search size={18} />}
            </button>
            <button
              onClick={handleNew}
              className="p-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white shadow-md shadow-teal-500/20 transition-all active:scale-95"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
            />
          </div>
        )}
      </div>

      {showForm && (
        <div className="px-4 pt-3 pb-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-slate-200">
                {editId ? "Editar Tag" : "Nova Tag"}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditId(null)
                }}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Nome da Tag</label>
              <input
                type="text"
                placeholder="Ex: Fixo, Variável, Essencial..."
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">Cor</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setTagColor(color)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      tagColor === color
                        ? "ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-800 scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Preview</label>
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: tagColor }}
              >
                <Hash size={10} />
                {tagName || "Nome da tag"}
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditId(null)
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {editId ? "Atualizar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className="flex-1 overflow-y-auto px-4 pt-3 pb-24"
      >
        {loading ? (
          <Skeleton count={4} />
        ) : filteredTags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Tag size={48} className="text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-semibold">
              {search ? "Nenhuma tag encontrada" : "Nenhuma tag criada"}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              {search ? "Tente outro termo de busca" : "Toque no + para criar sua primeira tag"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTags.map((tag: any) => {
              const txCount = transactionCountByTag[tag.id] || 0
              return (
                <div
                  key={tag.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: tag.color || COLORS[0] }}
                    >
                      <Hash size={18} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {tag.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {txCount} {txCount === 1 ? "transação" : "transações"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(tag)}
                      className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-teal-500 transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteModal(tag.id)}
                      className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">Excluir Tag</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Tem certeza que deseja excluir esta tag? As transações vinculadas não serão afetadas.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
