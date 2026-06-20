'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'

export default function NewCardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [card, setCard] = useState({ name: '', institution: '', last_four: '', closing_day: 1, due_day: 1, color: '#1d3557' })

  async function handleSave() {
    if (!user) return
    setLoading(true)
    await supabase.from('credit_cards').insert([{ ...card, user_id: user.id, context: 'personal' }])
    router.back()
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] p-6 font-sans">
      <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-gray-600 font-medium"><ArrowLeft size={20} /> Voltar</button>
      <h1 className="text-xl font-bold mb-6">Novo Cartão</h1>
      <div className="space-y-4 bg-white p-6 rounded-[24px] shadow-sm">
        <input className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none" placeholder="Apelido (ex: Nubank)" value={card.name} onChange={e => setCard({...card, name: e.target.value})} />
        <input className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none" placeholder="Instituição (ex: Banco Inter)" value={card.institution} onChange={e => setCard({...card, institution: e.target.value})} />
        <input className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none" placeholder="Últimos 4 dígitos" value={card.last_four} onChange={e => setCard({...card, last_four: e.target.value})} />
        <button onClick={handleSave} className="w-full bg-teal-700 text-white p-4 rounded-2xl font-bold flex justify-center items-center gap-2">
          {loading ? <Loader2 className="animate-spin" /> : <><Save size={20} /> Salvar Cartão</>}
        </button>
      </div>
    </div>
  )
}
