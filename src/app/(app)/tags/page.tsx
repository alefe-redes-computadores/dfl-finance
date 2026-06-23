'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, ChevronRight, GripVertical, Trash2, X, Loader2 } from 'lucide-react'

// Paleta de cores premium (tons pastéis e sóbrios)
const TAG_COLORS = [
  '#264653', '#2a9d8f', '#1d3557', '#e76f51', '#2ecc71', '#00b894',
  '#ff7675', '#d63031', '#fdcb6e', '#e17055', '#74b9ff', '#0984e3',
  '#a29bfe', '#6c5ce7', '#fd79a8', '#e84393', '#636e72', '#2d3436',
  '#fd9644', '#00cec9'
]

export default function TagsPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [tags, setTags] = useState<any[]>([])
  const [context, setContext] = useState<'dfl' | 'personal'>('dfl')
  const [loading, setLoading] = useState(true)

  // Estados do Modal
  const [showForm, setShowForm] = useState(false)
  const [editingTag, setEditingTag] = useState<any | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(TAG_COLORS[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user?.id) {
      loadTags()
    }
  }, [user?.id, context])

  async function loadTags() {
    setLoading(true)
    // Buscando apenas pelo nome para não quebrar com colunas inexistentes (ex: sort_order)
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', user!.id)
      .eq('context', context)
      .order('name', { ascending: true })

    if (error) {
      console.error("Erro ao carregar tags:", error)
    }

    setTags(data ?? [])
    setLoading(false)
  }

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

    const payload = {
      user_id: user.id,
      context,
      name: name.trim(),
      color
    }

    try {
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
      console.error("Erro ao salvar tag:", err)
      alert("Erro ao salvar tag: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja realmente excluir esta tag?')) return
    setSaving(true)
    
    try {
      const { error } = await supabase.from('tags').delete().eq('id', id)
      if (error) throw error
      setShowForm(false)
      loadTags()
    } catch (err: any) {
      console.error("Erro ao excluir:", err)
      alert("Erro ao excluir: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] pb-24 font-sans relative">
      
      {/* Header Premium */}
      <div className="bg-[#f8f9fa] px-4 pt-6 pb-2 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 hover:text-gray-600 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[17px] font-bold text-gray-800">Tags</h1>
          <button onClick={openNew} className="p-2 -mr-2 text-teal-700 hover:text-teal-800 transition-colors">
            <Plus size={24} />
          </button>
        </div>

        {/* Seletor Estilo Kontto */}
        <div className="flex bg-white rounded-full p-1 border border-gray-100 max-w-[220px] mx-auto shadow-sm">
          {(['dfl', 'personal'] as const).map(c => (
            <button
              key={c}
              onClick={() => setContext(c)}
              className={`flex-1 py-1.5 rounded-full text-[13px] font-bold transition-all duration-300 ${
                context === c ? 'bg-[#f4f6f8] text-gray-800 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]' : 'text-gray-400'
              }`}
            >
              {c === 'dfl' ? 'DFL' : 'Pessoal'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Tags */}
      <div className="px-4 mt-6">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-teal-700" size={32} /></div>
        ) : tags.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-[14px]">Nenhuma tag cadastrada.</div>
        ) : (
          <div className="bg-white rounded-[24px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-50 overflow-hidden">
            {tags.map((tag, index) => (
              <div 
                key={tag.id} 
                className={`flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors cursor-pointer ${index !== tags.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-6 h-6 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: tag.color }}></div>
                  <div>
                    <p className="text-[15px] font-bold text-gray-800">{tag.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-gray-300">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(tag); }} className="p-2 hover:text-teal-700 transition-colors">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Nova/Editar Tag */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col justify-end" onClick={() => setShowForm(false)}>
          <div className="bg-white flex-1 w-full max-w-md mx-auto mt-24 rounded-t-[32px] relative shadow-2xl flex flex-col animate-in slide-in-from-bottom-full duration-300" onClick={e => e.stopPropagation()}>
            
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-50">
              <h2 className="font-bold text-[17px] text-gray-800">{editingTag ? 'Editar Tag' : 'Nova Tag'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              
              {/* Preview Badge Elegante */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center gap-3 border border-gray-100 bg-gray-50 rounded-full px-5 py-2 shadow-sm">
                  <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: color }}></div>
                  <span className="text-[15px] font-bold text-gray-700">{name || 'Nome da tag'}</span>
                </div>
              </div>

              <div className="mb-8">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Nome</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: viagem, reembolso, ifood"
                  className="w-full bg-transparent border-b-2 border-gray-100 py-3 text-[16px] outline-none focus:border-teal-600 font-bold text-gray-800 transition-colors placeholder:text-gray-300 placeholder:font-normal"
                />
              </div>

              <div className="mb-8">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4 block">Cor da Tag</label>
                <div className="grid grid-cols-5 gap-4">
                  {TAG_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm"
                      style={{ 
                        backgroundColor: c,
                        transform: color === c ? 'scale(1.15)' : 'scale(1)',
                        boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : 'none'
                      }}
                    >
                    </button>
                  ))}
                </div>
              </div>

              {editingTag && (
                <div className="flex justify-center mt-10">
                  <button onClick={() => handleDelete(editingTag.id)} className="flex items-center gap-2 text-red-500 font-bold text-[14px] py-2 px-4 rounded-xl hover:bg-red-50 transition-colors">
                    <Trash2 size={18} /> Excluir tag
                  </button>
                </div>
              )}

            </div>

            {/* Botão Salvar Estilo Kontto */}
            <div className="p-6 bg-white border-t border-gray-50 pb-8">
              <button 
                onClick={handleSave} 
                disabled={saving || !name.trim()} 
                className="w-full bg-teal-700 hover:bg-teal-800 text-white py-4 rounded-[20px] font-bold text-[15px] disabled:opacity-50 transition-colors shadow-lg shadow-teal-700/20 flex justify-center items-center h-14"
              >
                {saving ? <Loader2 className="animate-spin" size={24} /> : (editingTag ? 'Salvar Alterações' : 'Criar Tag')}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
