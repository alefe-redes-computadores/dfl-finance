'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, ChevronRight, GripVertical, Trash2, X } from 'lucide-react'

// Paleta de cores baseada no seu print
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
    if (user) loadTags()
  }, [user, context])

  async function loadTags() {
    setLoading(true)
    const { data } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', user!.id)
      .eq('context', context)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

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
    if (!name.trim()) return
    setSaving(true)

    if (editingTag) {
      await supabase.from('tags').update({ name, color }).eq('id', editingTag.id)
    } else {
      await supabase.from('tags').insert({
        user_id: user!.id,
        context,
        name,
        color,
        sort_order: tags.length + 1
      })
    }

    setShowForm(false)
    setSaving(false)
    loadTags()
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja realmente excluir esta tag?')) return
    await supabase.from('tags').delete().eq('id', id)
    setShowForm(false)
    loadTags()
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] pb-24 font-sans">
      
      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-4 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800">Tags</h1>
          <button onClick={openNew} className="p-2 -mr-2 text-emerald-800">
            <Plus size={24} />
          </button>
        </div>

        {/* Seletor DFL / Pessoal */}
        <div className="flex bg-gray-100 rounded-full p-1 w-full max-w-[200px] mx-auto">
          {(['dfl', 'personal'] as const).map(c => (
            <button
              key={c}
              onClick={() => setContext(c)}
              className={`flex-1 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
                context === c ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
              }`}
            >
              {c === 'dfl' ? 'DFL' : 'Pessoal'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Tags */}
      <div className="px-4 space-y-1">
        {loading ? (
          <div className="text-center py-10 text-gray-400 text-sm">Carregando tags...</div>
        ) : tags.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Nenhuma tag cadastrada.</div>
        ) : (
          tags.map(tag => (
            <div key={tag.id} className="flex items-center justify-between bg-white px-4 py-3 border-b border-gray-50 last:border-0 rounded-xl mb-2 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: tag.color }}></div>
                <div>
                  <p className="text-[15px] font-bold text-gray-800">{tag.name}</p>
                  <p className="text-[11px] text-gray-400 font-medium">0 transações</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-gray-400">
                <button className="cursor-grab active:cursor-grabbing hover:text-gray-600">
                  <GripVertical size={18} />
                </button>
                <button onClick={() => openEdit(tag)} className="hover:text-emerald-700">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Nova/Editar Tag */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-[#f8f9fa] flex flex-col" onClick={() => setShowForm(false)}>
          <div className="bg-white flex-1 w-full max-w-md mx-auto relative shadow-2xl" onClick={e => e.stopPropagation()}>
            
            <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-gray-100">
              <button onClick={() => setShowForm(false)} className="p-2 -ml-2"><ChevronLeft size={24} className="text-gray-800"/></button>
              <h2 className="font-bold text-lg text-gray-800">{editingTag ? 'Editar Tag' : 'Nova Tag'}</h2>
              <div className="w-8"></div> {/* Espaçador */}
            </div>

            <div className="p-6">
              {/* Preview Badge */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center gap-2 border border-gray-200 rounded-full px-4 py-1.5 shadow-sm">
                  <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: color }}></div>
                  <span className="text-sm font-bold text-gray-700">{name || 'sua tag'}</span>
                </div>
              </div>

              <div className="mb-8">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Nome</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: viagem, reembolso, presente"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 font-medium text-gray-800"
                />
              </div>

              <div className="mb-8">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 block">Cor</label>
                <div className="flex flex-wrap gap-3">
                  {TAG_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <ChevronRight size={16} className="text-white transform rotate-90" />}
                    </button>
                  ))}
                </div>
              </div>

              {editingTag && (
                <div className="flex justify-center mb-6">
                  <button onClick={() => handleDelete(editingTag.id)} className="flex items-center gap-2 text-red-500 font-bold text-sm py-2 px-4 rounded-xl hover:bg-red-50 transition-colors">
                    <Trash2 size={16} /> Excluir tag
                  </button>
                </div>
              )}

            </div>

            <div className="absolute bottom-0 left-0 w-full p-4 bg-white border-t border-gray-50">
              <button onClick={handleSave} disabled={saving || !name.trim()} className="w-full bg-emerald-800 text-white py-3.5 rounded-xl font-bold disabled:opacity-50">
                {saving ? 'Salvando...' : editingTag ? 'Salvar' : 'Criar tag'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
