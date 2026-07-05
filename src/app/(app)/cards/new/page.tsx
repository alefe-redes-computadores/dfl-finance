'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { 
  ChevronLeft, ChevronRight, Tag, Landmark, 
  CreditCard, Calendar, PiggyBank, Palette, DollarSign, 
  Check, Loader2, X, Plus, Wallet
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'

const PREDEFINED_COLORS = ['#2a9d8f', '#e76f51', '#264653', '#e9c46a', '#1d3557', '#e63946', '#8338ec', '#ffb703', '#3a0ca3', '#000000', '#ffffff', '#636e72']
const FLAGS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard']

export default function NewCardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()

  const [accounts, setAccounts] = useState<any[]>([])

  const [showColorPicker, setShowColorPicker] = useState(false)
  const [tempColor, setTempColor] = useState('')

  const [name, setName] = useState('')
  const [flag, setFlag] = useState('')
  const [institution, setInstitution] = useState('')
  const [lastFour, setLastFour] = useState('')
  const [closingDay, setClosingDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [color, setColor] = useState(PREDEFINED_COLORS[0])
  const [limitAmount, setLimitAmount] = useState('0,00')
  const [saving, setSaving] = useState(false)

  const [showAccountModal, setShowAccountModal] = useState(false)

 

 // ============================================================
  // 🔥 BUSCA LOCAL DE CONTAS
  // ============================================================
  const { data: localAccounts, loading: accLoading } = useLocalData({
    table: 'accounts',
    filters: { context: 'dfl' },
    realtime: false,
  })

  useEffect(() => {
    if (localAccounts) {
      setAccounts(localAccounts)
    }
  }, [localAccounts])

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value === '') value = '0'
    const formatted = (Number(value) / 100).toFixed(2).replace('.', ',')
    setLimitAmount(formatted)
  }

  const handleDayChange = (val: string, setter: (v: string) => void) => {
    const numeric = val.replace(/\D/g, '')
    if (numeric === '' || (Number(numeric) >= 1 && Number(numeric) <= 31)) {
      setter(numeric)
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      showToast('Por favor, informe o nome do cartão.', 'warning')
      return
    }
    setSaving(true)

    const payload = {
      user_id: user!.id,
      context: 'dfl',
      name,
      flag: flag || null,
      institution: institution || null,
      last_four: lastFour || null,
      closing_day: closingDay ? parseInt(closingDay) : 1,
      due_day: dueDay ? parseInt(dueDay) : 10,
      payment_account_id: paymentAccountId || null,
      color,
      limit_amount: parseFloat(limitAmount.replace(/\./g, '').replace(',', '.')) || 0
    }

    try {
      const { create } = useLocalData({ table: 'credit_cards' })
      await create(payload)
      showToast('Cartão criado com sucesso!', 'success')
      router.push('/cards')
    } catch (error: any) {
      showToast(`Erro ao salvar: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const renderFlagIcon = (cardFlag: string) => {
    switch (cardFlag) {
      case 'Visa': return <span className="text-[10px] font-bold italic text-blue-800">VISA</span>
      case 'Mastercard': return (
        <div className="flex items-center gap-0.5">
          <div className="w-3 h-3 bg-red-500 rounded-full" />
          <div className="w-3 h-3 bg-yellow-500 rounded-full -ml-1.5" />
        </div>
      )
      case 'Elo': return <span className="text-[10px] font-bold text-blue-600">elo</span>
      case 'Amex': return <span className="text-[9px] font-bold text-blue-500">AMEX</span>
      case 'Hipercard': return <span className="text-[9px] font-bold text-red-400">HIPER</span>
      default: return <CreditCard size={14} />
    }
  }

  const renderCardLogo = (cardFlag: string) => {
    switch (cardFlag) {
      case 'Visa': return <span className="text-xl font-bold italic tracking-tighter text-white">VISA</span>
      case 'Mastercard': return (
        <div className="flex">
          <div className="w-5 h-5 bg-red-500 rounded-full mix-blend-multiply opacity-90" />
          <div className="w-5 h-5 bg-yellow-500 rounded-full mix-blend-multiply -ml-2 opacity-90" />
        </div>
      )
      case 'Elo': return <span className="text-sm font-bold tracking-tight text-white">elo</span>
      case 'Amex': return <span className="text-[10px] font-bold text-white bg-blue-500 px-1 py-0.5 rounded">AMEX</span>
      case 'Hipercard': return <span className="text-xs font-bold text-red-100 italic">HIPER</span>
      default: return <CreditCard size={20} className="text-white" />
    }
  }

  const selectedAccount = accounts.find(a => a.id === paymentAccountId)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white dark:bg-slate-900 flex flex-col font-sans pb-24 relative transition-colors duration-300">

      <div className="pt-6 pb-8 px-4 shadow-sm relative transition-colors duration-300" style={{ backgroundColor: color }}>
        <div className="flex items-center justify-between mb-6 text-white">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ChevronLeft size={24} />
          </button>
        </div>
        <div>
          <p className="text-white/80 text-[11px] font-medium uppercase tracking-wider mb-2">Nome do cartão</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-8 rounded-md flex items-center justify-center border border-white/20 bg-black/10 shadow-sm">
               {renderCardLogo(flag)}
            </div>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Nubank, Inter"
              className="bg-transparent text-white text-2xl font-light outline-none w-full placeholder:text-white/50"
              autoFocus
            />
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-800 transition-colors duration-300">

        <div className="p-4 border-b border-gray-50 dark:border-slate-700 flex flex-col gap-3">
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <Tag size={18} /> <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Bandeira</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide ml-8">
            {FLAGS.map(f => (
              <button 
                key={f} 
                onClick={() => setFlag(f)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium whitespace-nowrap transition-all border ${
                  flag === f ? 'border-gray-800 dark:border-gray-200 text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-slate-700' : 'border-gray-100 dark:border-slate-600 text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-800'
                }`}
              >
                {renderFlagIcon(f)}
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-gray-50 dark:border-slate-700 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 flex-1">
            <Landmark size={18} /> 
            <div className="flex-1">
              <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200 block mb-1">Instituição</span>
              <input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="Nome (opcional)" className="text-[12px] w-full outline-none text-gray-500 dark:text-gray-400 font-medium bg-transparent" />
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-gray-50 dark:border-slate-700 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 flex-1">
            <CreditCard size={18} /> 
            <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200 flex-1">Últimos 4 dígitos</span>
          </div>
          <input value={lastFour} onChange={e => setLastFour(e.target.value.replace(/\D/g, '').slice(0,4))} placeholder="0000" className="text-[13px] w-16 text-right outline-none text-gray-800 dark:text-gray-200 font-bold bg-transparent" />
        </div>

        <div className="flex border-b border-gray-50 dark:border-slate-700">
          <div className="p-4 flex-1 border-r border-gray-50 dark:border-slate-700">
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 mb-2">
              <Calendar size={18} /> <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Fechamento</span>
            </div>
            <input type="text" value={closingDay} onChange={e => handleDayChange(e.target.value, setClosingDay)} placeholder="Dia" className="text-[13px] ml-8 outline-none text-gray-800 dark:text-gray-200 font-bold w-full bg-transparent" />
          </div>
          <div className="p-4 flex-1">
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 mb-2">
              <Calendar size={18} /> <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Vencimento</span>
            </div>
            <input type="text" value={dueDay} onChange={e => handleDayChange(e.target.value, setDueDay)} placeholder="Dia" className="text-[13px] ml-8 outline-none text-gray-800 dark:text-gray-200 font-bold w-full bg-transparent" />
          </div>
        </div>

        <div className="p-4 border-b border-gray-50 dark:border-slate-700">
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <PiggyBank size={18} /> 
            <button onClick={() => setShowAccountModal(true)} className="flex-1 flex items-center justify-between">
              <div className="text-left">
                <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200 block mb-1">Conta para pagamento</span>
                <span className={`text-[12px] font-medium ${selectedAccount ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
                  {selectedAccount ? selectedAccount.name : 'Selecionar conta (opcional)'}
                </span>
              </div>
              <ChevronRight size={18} className="text-gray-300 dark:text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-gray-50 dark:border-slate-700 flex flex-col gap-3">
           <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <Palette size={18} /> <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Cor do Cartão</span>
          </div>
          <div className="flex gap-2 flex-wrap ml-8 mt-1 items-center">
            {PREDEFINED_COLORS.slice(0, 8).map(c => (
              <button 
                key={c} onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-gray-800 dark:border-gray-200' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}

            <button 
              onClick={() => {
                setTempColor(color)
                setShowColorPicker(true)
              }}
              className="w-8 h-8 rounded-full overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-500 flex items-center justify-center hover:border-gray-800 dark:hover:border-gray-300 transition-colors"
            >
              <div className="w-full h-full" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-gray-50 dark:border-slate-700">
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 mb-3">
            <DollarSign size={18} /> <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Limite de crédito</span>
          </div>
          <div className="ml-8 bg-gray-50 dark:bg-slate-700 rounded-2xl p-4 flex items-center gap-2">
            <span className="text-gray-400 dark:text-gray-500 font-bold text-lg">R$</span>
            <input 
              type="text" 
              value={limitAmount} 
              onChange={handleLimitChange} 
              className="bg-transparent w-full outline-none font-black text-gray-800 dark:text-gray-200 text-2xl tracking-tight" 
            />
          </div>
        </div>

      </div>

      <button 
        onClick={handleSave} 
        disabled={saving}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 w-14 h-14 bg-emerald-800 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-emerald-900 transition-colors disabled:opacity-50 z-50"
      >
        {saving ? <Loader2 className="animate-spin" size={28} /> : <Check size={28} />}
      </button>

      {showAccountModal && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50" onClick={() => setShowAccountModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Conta para pagamento</h3>
              <button onClick={() => setShowAccountModal(false)} className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { setPaymentAccountId(''); setShowAccountModal(false) }}
                className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${!paymentAccountId ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-gray-500">
                  <Wallet size={20} />
                </div>
                <span className={`flex-1 text-left font-medium ${!paymentAccountId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>Nenhuma conta</span>
                {!paymentAccountId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
              </button>
              {accounts.map(acc => {
                const isActive = acc.id === paymentAccountId
                return (
                  <button
                    key={acc.id}
                    onClick={() => { setPaymentAccountId(acc.id); setShowAccountModal(false) }}
                    className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: acc.color || '#14b8a6' }}>{acc.name.substring(0, 2).toUpperCase()}</div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{acc.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
              {accounts.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 mt-10">Nenhuma conta encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      {showColorPicker && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowColorPicker(false)}>
          <div className="bg-[#303030] dark:bg-slate-800 rounded-3xl p-6 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-4">Selecionar cor</h3>

            <div className="grid grid-cols-4 gap-4 mb-6">
               {PREDEFINED_COLORS.map(c => (
                  <button 
                    key={c} onClick={() => setTempColor(c)}
                    className={`w-12 h-12 rounded-xl mx-auto border-2 ${tempColor === c ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
               ))}
            </div>

            <div className="flex items-center justify-between mb-8 bg-[#222] dark:bg-slate-700 p-3 rounded-xl">
               <span className="text-blue-400 text-sm font-medium">Hexadecimal</span>
               <div className="flex items-center gap-2">
                 <div className="w-4 h-4 rounded-full" style={{backgroundColor: tempColor}} />
                 <input 
                   type="text" 
                   value={tempColor} 
                   onChange={e => setTempColor(e.target.value)} 
                   className="w-20 bg-transparent text-white text-sm outline-none font-mono uppercase"
                   maxLength={7}
                 />
               </div>
            </div>

            <div className="flex justify-end gap-6 text-sm font-bold">
               <button onClick={() => setShowColorPicker(false)} className="text-gray-400">Cancelar</button>
               <button 
                 onClick={() => {
                   setColor(tempColor)
                   setShowColorPicker(false)
                 }} 
                 className="text-blue-400"
               >
                 Definir
               </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}