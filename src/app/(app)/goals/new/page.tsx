'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  ChevronLeft, Target, Loader2, Check, X,
  Tag, Wallet, ChevronDown, Plus
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import BankLogo from '@/components/BankLogo'
import { useToast } from '@/contexts/ToastContext'

const GOAL_COLORS = ['#14b8a6', '#8b5cf6', '#f97316', '#ef4444', '#22c55e', '#eab308', '#ec4899']

export default function GoalFormPage() {
  const router = useRouter()
  const params = useParams()
  const isEditing = !!params?.id
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [color, setColor] = useState('#14b8a6')
  const [icon, setIcon] = useState('target')
  const [notes, setNotes] = useState('')
  const [sourceType, setSourceType] = useState<'manual' | 'category' | 'tag' | 'account'>('manual')
  const [categoryId, setCategoryId] = useState('')
  const [tagId, setTagId] = useState('')
  const [accountId, setAccountId] = useState('')

  const [categories, setCategories] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])

  const [showCatModal, setShowCatModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [showAccModal, setShowAccModal] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    loadData()
    if (isEditing) loadGoal()
  }, [user?.id, context])

  const loadData = async () => {
    const [{ data: cats }, { data: tgs }, { data: accs }] = await Promise.all([
      supabase.from('categories').select('id, name, icon, color').eq('user_id', user.id).eq('context', context).eq('type', 'expense'),
      supabase.from('tags').select('id, name, color').eq('user_id', user.id).eq('context', context).order('name'),
      supabase.from('accounts').select('id, name, color').eq('user_id', user.id).eq('context', context).order('name'),
    ])
    setCategories(cats || [])
    setTags(tgs || [])
    setAccounts(accs || [])
  }

  const loadGoal = async () => {
    setLoading(true)
    const { data } = await supabase.from('goals').select('*').eq('id', params.id).single()
    if (data) {
      setName(data.name)
      setTargetAmount(Number(data.target_amount).toFixed(2).replace('.', ','))
      setDeadline(data.deadline || '')
      setColor(data.color)
      setIcon(data.icon)
      setNotes(data.notes || '')
      setSourceType(data.tag_id ? 'tag' : data.category_id ? 'category' : data.account_id ? 'account' : 'manual')
      setCategoryId(data.category_id || '')
      setTagId(data.tag_id || '')
      setAccountId(data.account_id || '')
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!user?.id) return
    const rawAmount = parseFloat(targetAmount.replace(',', '.'))
    if (!name.trim() || isNaN(rawAmount) || rawAmount <= 0) {
      showToast('Preencha nome e valor alvo.', 'warning')
      return
    }
    setSaving(true)

    const payload: any = {
      user_id: user.id,
      name: name.trim(),
      target_amount: rawAmount,
      deadline: deadline || null,
      color,
      icon,
      notes: notes || null,
      category_id: sourceType === 'category' ? categoryId : null,
      tag_id: sourceType === 'tag' ? tagId : null,
      account_id: sourceType === 'account' ? accountId : null,
      context,
    }

    try {
      if (isEditing) {
        await supabase.from('goals').update(payload).eq('id', params.id)
      } else {
        await supabase.from('goals').insert(payload)
      }
      showToast(isEditing ? 'Meta atualizada!' : 'Meta criada!', 'success')
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

  const selectedCat = categories.find(c => c.id === categoryId)
  const selectedTag = tags.find(t => t.id === tagId)
  const selectedAcc = accounts.find(a => a.id === accountId)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {isEditing ? 'Editar Meta' : 'Nova Meta'}
          </h1>
          <div className="w-10" />
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Nome */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nome da meta</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Reserva de Emergência"
            className="w-full bg-transparent outline-none font-bold text-gray-800 dark:text-gray-200 text-lg"
          />
        </div>

        {/* Valor alvo */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Valor alvo</label>
          <div className="flex items-center gap-1 text-2xl font-bold text-teal-600">
            <span className="text-gray-400">R$</span>
            <input
              type="text"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="0,00"
              className="w-full bg-transparent outline-none font-bold text-teal-600"
            />
          </div>
        </div>

        {/* Prazo */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Prazo (opcional)</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full bg-transparent outline-none font-medium text-gray-800 dark:text-gray-200"
          />
        </div>

        {/* Fonte de progresso */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-3">Fonte do progresso</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { key: 'manual', label: 'Manual' },
              { key: 'category', label: 'Categoria' },
              { key: 'tag', label: 'Tag' },
              { key: 'account', label: 'Conta' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setSourceType(opt.key as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  sourceType === opt.key
                    ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-700 text-teal-800 dark:text-teal-300'
                    : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {sourceType === 'category' && (
            <button onClick={() => setShowCatModal(true)} className="w-full flex items-center gap-3 py-2 text-sm">
              <Tag size={16} className="text-gray-400" />
              <span className={selectedCat ? 'font-medium text-gray-800 dark:text-gray-200' : 'text-gray-400'}>
                {selectedCat?.name || 'Selecionar categoria'}
              </span>
            </button>
          )}
          {sourceType === 'tag' && (
            <button onClick={() => setShowTagModal(true)} className="w-full flex items-center gap-3 py-2 text-sm">
              <Tag size={16} className="text-gray-400" />
              <span className={selectedTag ? 'font-medium text-gray-800 dark:text-gray-200' : 'text-gray-400'}>
                {selectedTag?.name || 'Selecionar tag'}
              </span>
            </button>
          )}
          {sourceType === 'account' && (
            <button onClick={() => setShowAccModal(true)} className="w-full flex items-center gap-3 py-2 text-sm">
              <Wallet size={16} className="text-gray-400" />
              <span className={selectedAcc ? 'font-medium text-gray-800 dark:text-gray-200' : 'text-gray-400'}>
                {selectedAcc?.name || 'Selecionar conta'}
              </span>
            </button>
          )}
        </div>

        {/* Cor */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-3">Cor</label>
          <div className="flex flex-wrap gap-3">
            {GOAL_COLORS.map(c => (
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
            placeholder="Detalhes sobre a meta..."
            className="w-full bg-transparent outline-none text-sm text-gray-700 dark:text-gray-300"
          />
        </div>

        {/* Botão salvar */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-teal-700 text-white py-4 rounded-2xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
          {saving ? 'Salvando...' : isEditing ? 'Atualizar meta' : 'Criar meta'}
        </button>
      </div>

      {/* Modais de seleção */}
      {showCatModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCatModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Categorias</h3>
              <button onClick={() => setShowCatModal(false)} className="p-1"><X size={20} className="text-gray-400" /></button>
            </div>
            {categories.map(cat => {
              const IconComp = getDynamicIcon(cat.icon)
              return (
                <button
                  key={cat.id}
                  onClick={() => { setCategoryId(cat.id); setShowCatModal(false) }}
                  className={`w-full p-3 flex items-center gap-3 rounded-2xl transition-colors ${categoryId === cat.id ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                    <IconComp size={16} />
                  </div>
                  <span className="font-medium text-sm">{cat.name}</span>
                  {categoryId === cat.id && <Check size={16} className="text-teal-700 ml-auto" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {showTagModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowTagModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Tags</h3>
              <button onClick={() => setShowTagModal(false)} className="p-1"><X size={20} className="text-gray-400" /></button>
            </div>
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => { setTagId(tag.id); setShowTagModal(false) }}
                className={`w-full p-3 flex items-center gap-3 rounded-2xl transition-colors ${tagId === tag.id ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
              >
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="font-medium text-sm">{tag.name}</span>
                {tagId === tag.id && <Check size={16} className="text-teal-700 ml-auto" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {showAccModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowAccModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Contas</h3>
              <button onClick={() => setShowAccModal(false)} className="p-1"><X size={20} className="text-gray-400" /></button>
            </div>
            {accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => { setAccountId(acc.id); setShowAccModal(false) }}
                className={`w-full p-3 flex items-center gap-3 rounded-2xl transition-colors ${accountId === acc.id ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
              >
                <BankLogo color={acc.color} name={acc.name} size="sm" />
                <span className="font-medium text-sm">{acc.name}</span>
                {accountId === acc.id && <Check size={16} className="text-teal-700 ml-auto" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}