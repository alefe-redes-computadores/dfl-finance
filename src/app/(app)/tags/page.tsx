'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, ChevronRight, Trash2, X, Loader2 } from 'lucide-react'
import Skeleton from '@/components/Skeleton'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'

const TAG_COLORS = [
  '#264653', '#2a9d8f', '#1d3557', '#e76f51', '#2ecc71', 
  '#00b894', '#ff7675', '#d63031', '#fdcb6e', '#e17055',
  '#74b9ff', '#0984e3', '#a29bfe', '#6c5ce7', '#fd79a8',
  '#e84393', '#636e72', '#2d3436', '#fd9644', '#00cec9'
]

export default function TagsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()

  const [context, setContext] = useState<'dfl' | 'personal'>('dfl')
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editingTag, setEditingTag] = useState<any | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(TAG_COLORS[0])
  const [saving, setSaving] = useState(false)

  // ============================================================
  // 🔥 BUSCA LOCAL DE TAGS (INDEXEDDB)
  // ============================================================
  const { data: localTags, loading: tagsLoading, reload: reloadTags } = useLocalData({
    table: 'tags',
    filters: { context },
    orderBy: { field: 'name', direction: 'asc' },
    realtime: true,
  })

  // ============================================================
  // LOAD DATA
  // ============================================================
  const loadTags = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    try {
      await reloadTags()
    } catch (err) {
      console.error("Erro ao carregar tags:", err)
      showToast("Erro ao carregar tags: " + (err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [user?.id, reloadTags, showToast])

  useEffect(() => {
    if (user?.id) { loadTags() }
  }, [loadTags])

  // ============================================================
  // HANDLERS (COM HOOK LOCAL)
  // ============================================================
  function openEdit(tag: any) {
    setEditingTag(tag)
    setName(tag.name)
    setColor(tag.color)
    setShowForm(true)
  }

  function openNew() {
    setEditingTag(null)
    setName('')
    setColor(TAG_COLORS[0])
    setShowForm(true)
  }

  async function handleSave() {
    if (!name.trim() || !user?.id) return
    setSaving(true)

    const payload = { user_id: user.id, context, name: name.trim(), color }

    try {
      const { create, update } = useLocalData({ table: 'tags' })
      
      if (editingTag) {
        await update(editingTag.id, payload)
        showToast('Tag atualizada!', 'success')
      } else {
        await create(payload)
        showToast('Tag criada!', 'success')
      }
      setShowForm(false)
      loadTags()
    } catch (err: any) {
      console.error("Erro ao salvar tag:", err)
      showToast("Erro ao salvar tag: " + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja realmente excluir esta tag?')) return
    setSaving(true)
    try {
      const { remove } = useLocalData({ table: 'tags' })
      await remove(id)
      showToast('Tag excluída.', 'info')
      setShowForm(false)
      loadTags()
    } catch (err: any) {
      console.error("Erro ao excluir:", err)
      showToast("Erro ao excluir: " + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const tags = localTags || []

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-24 font-sans relative transition-colors duration-300">

      <div className="bg-[#f8f9fa] dark:bg-slate-900 px-4 pt-6 pb-2 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[17px] font-bold text-gray-800 dark:text-gray-100">Tags</h1>
          <button onClick={openNew} className="p-2 -mr-2 text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors">
            <Plus size={24} />
          </button>
        </div>

        <div className="flex bg-white dark:bg-slate-800 rounded-full p-1 border border-gray-100 dark:border-slate-700 max-w-[220px] mx-auto shadow-sm">
          {(['dfl', 'personal'] as const).map(c => (
            <button key={c} onClick={() => setContext(c)} className={`flex-1 py-1.5 rounded-full text-[13px] font-bold transition-all duration-300 ${context === c ? 'bg-[#f4f6f8] dark:bg-slate-700 text-gray-800 dark:text-gray-200 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]' : 'text-gray-400 dark:text-gray-500'}`}>
              {c === 'dfl' ? 'DFL' : 'Pessoal'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-6">
        {loading ? (
          <div className="space-y-2">
            <Skeleton variant="rect" height="48px" count={6} />
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500 text-[14px]">Nenhuma tag cadastrada.</div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-none border border-gray-50 dark:border-slate-700 overflow-hidden">
            {tags.map((tag: any, index: number) => (
              <div key={tag.id} className={`flex items-center justify-between px-5 py-4 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer ${index !== tags.length - 1 ? 'border-b border-gray-50 dark:border-slate-700' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className="w-6 h-6 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: tag.color }}></div>
                  <div><p className="text-[15px] font-bold text-gray-800 dark:text-gray-200">{tag.name}</p></div>
                </div>
                <div className="flex items-center gap-4 text-gray-300 dark:text-gray-600">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(tag); }} className="p-2 hover:text-teal-700 dark:hover:text-teal-400 transition-colors">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col justify-end" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-slate-800 flex-1 w-full max-w-md mx-auto mt-24 rounded-t-[32px] relative shadow-2xl flex flex-col animate-in slide-in-from-bottom-full duration-300" onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-50 dark:border-slate-700">
              <h2 className="font-bold text-[17px] text-gray-800 dark:text-gray-100">{editingTag ? 'Editar Tag' : 'Nova Tag'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 -mr-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">

              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center gap-3 border border-gray-100 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 rounded-full px-5 py-2 shadow-sm">
                  <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: color }}></div>
                  <span className="text-[15px] font-bold text-gray-700 dark:text-gray-200">{name || 'Nome da tag'}</span>
                </div>
              </div>

              <div className="mb-8">
                <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Nome</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: viagem, reembolso, ifood" className="w-full bg-transparent border-b-2 border-gray-100 dark:border-slate-600 py-3 text-[16px] outline-none focus:border-teal-600 font-bold text-gray-800 dark:text-gray-200 transition-colors placeholder:text-gray-300 dark:placeholder:text-gray-500 placeholder:font-normal" />
              </div>

              <div className="mb-8">
                <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 block">Cor da Tag</label>
                <div className="grid grid-cols-5 gap-4">
                  {TAG_COLORS.map(c => (
                    <button key={c} onClick={() => setColor(c)} className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm" style={{ backgroundColor: c, transform: color === c ? 'scale(1.15)' : 'scale(1)', boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : 'none' }} />
                  ))}
                </div>
              </div>

              {editingTag && (
                <div className="flex justify-center mt-10">
                  <button onClick={() => handleDelete(editingTag.id)} className="flex items-center gap-2 text-red-500 font-bold text-[14px] py-2 px-4 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <Trash2 size={18} /> Excluir tag
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 bg-white dark:bg-slate-800 border-t border-gray-50 dark:border-slate-700 pb-8">
              <button onClick={handleSave} disabled={saving || !name.trim()} className="w-full bg-teal-700 hover:bg-teal-800 text-white py-4 rounded-[20px] font-bold text-[15px] disabled:opacity-50 transition-colors shadow-lg shadow-teal-700/20 flex justify-center items-center h-14">
                {saving ? <Loader2 className="animate-spin" size={24} /> : (editingTag ? 'Salvar Alterações' : 'Criar Tag')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}