'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, ChevronRight, Trash2, X, Loader2 } from 'lucide-react'

// Paleta de cores para as tags - Mantida conforme seu design
const TAG_COLORS = [
  '#264653', '#2a9d8f', '#1d3557', '#e76f51', '#2ecc71', 
  '#00b894', '#ff7675', '#d63031', '#fdcb6e', '#e17055',
  '#74b9ff', '#0984e3', '#a29bfe', '#6c5ce7', '#fd79a8'
]

export default function TagsPage() {
  const { user } = useAuth()
  const router = useRouter()

  // Estados de dados
  const [tags, setTags] = useState<any[]>([])
  const [context, setContext] = useState<'dfl' | 'personal'>('dfl')
  const [loading, setLoading] = useState(true)

  // Estados de Modal e Formulário
  const [showForm, setShowForm] = useState(false)
  const [editingTag, setEditingTag] = useState<any | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(TAG_COLORS[0])
  const [saving, setSaving] = useState(false)

  // Carregar tags do banco
  const loadTags = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    
    // CORREÇÃO: Removido sort_order para evitar erro de banco de dados
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
      .order('name', { ascending: true })

    if (error) {
      console.error("Erro ao carregar tags:", error)
    }

    setTags(data ?? [])
    setLoading(false)
  }, [user?.id, context])

  useEffect(() => {
    if (user?.id) loadTags()
  }, [loadTags])

  // Salvar / Editar
  async function handleSave() {
    if (!name.trim() || !user?.id) return
    setSaving(true)

    try {
      const payload = {
        user_id: user.id,
        context,
        name: name.trim(),
        color
      }

      if (editingTag) {
        const { error } = await supabase.from('tags').update(payload).eq('id', editingTag.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('tags').insert([payload])
        if (error) throw error
      }

      setShowForm(false)
      loadTags()
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Deletar
  async function handleDelete(id: string) {
    if (!confirm('Deseja excluir esta tag?')) return
    setSaving(true)
    try {
      const { error } = await supabase.from('tags').delete().eq('id', id)
      if (error) throw error
      setShowForm(false)
      loadTags()
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] pb-24 font-sans relative">
      {/* Header */}
      <div className="bg-[#f8f9fa] px-4 pt-6 pb-2 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800"><ChevronLeft size={24} /></button>
          <h1 className="text-[17px] font-bold text-gray-800">Tags</h1>
          <button onClick={() => { setEditingTag(null); setName(''); setShowForm(true); }} className="p-2 -mr-2 text-teal-700"><Plus size={24} /></button>
        </div>

        {/* Seletor DFL/Pessoal */}
        <div className="flex bg-white rounded-full p-1 border border-gray-100 max-w-[220px] mx-auto shadow-sm">
          {(['dfl', 'personal'] as const).map(c => (
            <button
              key={c}
              onClick={() => setContext(c)}
              className={`flex-1 py-1.5 rounded-full text-[13px] font-bold transition-all ${context === c ? 'bg-[#f4f6f8] text-gray-800 shadow-sm' : 'text-gray-400'}`}
            >
              {c === 'dfl' ? 'DFL' : 'Pessoal'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 mt-6">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-teal-700" size={32} /></div>
        ) : tags.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-[14px]">Nenhuma tag encontrada.</div>
        ) : (
          <div className="bg-white rounded-[24px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-50 overflow-hidden">
            {tags.map((tag) => (
              <div 
                key={tag.id} 
                onClick={() => { setEditingTag(tag); setName(tag.name); setColor(tag.color); setShowForm(true); }}
                className="flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-6 h-6 rounded-full shadow-sm" style={{ backgroundColor: tag.color }}></div>
                  <p className="text-[15px] font-bold text-gray-800">{tag.name}</p>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col justify-end" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-md mx-auto mt-24 rounded-t-[32px] p-6 shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-[17px] text-gray-800">{editingTag ? 'Editar Tag' : 'Nova Tag'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400"><X size={24} /></button>
            </div>
            
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Aluguel, Mercado"
              className="w-full bg-gray-50 border-none p-4 rounded-xl mb-6 text-[16px] font-bold text-gray-800 outline-none"
            />

            <div className="grid grid-cols-5 gap-3 mb-8">
              {TAG_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-full ${color === c ? 'ring-4 ring-offset-2 ring-teal-200' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <button 
              onClick={handleSave} 
              disabled={saving}
              className="w-full bg-teal-700 text-white py-4 rounded-[20px] font-bold text-[15px] shadow-lg mb-3"
            >
              {saving ? 'Salvando...' : (editingTag ? 'Salvar Alterações' : 'Criar Tag')}
            </button>

            {editingTag && (
              <button onClick={() => handleDelete(editingTag.id)} className="w-full text-red-500 font-bold text-[14px] py-2">
                Excluir Tag
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
