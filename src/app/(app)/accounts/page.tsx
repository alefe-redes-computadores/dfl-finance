'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, Trash2, Landmark } from 'lucide-react'

const PERSONAL_BANKS = [
  { slug: 'bradesco', name: 'Bradesco', color: '#dc2626', emoji: '🔴' },
  { slug: 'caixa', name: 'Caixa', color: '#0284c7', emoji: '🏦' },
  { slug: 'carteira', name: 'Carteira', color: '#16a34a', emoji: '👛' },
  { slug: 'itau', name: 'Itaú', color: '#f97316', emoji: '🟠' },
  { slug: 'nubank', name: 'Nubank', color: '#8b5cf6', emoji: '🟣' },
  { slug: 'outra', name: 'Outra', color: '#94a3b8', emoji: '🏛️' },
]

const DFL_BANKS = [
  { slug: 'cora', name: 'Cora', color: '#7c3aed', emoji: '🟣' },
  { slug: 'ifood-pago', name: 'iFood Pago', color: '#ea1d2c', emoji: '🍔' },
  { slug: 'infinitpay', name: 'InfinitPay', color: '#111827', emoji: '⚫' },
  { slug: 'mercado-pago', name: 'Mercado Pago', color: '#009ee3', emoji: '💙' },
  { slug: 'pagbank', name: 'PagBank', color: '#22c55e', emoji: '💚' },
  { slug: 'stone', name: 'Stone', color: '#00a868', emoji: '🟢' },
  { slug: 'outra', name: 'Outra', color: '#94a3b8', emoji: '🏛️' },
]

const ALL_BANKS = [...PERSONAL_BANKS, ...DFL_BANKS]

const COLORS = ['#16a34a','#dc2626','#ea580c','#0891b2','#7c3aed','#f97316','#94a3b8','#ec4899','#14b8a6']

export default function AccountsPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [accounts, setAccounts] = useState<any[]>([])
  const [context, setContext] = useState<'personal' | 'dfl'>('personal')
  const [showForm, setShowForm] = useState(false)

  const [name, setName] = useState('')
  const [bankSlug, setBankSlug] = useState(PERSONAL_BANKS[0].slug)
  const [color, setColor] = useState(PERSONAL_BANKS[0].color)
  const [rawBalance, setRawBalance] = useState('')

  const AVAILABLE_BANKS = context === 'personal' ? PERSONAL_BANKS : DFL_BANKS

  useEffect(() => {
    if (user) loadAccounts()
  }, [user, context])

  async function loadAccounts() {
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user!.id)
      .eq('context', context)
      .order('name')

    setAccounts(data ?? [])
  }

  function resetForm() {
    const defaultBank = AVAILABLE_BANKS[0]
    setName('')
    setBankSlug(defaultBank.slug)
    setColor(defaultBank.color)
    setRawBalance('')
  }

  async function handleSave() {
    if (!name.trim()) return

    const { error } = await supabase.from('accounts').insert({
      user_id: user!.id,
      name: name.trim(),
      bank_slug: bankSlug,
      balance: Number(rawBalance || '0') / 100,
      context,
      color,
    })

    if (!error) {
      resetForm()
      setShowForm(false)
      loadAccounts()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja excluir esta conta?')) return
    await supabase.from('accounts').delete().eq('id', id)
    loadAccounts()
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 p-4 font-sans text-sm">
      {/* versão completa adaptada */}
    </div>
  )
}
