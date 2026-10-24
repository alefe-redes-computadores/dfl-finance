'use client'
// V170: agenda 360 em leitura. Fonte: mesmo motor de compromissos das projeções.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight,
  CalendarDays, CheckCircle2, ChevronRight, CreditCard,
  Filter, Landmark, Search, ShieldCheck, Wallet, X,
} from 'lucide-react'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { buildFinanceAgenda, type AgendaEntry, type AgendaKind } from '@/lib/financeAgenda'

const money=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const dateTitle=(date:string)=>{
  const [y,m,d]=date.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d,12)))
}
const kinds:Record<AgendaKind,string>={transaction:'Lançamento',invoice:'Fatura',debt:'Quem me deve',loan:'Empréstimo',financing:'Financiamento',subscription:'Assinatura'}
const card='rounded-[22px] border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900'
type FilterKind='all'|'expense'|'income'|'planning'|'overdue'
export default function AgendaPage(){
  const router=useRouter()
  const {effectiveContext}=useContext_()
  const [days,setDays]=useState<7|30|90>(30)
  const [filter,setFilter]=useState<FilterKind>('all')
  const [term,setTerm]=useState('')
  const [selectedDate,setSelectedDate]=useState<string|null>(null)
  const [showNotes,setShowNotes]=useState(false)
  const tx=useLocalData({table:'transactions',filters:{context:effectiveContext}})
  const debts=useLocalData({table:'debts',filters:{context:effectiveContext}})
  const loans=useLocalData({table:'loans',filters:{context:effectiveContext}})
  const financing=useLocalData({table:'financings',filters:{context:effectiveContext}})
  const subscriptions=useLocalData({table:'subscriptions',filters:{context:effectiveContext}})
  const cards=useLocalData({table:'credit_cards',filters:{context:effectiveContext}})
  const invoices=useLocalData({table:'credit_invoices',filters:{context:effectiveContext}})
  const pending=tx.loading||debts.loading||loans.loading||financing.loading||subscriptions.loading||cards.loading||invoices.loading
  const agenda=useMemo(()=>buildFinanceAgenda({context:effectiveContext,
    transactions:tx.data||[],sources:{debts:debts.data||[],loans:loans.data||[],financings:financing.data||[],subscriptions:subscriptions.data||[],creditCards:cards.data||[],creditInvoices:invoices.data||[]},horizonDays:days,
  }),[effectiveContext,tx.data,debts.data,loans.data,financing.data,subscriptions.data,cards.data,invoices.data,days])
  const normalized=term.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
  const filtered=useMemo(()=>agenda.items.filter(item=>{
    if(selectedDate&&item.date!==selectedDate)return false
    if(filter==='planning'&&item.scope!=='planning')return false
    if(filter==='overdue'&&(!item.overdue||item.scope!=='known'))return false
    if(filter==='expense'&&(item.scope!=='known'||item.direction!=='expense'))return false
    if(filter==='income'&&(item.scope!=='known'||item.direction!=='income'))return false
    if(normalized){const corpus=[item.label,item.detail,kinds[item.kind],item.date].join(' ').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');if(!corpus.includes(normalized))return false}
    return true
  }),[agenda.items,filter,selectedDate,normalized])
  const visibleGroups=useMemo(()=>{
    const map=new Map<string,AgendaEntry[]>()
    for(const item of filtered){const arr=map.get(item.date)||[];arr.push(item);map.set(item.date,arr)}
    return Array.from(map.entries())
  },[filtered])
  const daysStrip=useMemo(()=>Array.from({length:7},(_,i)=>{
    const [y,m,d]=agenda.today.split('-').map(Number)
    const date=new Date(Date.UTC(y,m-1,d+i,12))
    return date.toISOString().slice(0,10)
  }),[agenda.today])
  const filters:{id:FilterKind;label:string}[]=[{id:'all',label:'Tudo'},{id:'expense',label:'A pagar'},{id:'income',label:'A receber'},{id:'overdue',label:'Vencidos'},{id:'planning',label:'Planejado'}]
  return <main className="mx-auto min-h-[100dvh] max-w-2xl space-y-4 bg-gray-50 px-4 pb-32 pt-3 dark:bg-slate-950">
    <header className="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-gray-200/70 bg-gray-50/95 px-4 py-3 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/95">
      <button type="button" onClick={()=>router.push('/more')} aria-label="Voltar" className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white text-gray-600 dark:bg-slate-800 dark:text-gray-200"><ArrowLeft size={18}/></button>
      <div className="min-w-0 flex-1"><p className="text-[11px] text-gray-400">Compromissos em um só lugar</p><h1 className="text-[18px] font-bold text-gray-900 dark:text-white">Agenda Financeira</h1></div>
      <CalendarDays size={20} className="text-teal-600"/>
    </header>
    <button type="button" onClick={()=>router.push('/planning')} className="flex min-h-12 w-full items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-4 text-left text-[12px] font-bold text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300"><span>Planejar despesas não mensais e reservas</span><span>→</span></button>
    <ContextToggle />
    <section className={card}>
      <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-[14px] font-bold text-gray-900 dark:text-white">Janela de compromissos</h2><p className="mt-1 text-[11px] text-gray-500">Valores previstos, separados do saldo das contas</p></div><ShieldCheck size={19} className="text-teal-600"/></div>
      <div className="mb-3 grid grid-cols-3 gap-2">{([7,30,90] as const).map(n=><button type="button" key={n} onClick={()=>{setDays(n);setSelectedDate(null)}} aria-pressed={days===n} className={`rounded-[13px] px-3 py-2.5 text-[12px] font-semibold ${days===n?'bg-teal-700 text-white':'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300'}`}>{n} dias</button>)}</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[17px] bg-rose-50 p-3 dark:bg-rose-900/15"><div className="flex items-center gap-1.5 text-[11px] text-rose-600"><ArrowUpRight size={14}/> A pagar / vencido</div><p className="mt-2 break-words text-[18px] font-bold text-rose-700 dark:text-rose-300">{money(agenda.horizonExpense)}</p></div>
        <div className="rounded-[17px] bg-emerald-50 p-3 dark:bg-emerald-900/15"><div className="flex items-center gap-1.5 text-[11px] text-emerald-600"><ArrowDownRight size={14}/> A receber futuro</div><p className="mt-2 break-words text-[18px] font-bold text-emerald-700 dark:text-emerald-300">{money(agenda.horizonIncome)}</p></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-[14px] border border-amber-200 bg-amber-50/60 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/10"><p className="text-[11px] text-gray-600 dark:text-gray-300">Em atraso ou hoje</p><p className="mt-1 text-[14px] font-bold text-amber-700 dark:text-amber-400">{money(agenda.dueNowExpense)}</p></div>
        <div className="rounded-[14px] border border-gray-200 px-3 py-2.5 dark:border-slate-700"><p className="text-[11px] text-gray-600 dark:text-gray-300">Assinaturas previstas</p><p className="mt-1 text-[14px] font-bold text-gray-900 dark:text-white">{money(agenda.planningExpense)}</p></div>
      </div>
      <p className="mt-3 text-[10px] leading-4 text-gray-500">Faturas, contratos e lançamentos com vínculos explícitos são reconciliados pelo mesmo motor das projeções. Assinaturas são apenas planejamento e <strong>não entram na soma a pagar</strong>. Recebimentos vencidos também não entram no total futuro.</p>
      <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-gray-300">{agenda.knownCount} compromissos</span><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{agenda.overdueCount} vencidos</span><span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">{agenda.planningCount} previsões</span></div>
    </section>
    <section className={card}>
      <div className="mb-3 flex items-center justify-between"><div><h2 className="text-[14px] font-bold text-gray-900 dark:text-white">Próximos sete dias</h2><p className="mt-1 text-[11px] text-gray-400">Toque para filtrar por dia</p></div>{selectedDate&&<button type="button" className="text-[11px] font-bold text-teal-700 dark:text-teal-400" onClick={()=>setSelectedDate(null)}>Limpar data</button>}</div>
      <div className="grid grid-cols-7 gap-1.5">{daysStrip.map(date=>{const count=agenda.items.filter(it=>it.date===date).length;const active=selectedDate===date;return <button type="button" key={date} aria-label={`${date} · ${count} compromissos`} aria-pressed={active} onClick={()=>setSelectedDate(active?null:date)} className={`flex min-w-0 flex-col items-center rounded-[12px] px-1 py-2.5 text-center ${active?'bg-teal-700 text-white':'bg-gray-50 text-gray-700 dark:bg-slate-800 dark:text-gray-300'}`}><span className="text-[9px] font-medium">{dateTitle(date).split(',')[0]}</span><span className="mt-1 text-[15px] font-bold">{Number(date.slice(8,10))}</span><span className={`mt-1 h-1.5 w-1.5 rounded-full ${count?active?'bg-white':'bg-teal-500':'bg-transparent'}`} /></button>})}</div>
    </section>
    <section className={card}>
      <div className="mb-3 flex items-center gap-2"><Filter size={16} className="text-teal-600"/><h2 className="text-[14px] font-bold text-gray-900 dark:text-white">Vencimentos e prioridades</h2></div>
      <div className="relative mb-3"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={term} onChange={e=>setTerm(e.target.value)} placeholder="Buscar conta, pessoa, assinatura..." aria-label="Buscar compromissos" className="w-full rounded-[14px] border border-gray-200 bg-gray-50 py-3 pl-10 pr-10 text-[12px] text-gray-900 outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/>{term&&<button type="button" aria-label="Limpar busca" onClick={()=>setTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={16}/></button>}</div>
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-2">{filters.map(f=><button type="button" key={f.id} aria-pressed={filter===f.id} onClick={()=>setFilter(f.id)} className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-semibold ${filter===f.id?'bg-teal-700 text-white':'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-300'}`}>{f.label}</button>)}</div>
      {pending?<p role="status" className="py-6 text-center text-[12px] text-gray-500">Carregando compromissos locais…</p>:!visibleGroups.length?<div className="py-8 text-center"><CheckCircle2 size={26} className="mx-auto text-teal-600"/><p className="mt-2 text-[13px] font-semibold text-gray-800 dark:text-white">Nenhum compromisso neste filtro</p><p className="mt-1 text-[11px] text-gray-500">Confira outros períodos ou filtros.</p></div>:<div className="space-y-5">{visibleGroups.map(([date,items])=><div key={date}>
        <div className="mb-2 flex items-center gap-2"><span className="text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400">{dateTitle(date)}</span>{date<agenda.today&&<span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-900/20">Vencido</span>}{date===agenda.today&&<span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-900/20">Hoje</span>}<span className="ml-auto text-[10px] text-gray-400">{items.length} item(ns)</span></div>
        <div className="space-y-2">{items.map(it=><button type="button" key={it.id} onClick={()=>router.push(it.href)} className="flex w-full items-center gap-3 rounded-[17px] border border-gray-100 bg-gray-50 p-3 text-left transition active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800/60">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${it.scope==='planning'?'bg-violet-50 text-violet-600 dark:bg-violet-900/20':it.direction==='income'?'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20':'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>{it.kind==='invoice'?<CreditCard size={19}/>:it.kind==='loan'||it.kind==='financing'?<Landmark size={19}/>:it.scope==='planning'?<CalendarDays size={19}/>:it.direction==='income'?<ArrowDownRight size={19}/>:<Wallet size={19}/>}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-bold text-gray-900 dark:text-white">{it.label}</span><span className="mt-0.5 block text-[10px] text-gray-500 dark:text-gray-400">{kinds[it.kind]} · {it.scope==='planning'?'Planejamento':it.direction==='income'?'A receber':'A pagar'}</span><span className="mt-0.5 block text-[10px] leading-4 text-gray-400">{it.detail}</span></span>
          <span className="shrink-0 text-right"><span className={`block text-[13px] font-bold ${it.scope==='planning'?'text-violet-700 dark:text-violet-300':it.direction==='income'?'text-emerald-600':'text-rose-600'}`}>{money(it.amount)}</span><ChevronRight size={14} className="ml-auto mt-1 text-gray-400"/></span>
        </button>)}</div>
      </div>)}</div>}
    </section>
    <section className={card}>
      <button type="button" aria-expanded={showNotes} onClick={()=>setShowNotes(v=>!v)} className="flex w-full items-center justify-between gap-2 text-left"><span className="flex items-center gap-2 text-[12px] font-bold text-gray-800 dark:text-white"><AlertCircle size={16} className="text-amber-600"/> Cobertura e cuidados</span><ChevronRight size={15} className={`text-gray-400 transition-transform ${showNotes?'rotate-90':''}`}/></button>
      {showNotes&&<div className="mt-3 space-y-2 text-[11px] leading-5 text-gray-500 dark:text-gray-400"><p>Agenda baseada em compromissos identificáveis. Não é extrato bancário, garantia de recebimento nem previsão de saldo. Pagamentos não são executados por esta tela.</p>{agenda.warnings.map((s,i)=><p key={`${i}-${s}`} className="rounded-[12px] bg-amber-50/70 p-2 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">{s}</p>)}<p>Assinaturas sem associação explícita com pagamentos permanecem apenas no planejamento e não são somadas ao total a pagar.</p></div>}
      <button type="button" onClick={()=>router.push('/review')} className="mt-4 flex w-full items-center justify-between rounded-[14px] border border-teal-200 bg-teal-50 px-3 py-3 text-[12px] font-bold text-teal-800 active:scale-[0.99] dark:border-teal-800 dark:bg-teal-900/20 dark:text-teal-200"><span>Revisar lançamentos suspeitos</span><ArrowRight size={16}/></button>
      <button type="button" onClick={()=>router.push('/conciliation')} className="mt-2 flex w-full items-center justify-between rounded-[14px] bg-gray-50 px-3 py-3 text-[12px] font-semibold text-gray-700 dark:bg-slate-800 dark:text-gray-200"><span>Ir para Inbox financeira</span><ArrowRight size={16}/></button>
    </section>
  </main>
}
