'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, AlertCircle, ArrowLeft, ArrowRight, CalendarDays, ChevronRight, CircleDollarSign, Info, Landmark, PiggyBank, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { useUserSettings } from '@/hooks/useUserSettings'
import { buildFinanceAgenda } from '@/lib/financeAgenda'
import { buildFinancePlanning } from '@/lib/financePlanning'
import { buildFinancePressure, type PressureContext } from '@/lib/financePressure'

const cash = (value: number | null) => value === null ? 'Não calculável' : value.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})
const card = 'rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900'
const civilToday = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const displayDate = (s:string) => s.split('-').reverse().join('/')
const readCurrency = (s:string) => {
  const cleaned=s.replace(/\s|R\$/gi,'').trim()
  const value=Number(cleaned.includes(',') ? cleaned.replace(/\./g,'').replace(',','.') : cleaned)
  return Number.isFinite(value) && value >= 0 && value <= 100000000 ? Math.round(value*100)/100 : 0
}
const metric = (label:string,value:string,caption:string) => (
  <div className="min-w-0 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
    <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-2 break-words text-[19px] font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
    <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{caption}</p>
  </div>
)
export default function CashPressurePage() {
  const router=useRouter()
  const {effectiveContext}=useContext_()
  const context:PressureContext=effectiveContext==='dfl'?'dfl':'personal'
  const {settings,loading:settingsLoading}=useUserSettings()
  const [today,setToday]=useState(civilToday)
  const [days,setDays]=useState<7|30|90>(30)
  const [cushion,setCushion]=useState('')
  const [extra,setExtra]=useState('')
  const [showAll,setShowAll]=useState(false)
  const [view,setView]=useState<'conservative'|'withReceipts'>('conservative')
  const accounts=useLocalData({table:'accounts',filters:{context}})
  const tx=useLocalData({table:'transactions',filters:{context}})
  const categories=useLocalData({table:'categories',filters:{context}})
  const debts=useLocalData({table:'debts',filters:{context}})
  const loans=useLocalData({table:'loans',filters:{context}})
  const financings=useLocalData({table:'financings',filters:{context}})
  const subscriptions=useLocalData({table:'subscriptions',filters:{context}})
  const cards=useLocalData({table:'credit_cards',filters:{context}})
  const invoices=useLocalData({table:'credit_invoices',filters:{context}})
  const loading=[accounts,tx,categories,debts,loans,financings,subscriptions,cards,invoices].some(x=>x.loading)||settingsLoading
  useEffect(()=>{const sync=()=>setToday(civilToday());window.addEventListener('focus',sync);return()=>window.removeEventListener('focus',sync)},[])
  const agenda=useMemo(()=>buildFinanceAgenda({
    context,transactions:tx.data||[],sources:{
      debts:debts.data||[],loans:loans.data||[],financings:financings.data||[],
      subscriptions:subscriptions.data||[],creditCards:cards.data||[],creditInvoices:invoices.data||[]
    },horizonDays:days,now:new Date(Number(today.slice(0,4)),Number(today.slice(5,7))-1,Number(today.slice(8,10)),12)
  }),[context,tx.data,debts.data,loans.data,financings.data,subscriptions.data,cards.data,invoices.data,days,today])
  const plan=useMemo(()=>buildFinancePlanning(
    tx.data||[],categories.data||[],context,today,
    settings?.preferences.planning_groups,settings?.preferences.planning_reserves,settings?.preferences.planning_flex_limits
  ),[tx.data,categories.data,context,today,settings?.preferences.planning_groups,settings?.preferences.planning_reserves,settings?.preferences.planning_flex_limits])
  const pressure=useMemo(()=>buildFinancePressure({
    context,today,days,accounts:accounts.data||[],agenda:agenda.items,
    reserves:plan.reserves,reserveMonthly:plan.reserveMonthlySuggested,
    flexibleRemaining:plan.flexibleRemaining,cushion:readCurrency(cushion),extraExpense:readCurrency(extra)
  }),[context,today,days,accounts.data,agenda.items,plan.reserves,plan.reserveMonthlySuggested,plan.flexibleRemaining,cushion,extra])
  const selected=pressure.timeline.filter(d=>showAll || d.eventCount>0 || d.subscriptionPlanning>0 || d.date===pressure.firstNegativeDate || d.date===pressure.firstBelowCushionDate || d.date===today)
  return <main className="mx-auto min-h-[100dvh] max-w-2xl space-y-4 bg-[#f7f8fa] px-4 pb-32 pt-3 dark:bg-slate-950">
    <header className="flex items-center gap-3">
      <button type="button" onClick={()=>router.push('/planning')} aria-label="Voltar" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-600 dark:bg-slate-900 dark:text-white"><ArrowLeft size={19}/></button>
      <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">V174 · Inteligência explicável</p><h1 className="text-[20px] font-black text-slate-900 dark:text-white">Radar de Fôlego</h1></div>
      <Activity size={22} className="text-teal-600"/>
    </header>
    <ContextToggle />
    {loading&&<div role="status" className="rounded-xl bg-amber-50 p-3 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-200">Sincronizando dados locais. Os cenários podem mudar até o carregamento terminar.</div>}
    <section className={card}>
      <div className="flex items-start gap-2"><Landmark size={20} className="mt-0.5 shrink-0 text-teal-600"/><div><h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Caixa observado × compromissos</h2><p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">Base nos saldos registrados das contas ativas. Não representa dinheiro realmente disponível se houver lançamentos sem conciliação ou saldos desatualizados.</p></div></div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {metric('Saldo das contas',cash(pressure.openingBalance),`${pressure.accountCount} contas com saldo válido · fotografia local`)}
        {metric('Obrigações reconhecidas',cash(pressure.knownExpense),`Até ${displayDate(pressure.end)} · sem duplicar cartão/fatura`)}
        {metric('Sem contar recebíveis',cash(pressure.endConservative),'Cenário conservador sem receitas futuras')}
        {metric('Com receitas previstas',cash(pressure.endWithReceipts),'Cenário ilustrativo; recebimentos não garantidos')}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">{([7,30,90] as const).map(n=><button key={n} type="button" aria-pressed={days===n} onClick={()=>setDays(n)} className={`min-h-11 rounded-xl px-2 text-[12px] font-bold ${n===days?'bg-teal-700 text-white':'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}>{n} dias</button>)}</div>
    </section>
    <section className={card}>
      <div className="flex gap-2"><SlidersHorizontal size={19} className="mt-0.5 shrink-0 text-violet-600"/><div><h2 className="text-[15px] font-bold text-slate-900 dark:text-white">E se...? Simule sem mexer no dinheiro</h2><p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">O gasto extra hipotético é lançado apenas no primeiro dia desta simulação. A proteção mínima é um alerta, não uma reserva real.</p></div></div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div><label htmlFor="stress-extra" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Gasto extra (R$)</label><input id="stress-extra" type="text" inputMode="decimal" placeholder="Ex.: 350,00" value={extra} onChange={e=>setExtra(e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></div>
        <div><label htmlFor="stress-buffer" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Proteção mínima (R$)</label><input id="stress-buffer" type="text" inputMode="decimal" placeholder="Ex.: 500,00" value={cushion} onChange={e=>setCushion(e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {metric('Final com gasto simulado',cash(pressure.endSimulated),'Sem receitas previstas e sem reservas debitadas')}
        {metric('Menor valor no período',cash(pressure.worstConservative),'Compromissos conhecidos, antes do gasto hipotético')}
      </div>
      {(pressure.firstNegativeDate||pressure.firstBelowCushionDate)?<div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-[11px] leading-5 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200"><AlertCircle size={16} className="mr-2 inline"/>{pressure.firstNegativeDate?`Atenção: o cenário simulado fica negativo a partir de ${displayDate(pressure.firstNegativeDate)}.`:`Sua proteção mínima escolhida é ultrapassada em ${displayDate(pressure.firstBelowCushionDate||'')}.`}</div>:<div className="mt-3 rounded-2xl bg-teal-50 p-3 text-[11px] leading-5 text-teal-700 dark:bg-teal-900/20 dark:text-teal-200"><ShieldCheck size={16} className="mr-2 inline"/>{pressure.openingBalance===null?'Cadastre ou revise o saldo das contas para calcular risco.':'Os compromissos identificados não causaram aperto nesse cenário. Gastos e obrigações ausentes ainda podem mudar o resultado.'}</div>}
    </section>
    <section className={card}>
      <div className="mb-3 flex gap-2"><PiggyBank size={20} className="shrink-0 text-amber-600"/><div><h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Camada de planejamento — fora do caixa</h2><p className="mt-1 text-[11px] leading-5 text-slate-500">Valores informativos, sem dedução do saldo ou de obrigações confirmadas.</p></div></div>
      <div className="grid grid-cols-2 gap-2">
        {metric('Assinaturas previstas',cash(pressure.plannedSubscriptions),'Não somadas às obrigações reais')}
        {metric('Reservar por mês',cash(pressure.reserveMonthly),'Meta sugerida para reservas futuras')}
        {metric('Ainda a separar',cash(pressure.reserveOutstanding),'Declarações manuais, não saldo')}
        {metric('Limite flexível restante',cash(pressure.flexibleRemaining),'Orçamento, não dinheiro em conta')}
      </div>
      <button type="button" onClick={()=>router.push('/planning')} className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-[12px] font-semibold text-violet-700 dark:border-slate-700 dark:text-violet-300">Editar meu planejamento <ChevronRight size={16}/></button>
    </section>
    <section className={card}>
      <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><CalendarDays size={19} className="text-indigo-500"/><h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Linha do tempo financeira</h2></div><button type="button" onClick={()=>setShowAll(v=>!v)} className="text-[11px] font-bold text-teal-700 dark:text-teal-400">{showAll?'Só eventos':'Todos os dias'}</button></div>
      <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" aria-pressed={view==='conservative'} onClick={()=>setView('conservative')} className={`rounded-xl px-3 py-2.5 text-[11px] font-semibold ${view==='conservative'?'bg-teal-700 text-white':'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>Sem receitas futuras</button><button type="button" aria-pressed={view==='withReceipts'} onClick={()=>setView('withReceipts')} className={`rounded-xl px-3 py-2.5 text-[11px] font-semibold ${view==='withReceipts'?'bg-teal-700 text-white':'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>Com recebíveis</button></div>
      <div className="mt-3 max-h-[440px] space-y-2 overflow-y-auto">{selected.map(d=><div key={d.date} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70"><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{displayDate(d.date)}</p><p className={`text-[13px] font-bold tabular-nums ${((view==='conservative'?d.conservative:d.withReceipts) ?? 0)<0?'text-rose-600':'text-slate-900 dark:text-white'}`}>{cash(view==='conservative'?d.conservative:d.withReceipts)}</p></div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500"><span>A pagar: {cash(d.dueExpense)}</span><span>A receber: {cash(d.potentialIncome)}</span>{d.subscriptionPlanning>0&&<span>Assinaturas à parte: {cash(d.subscriptionPlanning)}</span>}</div></div>)}</div>
      <button type="button" onClick={()=>router.push('/agenda')} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-[12px] font-bold text-indigo-700 dark:border-slate-700 dark:text-indigo-300">Abrir compromissos na Agenda <ArrowRight size={16}/></button>
    </section>
    <section className={card}>
      <div className="flex items-center gap-2"><CircleDollarSign size={19} className="text-amber-600"/><h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Prioridades do cérebro</h2></div>
      <div className="mt-3 space-y-2">{pressure.priorities.map(note=><button key={note.key} type="button" onClick={()=>router.push(note.href)} className="flex w-full items-start gap-2 rounded-2xl bg-slate-50 p-3 text-left dark:bg-slate-800/80"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${note.severity==='critical'?'bg-rose-500':note.severity==='warning'?'bg-amber-500':'bg-teal-500'}`} /><span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-slate-800 dark:text-white">{note.title}</span><span className="mt-1 block text-[11px] leading-5 text-slate-500 dark:text-slate-300">{note.detail}</span></span><ChevronRight size={16} className="shrink-0 text-slate-400"/></button>)}</div>
      {[...agenda.warnings,...pressure.warnings].length>0&&<div className="mt-3 space-y-1">{Array.from(new Set([...agenda.warnings,...pressure.warnings])).map((w,i)=><p key={i} className="flex gap-2 text-[10px] leading-4 text-slate-500 dark:text-slate-400"><Info size={13} className="mt-0.5 shrink-0"/>{w}</p>)}</div>}
    </section>
    <p className="flex gap-2 px-2 text-[10px] leading-4 text-slate-500"><ShieldCheck size={16} className="shrink-0"/>O Radar é uma simulação sem garantias. Não efetiva pagamentos, não cobra ninguém, não antecipa receitas e não escreve em contas, cartões, lançamentos ou metas. Confira saldos e vencimentos na origem.</p>
  </main>
}
