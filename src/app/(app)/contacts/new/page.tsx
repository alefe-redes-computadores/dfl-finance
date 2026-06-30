'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  ChevronLeft, User, Phone, Mail, Building, Loader2, Check, X
} from 'lucide-react'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'

const CONTACT_COLORS = ['#14b8a6', '#8b5cf6', '#f97316', '#ef4444', '#22c55e', '#eab308', '#3b82f6', '#ec4899']

export default function ContactFormPage() {
  const router = useRouter()
  const params = useParams()
  const isEditing = !!params?.id
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [type, setType] = useState<'supplier' | 'customer' | 'both'>('supplier')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [color, setColor] = useState('#14b8a6')
  const [icon, setIcon] = useState('user')

  useEffect(() => {
    if (!user?.id) return
    if (isEditing) loadContact()
  }, [user?.id])

  const loadContact = async () => {
    setLoading(true)
    const { data } = await supabase.from('contacts').select('*').eq('id', params.id).single()
    if (data) {
      setName(data.name)
      setType(data.type)
      setEmail(data.email || '')
      setPhone(data.phone || '')
      setNotes(data.notes || '')
      setColor(data.color)
      setIcon(data.icon)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!user?.id || !name.trim()) return
    setSaving(true)

    const payload = {
      user_id: user.id,
      name: name.trim(),
      type,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      color,
      icon,
      context,
    }

    try {
      if (isEditing) {
        await supabase.from('contacts').update(payload).eq('id', params.id)
      } else {
        await supabase.from('contacts').insert(payload)
      }
      showToast(isEditing ? 'Contato atualizado!' : 'Contato criado!', 'success')
      router.back()
    } catch (err: any) {
      showToast(`Erro: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
        <Loader2 className="animate-spin text-teal-700" size={40} />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {isEditing ? 'Editar Contato' : 'Novo Contato'}
          </h1>
          <div className="w-10" />
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Nome */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do fornecedor ou cliente"
            className="w-full bg-transparent outline-none font-bold text-gray-800 dark:text-gray-200 text-lg"
          />
        </div>

        {/* Tipo */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-3">Tipo</label>
          <div className="flex gap-2">
            {[
              { key: 'supplier', label: 'Fornecedor', icon: 'Building' },
              { key: 'customer', label: 'Cliente', icon: 'User' },
              { key: 'both', label: 'Ambos', icon: 'Users' },
            ].map(opt => {
              const IconComp = getDynamicIcon(opt.icon)
              return (
                <button
                  key={opt.key}
                  onClick={() => setType(opt.key as any)}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-colors ${
                    type === opt.key
                      ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-700 text-teal-800 dark:text-teal-300'
                      : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <IconComp size={16} />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Email */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Email (opcional)</label>
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="flex-1 bg-transparent outline-none text-sm text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>

        {/* Telefone */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Telefone (opcional)</label>
          <div className="flex items-center gap-2">
            <Phone size={16} className="text-gray-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="flex-1 bg-transparent outline-none text-sm text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>

        {/* Cor */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-3">Cor</label>
          <div className="flex flex-wrap gap-3">
            {CONTACT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'scale-125 border-2 border-white shadow-md' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Observações */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Observações (opcional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalhes sobre o contato..."
            className="w-full bg-transparent outline-none text-sm text-gray-700 dark:text-gray-300"
          />
        </div>

        {/* Botão salvar */}
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="w-full bg-teal-700 text-white py-4 rounded-2xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
          {saving ? 'Salvando...' : isEditing ? 'Atualizar contato' : 'Criar contato'}
        </button>
      </div>
    </div>
  )
}