'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, ChevronRight, ChevronLeft, ArrowDown, ArrowUp, CreditCard, Landmark, SlidersHorizontal, Settings2 } from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'



   function BankLogo({ slug, name, emoji, color }: { slug: string, name: string, emoji: string, color: string }) {
  const logos: Record<string, string> = {
    inter: 'https://cdn.iconscout.com/icon/free/png-256/free-banco-inter-3628826-3030163.png',
    nubank: 'https://nubank.com.br/favicon.ico',
    stone: 'https://www.stone.com.br/favicon.ico',
    infinitpay: 'https://infinitpay.io/favicon.ico',
    bradesco: 'https://banco.bradesco/favicon.ico',
    itau: 'https://www.itau.com.br/favicon.ico',
    bb: 'https://www.bb.com.br/favicon.ico',
    caixa: 'https://www.caixa.gov.br/favicon.ico',
  }

  if (logos[slug]) {
    return (
      <img
        src={logos[slug]}
        alt={name}
        className="w-8 h-8 object-contain rounded-full"
        onError={e => {
          const t = e.target as HTMLImageElement
          t.style.display = 'none'
          t.nextElementSibling?.classList.remove('hidden')
        }}
      />
    )
  }

  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: `${color}20` }}>
      {emoji}
    </div>
  )
}

function HomeContent() {
  const { user } = useAuth()
  const { context } = useContext_()
  const [hideBalance, setHideBalance] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // Estados de Dados
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [pendings, setPendings] = useState({ toPay: 0, toReceive: 0 })
  const [accounts, setAccounts] = useState<any[]>([])
  const [recentExpenses, setRecentExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Controle do Modal de Cartões
  const [isCartaoModalOpen, setIsCartaoModalOpen] = useState(false)

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    // 1. Busca Transações do Mês
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('user_id', user.id)
      .eq('context', context)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })

    const txs = transactions || []

    // Calcula Totais (Somente Concluídas)
    const income = txs.filter(t => t.type === 'income' && t.status === 'done').reduce((a, t) => a + Number(t.amount), 0)
    const expense = txs.filter(t => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((a, t) => a + Number(t.amount), 0)
    
    // Calcula Pendências
    const toPay = txs.filter(t => (t.type === 'expense' || t.type === 'sangria') && t.status === 'pending').reduce((a, t) => a + Number(t.amount), 0)
    const toReceive = txs.filter(t => t.type === 'income' && t.status === 'pending').reduce((a, t) => a + Number(t.amount), 0)

    setSummary({ income, expense, balance: income - expense })
    setPendings({ toPay, toReceive })
    setRecentExpenses(txs.filter(t => t.type === 'expense').slice(0, 4))

    // 2. Busca Contas
    const { data: accs } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
      .order('name') // Ordem alfabética padrão

    setAccounts(accs ?? [])
    setLoading(false)
  }, [user, context, currentDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatCurrency = (val: number) => `R$ ${val.toFixed(2).replace('.', ',')}`
  const totalAccountsBalance = accounts.reduce((acc, curr) => acc + Number(curr.balance), 0)

  return (
    <div className="page-transition min-h-screen bg-slate-50 pb-28 font-sans">
      
      {/* HEADER E MÊS */}
      <div className="pt-6 px-4 bg-white rounded-b-[32px] pb-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] mb-6">
        
        {/* Toggle de Contexto (Opcional, mantive para funcionalidade) */}
        <div className="flex justify-between items-center mb-6">
          <ContextToggle />
        </div>

        {/* Navegador de Mês */}
        <div className="flex justify-between items-center mb-6 px-4">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 text-gray-400 hover:text-gray-600">
            <ChevronLeft size={20} />
          </button>
          <span className="text-[15px] font-semibold text-gray-800 capitalize tracking-wide">{monthLabel}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 text-gray-400 hover:text-gray-600">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Saldo Principal */}
        <div className="text-center mb-6 relative">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Saldo total</span>
            <button onClick={() => setHideBalance(!hideBalance)} className="text-gray-400 p-1">
              {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <h1 className={`text-3xl font-light text-gray-800 ${hideBalance ? 'tracking-widest mt-2' : ''}`}>
            {hideBalance ? '••••••' : formatCurrency(totalAccountsBalance)}
          </h1>
        </div>

        {/* Cards de Receitas/Despesas */}
        <div className="grid grid-cols-2 gap-3 px-2">
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col items-center justify-center">
             <div className="flex items-center gap-1.5 mb-1.5">
               <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center">
                 <ArrowUp size={12} className="text-emerald-500" />
               </div>
               <span className="text-[11px] text-gray-500 font-medium">Receitas</span>
             </div>
             <p className="text-[15px] font-bold text-emerald-600">
               {hideBalance ? '••••' : formatCurrency(summary.income)}
             </p>
          </div>
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col items-center justify-center">
             <div className="flex items-center gap-1.5 mb-1.5">
               <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center">
                 <ArrowDown size={12} className="text-red-400" />
               </div>
               <span className="text-[11px] text-gray-500 font-medium">Despesas</span>
             </div>
             <p className="text-[15px] font-bold text-red-500">
               {hideBalance ? '••••' : formatCurrency(summary.expense)}
             </p>
          </div>
        </div>
      </div>

      {/* PENDÊNCIAS */}
      <div className="px-4 mb-8">
        <h3 className="text-[15px] font-bold text-gray-800 mb-4 px-1">Pendências</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center mb-2">
               <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center">
                 <ArrowDown size={10} className="text-red-400" />
               </div>
            </div>
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Pagar</p>
            <p className="text-[13px] font-bold text-red-500">{hideBalance ? '•••' : formatCurrency(pendings.toPay)}</p>
          </div>
          
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center mb-2">
               <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center">
                 <ArrowUp size={10} className="text-emerald-500" />
               </div>
            </div>
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Receber</p>
            <p className="text-[13px] font-bold text-emerald-600">{hideBalance ? '•••' : formatCurrency(pendings.toReceive)}</p>
          </div>

          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center mb-2">
               <div className="w-5 h-5 rounded-full bg-orange-50 flex items-center justify-center">
                 <CreditCard size={10} className="text-orange-400" />
               </div>
            </div>
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Faturas</p>
            <p className="text-[13px] font-bold text-orange-400">{hideBalance ? '•••' : 'R$ 0,00'}</p>
          </div>
        </div>
      </div>

      {/* CONTAS */}
      <div className="px-4 mb-8">
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-[15px] font-bold text-gray-800">Contas</h3>
          <ChevronRight size={18} className="text-gray-400" />
        </div>
        
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          {accounts.length === 0 ? (
             <div className="p-6 text-center text-gray-400 text-sm">Nenhuma conta cadastrada.</div>
          ) : (
            accounts.map((acc, index) => {
              const bankDef = ALL_BANKS.find(b => b.slug === acc.bank_slug)
              // Layout Duplo de Saldo: O "Previsto" usará o valor atual nesta versão
              const currentBalance = Number(acc.balance)
              const forecastedBalance = currentBalance // Lógica futura de subtração aqui
              
              return (
                <div key={acc.id} className={`flex justify-between items-center p-4 ${index !== accounts.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm border border-gray-50 bg-gray-50">
                      {bankDef?.emoji || '🏛️'}
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-gray-800">{acc.name}</p>
                      <p className="text-[11px] text-gray-400">Previsto</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[14px] font-bold ${currentBalance < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                      {hideBalance ? '••••' : formatCurrency(currentBalance)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {hideBalance ? '••••' : formatCurrency(forecastedBalance)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          
          {/* Total Rodapé das Contas */}
          {accounts.length > 0 && (
            <div className="bg-[#f8f9fa] border-t border-gray-100 p-4 flex justify-between items-center rounded-b-[24px]">
               <div>
                 <p className="text-[13px] font-bold text-gray-800">Total</p>
                 <p className="text-[11px] text-gray-400 mt-0.5">Previsto</p>
               </div>
               <div className="text-right">
                 <p className="text-[13px] font-bold text-gray-900">{hideBalance ? '••••' : formatCurrency(totalAccountsBalance)}</p>
                 <p className="text-[11px] text-gray-400 mt-0.5">{hideBalance ? '••••' : formatCurrency(totalAccountsBalance)}</p>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* CARTÕES (Skeleton/Mockup) */}
      <div className="px-4 mb-8">
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-[15px] font-bold text-gray-800">Cartões</h3>
          <ChevronRight size={18} className="text-gray-400" />
        </div>
        
        <div 
          onClick={() => setIsCartaoModalOpen(true)}
          className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden cursor-pointer"
        >
           <div className="flex justify-between items-center p-4 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-900 flex items-center justify-center shadow-sm">
                   <span className="text-white text-[10px] font-bold italic">Visa</span>
                </div>
                <div>
                  <p className="text-[14px] font-medium text-gray-800">Cartão Principal</p>
                  <p className="text-[11px] text-gray-400">Sem fatura aberta</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[14px] font-bold text-gray-400">R$ 0,00</p>
              </div>
            </div>
            <div className="bg-[#f8f9fa] border-t border-gray-100 p-4 flex justify-between items-center rounded-b-[24px]">
               <div>
                 <p className="text-[13px] font-bold text-gray-800">Total</p>
                 <p className="text-[11px] text-gray-400 mt-0.5">Próxima</p>
               </div>
               <div className="text-right">
                 <p className="text-[13px] font-bold text-gray-400">R$ 0,00</p>
                 <p className="text-[11px] text-gray-400 mt-0.5">R$ 0,00</p>
               </div>
            </div>
        </div>
      </div>

      {/* DESPESAS RECENTES */}
      <div className="px-4 mb-8">
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-[15px] font-bold text-gray-800">Despesas recentes</h3>
          <ChevronRight size={18} className="text-gray-400" />
        </div>
        
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-2">
          {recentExpenses.length === 0 ? (
             <div className="p-6 text-center text-gray-400 text-sm">Nenhuma despesa recente.</div>
          ) : (
            recentExpenses.map((t, index) => (
              <div key={t.id} className={`flex items-center gap-3 p-3 ${index !== recentExpenses.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                  style={{ backgroundColor: t.categories?.color ? `${t.categories.color}15` : '#f3f4f6' }}
                >
                  {t.categories?.icon ?? '💸'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-gray-800 uppercase tracking-wide truncate">{t.description || t.categories?.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{format(new Date(t.date + 'T12:00:00'), "d 'de' MMM", { locale: ptBR })}</p>
                </div>
                <p className="text-[14px] font-bold text-red-500">
                   {formatCurrency(Number(t.amount))}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* BOTÃO GERENCIAR TELA INICIAL */}
      <div className="flex justify-center mb-8">
         <button className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Settings2 size={16} />
            <span className="text-[12px] font-medium">Gerenciar tela inicial</span>
         </button>
      </div>

      {/* Modal Em Desenvolvimento (Cartões) */}
      {isCartaoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => setIsCartaoModalOpen(false)}>
          <div className="bg-white p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard size={32} className="text-teal-700" />
            </div>
            <h3 className="font-bold text-lg mb-2">Saindo do forno!</h3>
            <p className="text-gray-500 mb-6 text-sm">O controle de Cartões está sendo desenvolvido. Em breve você poderá gerenciar suas faturas aqui.</p>
            <button onClick={() => setIsCartaoModalOpen(false)} className="w-full bg-teal-800 text-white py-3 rounded-xl font-bold">Entendido</button>
          </div>
        </div>
      )}

    </div>
  )
}

export default function HomePage() {
  return (
    <ContextProvider>
      <HomeContent />
    </ContextProvider>
  )
}
