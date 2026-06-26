'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Plus, X, Zap, ArrowDown, ArrowUp, Wallet, Check, Search,
  Coffee, ShoppingCart, Car, Home, Smartphone, Utensils, Heart,
  Briefcase, Gamepad2, BookOpen, Loader2, ChevronRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { format } from 'date-fns'
import BankLogo from '@/components/BankLogo'
import MoneyInput from '@/components/MoneyInput'
import IconPicker from '@/components/IconPicker'
import { useToast } from '@/contexts/ToastContext'
import { useContext_ } from '@/components/ContextToggle'

// Categorias para despesas (ícones padrão)
const EXPENSE_CATEGORIES = [
  { icon: Coffee, label: 'Café', color: '#8B4513' },
  { icon: ShoppingCart, label: 'Compras', color: '#FF6B6B' },
  { icon: Car, label: 'Transporte', color: '#4ECDC4' },
  { icon: Utensils, label: 'Alimentação', color: '#FF8C00' },
  { icon: Smartphone, label: 'Celular', color: '#6C5CE7' },
  { icon: Heart, label: 'Saúde', color: '#E74C3C' },
  { icon: Briefcase, label: 'Trabalho', color: '#2C3E50' },
  { icon: Gamepad2, label: 'Lazer', color: '#9B59B6' },
  { icon: BookOpen, label: 'Estudos', color: '#3498DB' },
]

// Categorias para receitas (ícones padrão)
const INCOME_CATEGORIES = [
  { icon: Briefcase, label: 'Salário', color: '#2E7D32' },
  { icon: TrendingUpIcon, label: 'Freelance', color: '#1565C0' },
  { icon: PiggyBankIcon, label: 'Economia', color: '#6A1B9A' },
  { icon: GiftIcon, label: 'Presente', color: '#E91E63' },
  { icon: Repeat, label: 'Reembolso', color: '#00838F' },
  { icon: Home, label: 'Aluguel', color: '#4E342E' },
  { icon: Wallet, label: 'Venda', color: '#33691E' },
  { icon: CoinsIcon, label: 'Dividendos', color: '#F57F17' },
  { icon: Shield, label: 'Seguro', color: '#BF360C' },
]

// Ícones customizados inline (evitando imports desnecessários)
function TrendingUpIcon(props: any) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
}
function PiggyBankIcon(props: any) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 5c-1.5 0-2.8.8-3.5 2H15c-2.2 0-4 1.8-4 4v1h-1c-.6 0-1 .4-1 1v2c0 .6.4 1 1 1h1v1c0 2.2 1.8 4 4 4h.5c.7 1.2 2 2 3.5 2 2.2 0 4-1.8 4-4s-1.8-4-4-4c-.5 0-1 .1-1.4.3-.6-.5-1.4-.8-2.3-.8H15c-.7 0-1.3-.3-1.7-.8.4-.5 1-.8 1.7-.8h2.5c.7 1.2 2 2 3.5 2 2.2 0 4-1.8 4-4s-1.8-4-4-4z"/></svg>
}
function GiftIcon(props: any) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
}
function CoinsIcon(props: any) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
}
function Shield(props: any) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
}

export default function FAB({ onSave }: { onSave?: () => void }) {
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  // Estados do modal
  const [showModal, setShowModal] = useState(false)
  const [quickType, setQuickType] = useState<'expense' | 'income'>('expense')
  const [quickContext, setQuickContext] = useState<'dfl' | 'personal'>(context || 'dfl')
  const [quickAmount, setQuickAmount] = useState(0)
  const [quickAmountFormatted, setQuickAmountFormatted] = useState('0,00')
  const [quickCategory, setQuickCategory] = useState('')
  const [quickSaving, setQuickSaving] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [accounts, setAccounts] = useState<any[]>([])
  const [showAccModal, setShowAccModal] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)

  // FAB arrastável
  const [fabVisible, setFabVisible] = useState(true)
  const [isDraggingFab, setIsDraggingFab] = useState(false)
  const [fabPos, setFabPos] = useState({ x: 0, y: 0 })
  const fabRef = useRef<HTMLButtonElement>(null)
  const touchStart = useRef({ x: 0, y: 0, fabX: 0, fabY: 0 })

  // Carregar contas ao abrir modal
  useEffect(() => {
    if (showModal && user) {
      supabase
        .from('accounts')
        .select('id, name, color, balance')
        .match({ user_id: user.id, context: quickContext })
        .order('name')
        .then(({ data }) => setAccounts(data || []))
    }
  }, [showModal, quickContext, user])

  // Handlers de arraste
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      fabX: fabPos.x || (window.innerWidth - 64),
      fabY: fabPos.y || (window.innerHeight - 160)
    }
    setIsDraggingFab(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingFab) return
    e.preventDefault()
    const touch = e.touches[0]
    const deltaX = touch.clientX - touchStart.current.x
    const deltaY = touch.clientY - touchStart.current.y
    let newX = touchStart.current.fabX + deltaX
    let newY = touchStart.current.fabY + deltaY

    const fabSize = 48
    const maxX = window.innerWidth - fabSize - 8
    const maxY = window.innerHeight - fabSize - 100
    newX = Math.max(8, Math.min(newX, maxX))
    newY = Math.max(60, Math.min(newY, maxY))

    setFabPos({ x: newX, y: newY })
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDraggingFab(false)
    const touch = e.changedTouches[0]
    const removeArea = document.getElementById('fab-remove-area')
    if (removeArea) {
      const rect = removeArea.getBoundingClientRect()
      if (
        touch.clientX >= rect.left &&
        touch.clientX <= rect.right &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom
      ) {
        setFabVisible(false)
        showToast('Botão oculto. Recarregue para vê-lo novamente.', 'info')
        setFabPos({ x: 0, y: 0 })
        return
      }
    }
    setFabPos({ x: 0, y: 0 })
  }

  const handleSave = async () => {
    if (!user || quickAmount <= 0) {
      showToast('Informe um valor válido', 'warning')
      return
    }
    setQuickSaving(true)

    try {
      const payload = {
        user_id: user.id,
        type: quickType,
        amount: quickAmount,
        description: quickCategory || (quickType === 'income' ? 'Receita rápida' : 'Despesa rápida'),
        date: format(new Date(), 'yyyy-MM-dd'),
        status: 'done',
        context: quickContext,
        account_id: accountId || null,
      }
      const { error } = await supabase.from('transactions').insert(payload)
      if (error) throw error

      showToast(`${quickType === 'income' ? 'Receita' : 'Despesa'} salva!`, 'success')
      setShowModal(false)
      setQuickAmount(0)
      setQuickAmountFormatted('0,00')
      setQuickCategory('')
      setAccountId('')
      onSave?.()
    } catch (e) {
      showToast('Erro ao salvar', 'error')
    } finally {
      setQuickSaving(false)
    }
  }

  const categories = quickType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
  const selectedAcc = accounts.find(a => a.id === accountId)

  if (!fabVisible) return null

  return (
    <>
      {/* Botão FAB */}
      <button
        onClick={() => { if (!isDraggingFab) setShowModal(true) }}
        ref={fabRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`fixed z-[45] w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 ${
          quickType === 'expense' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'
        }`}
        style={fabPos.x > 0 ? { left: `${fabPos.x}px`, top: `${fabPos.y}px` } : { bottom: '6rem', right: '1.5rem' }}
      >
        {quickType === 'expense' ? <ArrowDown size={24} className="text-white" /> : <ArrowUp size={24} className="text-white" />}
      </button>

      {/* Área de remoção */}
      {isDraggingFab && (
        <div id="fab-remove-area" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 font-bold text-sm">
          <X size={20} /> Remover
        </div>
      )}

      {/* Modal de Ação Rápida */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-2xl animate-slide-up z-10 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100">Ação Rápida</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 dark:text-gray-500"><X size={20} /></button>
            </div>

            {/* Tipo: Despesa / Receita */}
            <div className="flex gap-3 mb-5">
              <button onClick={() => setQuickType('expense')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${quickType === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>Despesa</button>
              <button onClick={() => setQuickType('income')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${quickType === 'income' ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>Receita</button>
            </div>

            {/* Contexto */}
            <div className="flex gap-3 mb-5">
              {(['dfl', 'personal'] as const).map(c => (
                <button key={c} onClick={() => { setQuickContext(c); setAccountId('') }} className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${quickContext === c ? 'bg-teal-700 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>{c === 'dfl' ? 'DFL' : 'Pessoal'}</button>
              ))}
            </div>

            {/* Valor */}
            <div className="mb-5">
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 rounded-2xl p-4 border border-gray-100 dark:border-slate-600">
                <span className="text-xl text-gray-400 font-light">R$</span>
                <MoneyInput value={quickAmount} onChange={(num, formatted) => { setQuickAmount(num); setQuickAmountFormatted(formatted) }} className="text-3xl font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200" placeholder="0,00" />
              </div>
            </div>

            {/* Conta */}
            <div className="mb-5">
              <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 block">Conta</label>
              <button onClick={() => setShowAccModal(true)} className="w-full bg-gray-50 dark:bg-slate-700 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedAcc ? <BankLogo color={selectedAcc.color} name={selectedAcc.name} size="sm" /> : <Wallet size={20} className="text-gray-400" />}
                  <span className={selectedAcc ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-400'}>
                    {selectedAcc ? selectedAcc.name : 'Selecionar conta'}
                  </span>
                </div>
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Categorias + Botão Outro */}
            <div className="mb-6">
              <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 block">Categoria</label>
              <div className="grid grid-cols-5 gap-3">
                {categories.map(cat => {
                  const IconComp = cat.icon
                  const isSelected = quickCategory === cat.label
                  return (
                    <button key={cat.label} onClick={() => setQuickCategory(isSelected ? '' : cat.label)} className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${isSelected ? 'bg-teal-50 dark:bg-teal-900/30 ring-2 ring-teal-500' : 'bg-gray-50 dark:bg-slate-700'}`}>
                      <IconComp size={22} style={{ color: cat.color }} />
                      <span className="text-[9px] text-gray-500 dark:text-gray-400">{cat.label}</span>
                    </button>
                  )
                })}
                {/* Botão Outro */}
                <button
                  onClick={() => setShowIconPicker(true)}
                  className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 transition-all"
                >
                  <Plus size={22} className="text-gray-400" />
                  <span className="text-[9px] text-gray-400">Outro</span>
                </button>
              </div>
            </div>

            <button onClick={handleSave} disabled={quickSaving || quickAmount <= 0} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-2xl font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {quickSaving ? <Loader2 size={22} className="animate-spin" /> : <><Zap size={20} /> Salvar</>}
            </button>
          </div>
        </div>
      )}

      {/* Modal de seleção de conta */}
      {showAccModal && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center" onClick={() => setShowAccModal(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-t-[32px] p-5 max-h-[60vh] overflow-y-auto z-10" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-100">Selecionar Conta</h3>
            {accounts.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-10">Nenhuma conta encontrada.</p>
            ) : (
              accounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => { setAccountId(acc.id); setShowAccModal(false) }}
                  className={`w-full p-3 flex items-center gap-3 rounded-xl ${acc.id === accountId ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                >
                  <BankLogo color={acc.color} name={acc.name} size="md" />
                  <div className="text-left flex-1">
                    <p className="font-medium text-gray-800 dark:text-gray-200">{acc.name}</p>
                    <p className="text-xs text-gray-400">R$ {Number(acc.balance || 0).toFixed(2)}</p>
                  </div>
                  {acc.id === accountId && <Check size={20} className="text-teal-600" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* IconPicker */}
      <IconPicker
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        selectedIcon={quickCategory}
        onSelect={(icon) => { setQuickCategory(icon); setShowIconPicker(false) }}
      />
    </>
  )
}