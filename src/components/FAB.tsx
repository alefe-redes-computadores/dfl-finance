'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Plus, X, Zap, ArrowDown, ArrowUp, Wallet, Check,
  Coffee, ShoppingCart, Car, Home, Smartphone, Utensils, Heart,
  Briefcase, Gamepad2, BookOpen, Loader2, ChevronRight,
  TrendingUp, PiggyBank, Gift, Repeat, Coins, Shield
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { format } from 'date-fns'
import BankLogo from '@/components/BankLogo'
import MoneyInput from '@/components/MoneyInput'
import IconPicker from '@/components/IconPicker'
import { useToast } from '@/contexts/ToastContext'
import { useContext_ } from '@/components/ContextToggle'

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
  { icon: TrendingUp, label: 'Freelance', color: '#1565C0' },
  { icon: PiggyBank, label: 'Economia', color: '#6A1B9A' },
  { icon: Gift, label: 'Presente', color: '#E91E63' },
  { icon: Repeat, label: 'Reembolso', color: '#00838F' },
  { icon: Home, label: 'Aluguel', color: '#4E342E' },
  { icon: Wallet, label: 'Venda', color: '#33691E' },
  { icon: Coins, label: 'Dividendos', color: '#F57F17' },
  { icon: Shield, label: 'Seguro', color: '#BF360C' },
]

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

  // Estados de Arraste Fluido
  const [visible, setVisible] = useState(true)
  const [position, setPosition] = useState({ x: 20, y: 80 }) // Baseado em bottom/right
  const [isDragging, setIsDragging] = useState(false)
  const [showDeleteZone, setShowDeleteZone] = useState(false)
  const isTouchMove = useRef(false)
  const fabRef = useRef<HTMLButtonElement>(null)

  const handleTouchStart = () => {
    isTouchMove.current = false
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    // Se moveu, ativamos o modo arraste livre
    isTouchMove.current = true
    setShowDeleteZone(true)
    
    const touch = e.touches[0]
    
    // Calcula a posição do dedo invertida para aplicar no right/bottom (respeitando limites)
    const newX = window.innerWidth - touch.clientX - 28 // 28 é metade da largura do botão
    const newY = window.innerHeight - touch.clientY - 28

    // Limites da tela (não deixa sumir nem ficar em cima do menu)
    const clampedX = Math.max(10, Math.min(window.innerWidth - 60, newX))
    const clampedY = Math.max(80, Math.min(window.innerHeight - 100, newY))

    setPosition({ x: clampedX, y: clampedY })
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false)
    setShowDeleteZone(false)

    if (!isTouchMove.current) {
      // Se não moveu, foi apenas um clique. Abre o Modal.
      setShowModal(true)
      return
    }

    // Se moveu, verifica se soltou na zona de exclusão (inferior central)
    const touch = e.changedTouches[0]
    if (touch.clientY > window.innerHeight * 0.8) {
      setVisible(false) // Oculta da sessão (não vai pro banco)
      showToast('Botão oculto até à próxima sessão.', 'info')
    }
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
      {/* Zona Vermelha de Exclusão Temporária */}
      {showDeleteZone && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center z-[499] pointer-events-none animate-in fade-in slide-in-from-bottom-5">
          <div className="bg-red-500 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-2 font-bold text-sm shadow-red-500/30">
            <X size={20} /> Solte aqui para ocultar
          </div>
        </div>
      )}

      {/* O Botão FAB */}
      <button
        ref={fabRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`fixed z-[500] w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-transform active:scale-90 touch-none ${
          isDragging ? 'scale-110 shadow-2xl opacity-90' : ''
        } ${quickType === 'expense' ? 'bg-red-500 shadow-red-500/30' : 'bg-emerald-500 shadow-emerald-500/30'} text-white`}
        style={{ right: `${position.x}px`, bottom: `${position.y}px` }}
      >
        {quickType === 'expense' ? <ArrowDown size={28} /> : <ArrowUp size={28} />}
      </button>

      {/* Modal de Ação Rápida */}
      {showModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-bold text-xl text-gray-800 dark:text-gray-100 tracking-tight">Ação Rápida</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={20} /></button>
            </div>

            {/* Alternância de Tipo e Contexto */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="flex bg-gray-100 dark:bg-slate-700 p-1 rounded-[16px]">
                <button onClick={() => setQuickType('expense')} className={`flex-1 py-2.5 rounded-[12px] font-bold text-[13px] transition-all ${quickType==='expense'?'bg-white dark:bg-slate-800 text-red-500 shadow-sm':'text-gray-500'}`}>Despesa</button>
                <button onClick={() => setQuickType('income')} className={`flex-1 py-2.5 rounded-[12px] font-bold text-[13px] transition-all ${quickType==='income'?'bg-white dark:bg-slate-800 text-emerald-500 shadow-sm':'text-gray-500'}`}>Receita</button>
              </div>
              <div className="flex bg-gray-100 dark:bg-slate-700 p-1 rounded-[16px]">
                {(['dfl','personal'] as const).map(c => (
                  <button key={c} onClick={() => { setQuickContext(c); setAccountId('') }} className={`flex-1 py-2.5 rounded-[12px] font-bold text-[13px] transition-all ${quickContext===c?'bg-teal-700 text-white shadow-sm':'text-gray-500'}`}>{c==='dfl'?'DFL':'Pessoal'}</button>
                ))}
              </div>
            </div>

            {/* Valor */}
            <div className="mb-6">
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700/50 rounded-[20px] p-5 border border-gray-100 dark:border-slate-700">
                <span className="text-2xl text-gray-400 font-medium">R$</span>
                <MoneyInput value={amount} onChange={(n) => setAmount(n)} className="text-4xl font-bold bg-transparent outline-none w-full text-gray-800 dark:text-gray-100 placeholder:text-gray-300" placeholder="0,00" />
              </div>
            </div>

            {/* Conta */}
            <div className="mb-6">
              <label className="text-[12px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 block ml-2">Conta Destino</label>
              <button onClick={() => setShowAccModal(true)} className="w-full bg-gray-50 dark:bg-slate-700/50 p-4 rounded-[20px] border border-gray-100 dark:border-slate-700 flex items-center justify-between hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  {selAcc ? <BankLogo color={selAcc.color} name={selAcc.name} size="md" /> : <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-slate-600 flex items-center justify-center"><Wallet size={20} className="text-gray-400" /></div>}
                  <span className={`font-bold text-[15px] ${selAcc ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>{selAcc ? selAcc.name : 'Selecionar conta'}</span>
                </div>
                <ChevronRight size={20} className="text-gray-300 dark:text-gray-600" />
              </button>
            </div>

            {/* Categorias (Grid Premium) */}
            <div className="mb-8">
              <label className="text-[12px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 block ml-2">Categoria</label>
              <div className="grid grid-cols-4 gap-3">
                {cats.map(c => {
                  const Icon = c.icon
                  const sel = category === c.label
                  return (
                    <button key={c.label} onClick={() => setCategory(sel ? '' : c.label)} className={`flex flex-col items-center gap-2 p-3 rounded-[16px] transition-all ${sel ? 'bg-teal-50 dark:bg-teal-900/30 ring-2 ring-teal-500 shadow-sm' : 'bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 border border-gray-100 dark:border-slate-700'}`}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${c.color}15`, color: c.color }}>
                        <Icon size={20} />
                      </div>
                      <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate w-full text-center">{c.label}</span>
                    </button>
                  )
                })}
                <button onClick={() => setShowIconPicker(true)} className="flex flex-col items-center gap-2 p-3 rounded-[16px] bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 border border-gray-100 dark:border-slate-700 border-dashed">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-200 dark:bg-slate-600 text-gray-500">
                    <Plus size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate w-full text-center">Outro</span>
                </button>
              </div>
            </div>

            {/* Salvar */}
            <button onClick={save} disabled={saving || amount <= 0} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[20px] font-bold text-[16px] disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-teal-600/30">
              {saving ? <Loader2 size={24} className="animate-spin" /> : <><Zap size={22} /> Salvar Lançamento</>}
            </button>
          </div>
        </div>
      )}

      {/* Modal Seleção de Conta */}
      {showAccModal && (
        <div className="fixed inset-0 z-[610] flex items-end justify-center" onClick={() => setShowAccModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-t-[32px] p-6 max-h-[70vh] overflow-y-auto animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Escolha a Conta</h3>
                <button onClick={() => setShowAccModal(false)} className="p-2 bg-gray-100 dark:bg-slate-700 rounded-full"><X size={18}/></button>
            </div>
            <div className="space-y-2">
                {accounts.length === 0 ? <p className="text-gray-400 text-sm text-center py-10">Nenhuma conta encontrada neste contexto.</p> :
                accounts.map(acc => (
                    <button key={acc.id} onClick={() => { setAccountId(acc.id); setShowAccModal(false) }} className={`w-full p-4 flex items-center gap-4 rounded-[20px] transition-colors border ${acc.id===accountId?'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800':'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:bg-gray-50'}`}>
                    <BankLogo color={acc.color} name={acc.name} size="md" />
                    <div className="text-left flex-1"><p className="font-bold text-[15px] text-gray-800 dark:text-gray-200">{acc.name}</p><p className="text-xs text-gray-400 mt-0.5">R$ {Number(acc.balance||0).toFixed(2)}</p></div>
                    {acc.id===accountId && <Check size={20} className="text-teal-600" />}
                    </button>
                ))
                }
            </div>
          </div>
        </div>
      )}

      <IconPicker isOpen={showIconPicker} onClose={() => setShowIconPicker(false)} selectedIcon={category} onSelect={(icon) => { setCategory(icon); setShowIconPicker(false) }} />
    </>
  )
}
