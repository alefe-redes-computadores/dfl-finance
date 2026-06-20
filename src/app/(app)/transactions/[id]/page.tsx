'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save, Trash2, Loader2, Calendar } from 'lucide-react'
import { format } from 'date-fns'

export default function EditTransactionPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tx, setTx] = useState<any>(null)

  useEffect(() => {
    async function loadTransaction() {
      if (!id) return
      const { data } = await supabase
        .from('transactions')
        .select('*, categories(name)')
        .eq('id', id)
        .single()
      
      if (data) setTx(data)
      setLoading(false)
    }
    loadTransaction()
  }, [id])

  async function handleUpdate() {
    setLoading(true)
    await supabase
      .from('transactions')
      .update({ 
        amount: tx.amount, 
        description: tx.description, 
        date: tx.date,
        status: tx.status,
        type: tx.type
      })
      .eq('id', id)
    router.back()
  }

  async function handleDelete() {
    if (!confirm('Excluir esta transação?')) return
    setLoading(true)
    await supabase.from('transactions').delete().eq('id', id)
    router.back()
  }

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-teal-700" /></div>

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] p-6 font-sans">
      <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-gray-600 font-medium">
        <ArrowLeft size={20} /> Voltar
      </button>
      
      <h1 className="text-xl font-bold text-gray-800 mb-6">Editar Transação</h1>

      <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 space-y-4">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">Descrição</label>
          <input className="w-full p-4 mt-1 bg-gray-50 rounded-2xl border-none" value={tx.description || ''} onChange={e => setTx({...tx, description: e.target.value})} />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">Valor</label>
          <input type="number" className="w-full p-4 mt-1 bg-gray-50 rounded-2xl border-none" value={tx.amount || 0} onChange={e => setTx({...tx, amount: parseFloat(e.target.value)})} />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">Data</label>
          <input type="date" className="w-full p-4 mt-1 bg-gray-50 rounded-2xl border-none" value={tx.date || ''} onChange={e => setTx({...tx, date: e.target.value})} />
        </div>

        <button onClick={handleUpdate} className="w-full bg-teal-700 text-white p-4 rounded-2xl font-bold flex justify-center items-center gap-2 mt-4">
          <Save size={20} /> Salvar Alterações
        </button>

        <button onClick={handleDelete} className="w-full bg-red-50 text-red-500 p-4 rounded-2xl font-bold flex justify-center items-center gap-2">
          <Trash2 size={20} /> Excluir
        </button>
      </div>
    </div>
  )
}
