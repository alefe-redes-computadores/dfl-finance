'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Plus, X, Zap, ArrowDown, ArrowUp, Wallet, Check,
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

// Categorias pré‑definidas
const EXPENSE_CATS = [
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

const INCOME_CATS = [
  { icon: Briefcase, label: 'Salário', color: '#2E7D32' },
  { icon: TrendingUpIcon, label: 'Freelance', color: '#1565C0' },
  { icon: PiggyBankIcon, label: 'Economia', color: '#6A1B9A' },
  { icon: GiftIcon, label: 'Presente', color: '#E91E63' },
  { icon: RepeatIcon, label: 'Reembolso', color: '#00838F' },
  { icon: Home, label: 'Aluguel', color: '#4E342E' },
  { icon: Wallet, label: 'Venda', color: '#33691E' },
  { icon: CoinsIcon, label: 'Dividendos', color: '#F57F17' },
  { icon: ShieldIcon, label: 'Seguro', color: '#BF360C' },
]

/* Ícones inline */
function TrendingUpIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> }
function PiggyBankIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M19 5c-1.5 0-2.8.8-3.5 2H15c-2.2 0-4 1.8-4 4v1h-1c-.6 0-1 .4-1 1v2c0 .6.4 1 1 1h1v1c0 2.2 1.8 4 4 4h.5c.7 1.2 2 2 3.5 2 2.2 0 4-1.8 4-4s-1.8-4-4-4c-.5 0-1 .1-1.4.3-.6-.5-1.4-.8-2.3-.8H15c-.7 0-1.3-.3-1.7-.8.4-.5 1-.8 1.7-.8h2.5c.7 1.2 2 2 3.5 2 2.2 0 4-1.8 4-4s-1.8-4-4-4z"/></svg> }
function GiftIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg> }
function CoinsIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg> }
function RepeatIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> }
function ShieldIcon(p: any) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> }

export default function FAB({ onSave }: { onSave?: () => void }) {
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  const [showModal, setShowModal] = useState(false)
  const [quickType, setQuickType] = useState<'expense' | 'income'>('expense')
  const [quickContext, setQuickContext] = useState<'dfl' | 'personal'>('dfl')
  const [amount, setAmount] = useState(0)
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [accounts, setAccounts] = useState<any[]>([])
  const [showAccModal, setShowAccModal] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)

  // Arraste
  const [visible, setVisible] = useState(true)
  const [pos, setPos] = useState({ x: 16, y: 96 })
  const [dragging, setDragging] = useState(false)
  const start = useRef({ x: 0, y: 0, rx: 16, by: 96 })

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY, rx: pos.x, by: pos.y }
    setDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return
    e.preventDefault()
    const t = e.touches[0]
    const dx = t.clientX - start.current.x
    const dy = t.clientY - start.current.y
    setPos({
      x: Math.min(300, Math.max(8, start.current.rx - dx)),
      y: Math.min(500, Math.max(60, start.current.by - dy)),
    })
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    setDragging(false)
    const t = e.changedTouches[0]
    const dropArea = document.getElementById('fab-remove-zone')
    if (dropArea) {
      const r = dropArea.getBoundingClientRect()
      if (t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom) {
        setVisible(false)
        showToast('Botão oculto. Recarregue a página para vê‑lo novamente.', 'info')
        return
      }
    }
    // volta ao canto
    setPos({ x: 16, y: 96 })
  }

  useEffect(() => {
    if (showModal && user) {
      supabase.from('accounts').select('id,name,color,balance').match({ user_id: user.id, context: quickContext }).order('name').then(({ data }) => setAccounts(data || []))
    }
  }, [showModal, quickContext, user])

  const save = async () => {
    if (!user || amount <= 0) { showToast('Informe um valor', 'warning'); return }
    setSaving(true)
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id, type: quickType, amount, description: category || (quickType === 'income' ? 'Receita rápida' : 'Despesa rápida'),
      date: format(new Date(), 'yyyy-MM-dd'), status: 'done', context: quickContext, account_id: accountId || null,
    })
    if (error) showToast('Erro ao salvar', 'error')
    else {
      showToast(`${quickType === 'income' ? 'Receita' : 'Despesa'} salva!`, 'success')
      setShowModal(false); setAmount(0); setCategory(''); setAccountId('')
      onSave?.()
    }
    setSaving(false)
  }

  const cats = quickType === 'expense' ? EXPENSE_CATS : INCOME_CATS
  const selAcc = accounts.find(a => a.id === accountId)

  if (!visible) return null

  return (
    <>
      {/* botão flutuante */}
      <button
        onClick={() => { if (!dragging) setShowModal(true) }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`fixed z-[500] w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-colors ${quickType === 'expense' ? 'bg-red-500' : 'bg-emerald-500'} text-white`}
        style={{ right: `${pos.x}px`, bottom: `${pos.y}px` }}
      >
        {quickType === 'expense' ? <ArrowDown size={22} /> : <ArrowUp size={22} />}
      </button>

      {/* área de remoção */}
      {dragging && (
        <div id="fab-remove-zone" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[510] bg-red-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-sm">
          <X size={20} /> Remover
        </div>
      )}

      {/* modal de ação rápida */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-2xl animate-slide-up z-10 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100">Ação Rápida</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400"><X size={20} /></button>
            </div>

            {/* tipo */}
            <div className="flex gap-3 mb-5">
              <button onClick={() => setQuickType('expense')} className={`flex-1 py-3 rounded-xl font-bold text-sm ${quickType==='expense'?'bg-red-500 text-white':'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>Despesa</button>
              <button onClick={() => setQuickType('income')} className={`flex-1 py-3 rounded-xl font-bold text-sm ${quickType==='income'?'bg-emerald-500 text-white':'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>Receita</button>
            </div>

            {/* contexto */}
            <div className="flex gap-3 mb-5">
              {(['dfl','personal'] as const).map(c => (
                <button key={c} onClick={() => { setQuickContext(c); setAccountId('') }} className={`flex-1 py-2 rounded-full text-xs font-bold ${quickContext===c?'bg-teal-700 text-white':'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>{c==='dfl'?'DFL':'Pessoal'}</button>
              ))}
            </div>

            {/* valor */}
            <div className="mb-5">
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 rounded-2xl p-4 border border-gray-100 dark:border-slate-600">
                <span className="text-xl text-gray-400 font-light">R$</span>
                <MoneyInput value={amount} onChange={(n) => setAmount(n)} className="text-3xl font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-200" placeholder="0,00" />
              </div>
            </div>

            {/* conta */}
            <div className="mb-5">
              <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">Conta</label>
              <button onClick={() => setShowAccModal(true)} className="w-full bg-gray-50 dark:bg-slate-700 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selAcc ? <BankLogo color={selAcc.color} name={selAcc.name} size="sm" /> : <Wallet size={20} className="text-gray-400" />}
                  <span className={selAcc ? 'font-medium text-gray-800 dark:text-gray-200' : 'text-gray-400'}>{selAcc ? selAcc.name : 'Selecionar conta'}</span>
                </div>
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            </div>

            {/* categorias */}
            <div className="mb-6">
              <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">Categoria</label>
              <div className="grid grid-cols-5 gap-3">
                {cats.map(c => {
                  const Icon = c.icon
                  const sel = category === c.label
                  return (
                    <button key={c.label} onClick={() => setCategory(sel ? '' : c.label)} className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${sel ? 'bg-teal-50 dark:bg-teal-900/30 ring-2 ring-teal-500' : 'bg-gray-50 dark:bg-slate-700'}`}>
                      <Icon size={22} style={{ color: c.color }} />
                      <span className="text-[9px] text-gray-500 dark:text-gray-400">{c.label}</span>
                    </button>
                  )
                })}
                <button onClick={() => setShowIconPicker(true)} className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-gray-50 dark:bg-slate-700 hover:bg-gray-100">
                  <Plus size={22} className="text-gray-400" />
                  <span className="text-[9px] text-gray-400">Outro</span>
                </button>
              </div>
            </div>

            <button onClick={save} disabled={saving || amount <= 0} className="w-full bg-teal-600 text-white py-4 rounded-2xl font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={22} className="animate-spin" /> : <><Zap size={20} /> Salvar</>}
            </button>
          </div>
        </div>
      )}

      {/* seleção de conta */}
      {showAccModal && (
        <div className="fixed inset-0 z-[210] flex items-end justify-center" onClick={() => setShowAccModal(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-t-[32px] p-5 max-h-[60vh] overflow-y-auto z-10" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-100">Conta</h3>
            {accounts.length === 0 ? <p className="text-gray-400 text-sm text-center py-10">Nenhuma conta.</p> :
              accounts.map(acc => (
                <button key={acc.id} onClick={() => { setAccountId(acc.id); setShowAccModal(false) }} className={`w-full p-3 flex items-center gap-3 rounded-xl ${acc.id===accountId?'bg-teal-50 dark:bg-teal-900/30':''}`}>
                  <BankLogo color={acc.color} name={acc.name} size="md" />
                  <div className="text-left flex-1"><p className="font-medium">{acc.name}</p><p className="text-xs text-gray-400">R$ {Number(acc.balance||0).toFixed(2)}</p></div>
                  {acc.id===accountId && <Check size={20} className="text-teal-600" />}
                </button>
              ))
            }
          </div>
        </div>
      )}

      <IconPicker isOpen={showIconPicker} onClose={() => setShowIconPicker(false)} selectedIcon={category} onSelect={(icon) => { setCategory(icon); setShowIconPicker(false) }} />
    </>
  )
}