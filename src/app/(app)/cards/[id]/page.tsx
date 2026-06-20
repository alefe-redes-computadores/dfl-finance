'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save, Trash2, Loader2 } from 'lucide-react'

export default function EditCardPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [card, setCard] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('credit_cards').select('*').eq('id', id).single()
      setCard(data)
      setLoading(false)
    }
    load()
  }, [id])

  async function handleUpdate() {
    setLoading(true)
    await supabase.from('credit_cards').update(card).eq('id', id)
    router.back()
  }

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div>

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] p-6 font-sans">
      <button onClick={() => router.back()} className="mb-6 flex items-center gap-2"><ArrowLeft size={20} /> Voltar</button>
      <h1 className="text-xl font-bold mb-6">Editar Cartão</h1>
      <div className="space-y-4 bg-white p-6 rounded-[24px] shadow-sm">
        <input className="w-full p-4 bg-gray-50 rounded-2xl border-none" value={card.name} onChange={e => setCard({...card, name: e.target.value})} />
        <button onClick={handleUpdate} className="w-full bg-teal-700 text-white p-4 rounded-2xl font-bold">Salvar</button>
      </div>
    </div>
  )
}
