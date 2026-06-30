'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  ChevronLeft, Edit3, Trash2, Loader2, Phone, Mail, Building, User,
  ArrowDown, ArrowUp, Clock, Check, Plus
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'

export default function ContactDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()
  const [contact, setContact] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [totalToPay, setTotalToPay] = useState(0)
  const [totalToReceive, setTotalToReceive] = useState(0)

  useEffect(() => {
    if (!user?.id || !params?.id) return
    loadContact()
  }, [user?.id, params?.id])

  const loadContact = async () => {
    setLoading(true)
    const { data: contactData } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', params.id)
      .single()

    if (!contactData) {
      router.push('/contacts')
      return
    }
    setContact(contactData)

    const { data: txs } = await supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('contact_id', params.id)
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(20)

    const txsArray = Array.isArray(txs) ? txs : []
    setTransactions(txsArray)
    setTotalToPay(txsArray.filter(t => t.type === 'expense' && t.status === 'pending').reduce((a, t) => a + Number(t.amount), 0))
    setTotalToReceive(txsArray.filter(t => t.type === 'income' && t.status === 'pending').reduce((a, t) => a + Number(t.amount), 0))
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!confirm('Excluir este contato?')) return
    await supabase.from('contacts').delete().eq('id', params.id)
    showToast('Contato excluído.', 'info')
    router.push('/contacts')
  }

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'supplier': return 'Fornecedor'
      case 'customer': return 'Cliente'
      case 'both': return 'Fornecedor/Cliente'
      default: return type
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
        <Loader2 className="animate-spin text-teal-700" size={40} />
      </div>
    )
  }

  if (!contact) return null

  const IconComp = getDynamicIcon(contact.icon || 'user')

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/contacts')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">{contact.name}</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push(`/contacts/${contact.id}/edit`)} className="p-2 text-gray-400 hover:text-teal-600">
              <Edit3 size={18} />
            </button>
            <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-500">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Card principal */}
        <div className="rounded-2xl p-5 text-white shadow-lg" style={{ backgroundColor: contact.color || '#14b8a6' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <IconComp size={24} />
            </div>
            <div>
              <h2 className="font-bold text-lg">{contact.name}</h2>
              <p className="text-white/70 text-xs">{getTypeLabel(contact.type)}</p>
            </div>
          </div>
          <div className="space-y-2">
            {contact.email && (
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Mail size={14} /> {contact.email}
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Phone size={14} /> {contact.phone}
              </div>
            )}
          </div>
        </div>

        {/* Resumo financeiro */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 text-center">
            <ArrowDown size={18} className="text-red-500 mx-auto mb-1" />
            <p className="text-[10px] text-gray-400 font-bold">A Pagar</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totalToPay)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 text-center">
            <ArrowUp size={18} className="text-emerald-500 mx-auto mb-1" />
            <p className="text-[10px] text-gray-400 font-bold">A Receber</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalToReceive)}</p>
          </div>
        </div>

        {/* Transações vinculadas */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="flex justify-between items-center px-5 py-4 border-b border-gray-50 dark:border-slate-700">
            <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200">Transações</h3>
            <button
              onClick={() => router.push(`/transactions/new?contact_id=${contact.id}`)}
              className="text-teal-700 dark:text-teal-400 p-1"
            >
              <Plus size={20} />
            </button>
          </div>
          {transactions.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">
              Nenhuma transação vinculada.
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-slate-700">
              {transactions.map(tx => {
                const isIncome = tx.type === 'income'
                const isPending = tx.status === 'pending'
                const IconComp = getDynamicIcon(tx.categories?.icon || 'tag')
                return (
                  <div
                    key={tx.id}
                    onClick={() => router.push(`/transactions/${tx.id}`)}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {isPending ? (
                        <Clock size={14} className="text-orange-500" />
                      ) : (
                        <Check size={14} className="text-emerald-500" />
                      )}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${tx.categories?.color || '#94a3b8'}20`, color: tx.categories?.color || '#64748b' }}
                      >
                        <IconComp size={14} />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200">
                          {tx.description || 'Sem descrição'}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {format(new Date(tx.date), "dd/MM/yy")} • {tx.categories?.name || 'Geral'}
                        </p>
                      </div>
                    </div>
                    <p className={`text-[14px] font-bold ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {contact.notes && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
            <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-2">Observações</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{contact.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}