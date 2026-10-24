// V169 — Central de Revisao Financeira, leitura local, sem RPCs ou mutacoes.
'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, CheckCheck, CircleHelp, ClipboardCheck, EyeOff, RefreshCw, Repeat2, Search, ShieldCheck, TrendingUp } from 'lucide-react'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useAuth } from '@/lib/hooks/useAuth'
import { useLocalData } from '@/hooks/useLocalData'
import { buildFinancialReview, type ReviewItem, type ReviewKind } from '@/lib/financeReview'
const brl=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
type Tab='all' | ReviewKind
const filters:{id:Tab;label:string}[]=[
  {id:'all',label:'Todas'}, {id:'duplicate',label:'Repetidos'}, {id:'inbox',label:'Importações'},
  {id:'metadata',label:'Dados'}, {id:'unusual',label:'Fora do padrão'}, {id:'recurring',label:'Recorrências'},
]
const labels:Record<ReviewKind,string>={duplicate:'Possível duplicação',inbox:'Conciliação',metadata:'Cadastro',unusual:'Desvio',recurring:'Recorrência'}
const tones:Record<ReviewKind,string>={
  duplicate:'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10',
  inbox:'text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-500/10',
  metadata:'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/10',
  unusual:'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10',
  recurring:'text-teal-700 bg-teal-50 dark:text-teal-300 dark:bg-teal-500/10',
}
const icons:Record<ReviewKind,typeof AlertCircle>={duplicate:AlertCircle,inbox:ClipboardCheck,metadata:CircleHelp,unusual:TrendingUp,recurring:Repeat2}
export default function ReviewPage(){
  const router=useRouter()
  const {user}=useAuth()
  const {effectiveContext}=useContext_()
  const tx=useLocalData({table:'transactions',filters:{context:effectiveContext}})
  const accounts=useLocalData({table:'accounts',filters:{context:effectiveContext}})
  const categories=useLocalData({table:'categories',filters:{context:effectiveContext}})
  const subscriptions=useLocalData({table:'subscriptions',filters:{context:effectiveContext}})
  const [tab,setTab]=useState<Tab>('all')
  const [hiddenIds,setHiddenIds]=useState<string[]>([])
  const storageKey=`dfl:review:v169:${user?.id||'guest'}:${effectiveContext}`
  useEffect(()=>{
    try{const raw=JSON.parse(localStorage.getItem(storageKey)||'[]');setHiddenIds(Array.isArray(raw)?raw.filter((x:unknown)=>typeof x==='string').slice(-300):[])}
    catch{setHiddenIds([])}
  },[storageKey])
  const report=useMemo(()=>buildFinancialReview(tx.data||[],accounts.data||[],categories.data||[],subscriptions.data||[],effectiveContext,new Date()),[tx.data,accounts.data,categories.data,subscriptions.data,effectiveContext])
  const visible=useMemo(()=>report.items.filter(item=>!hiddenIds.includes(item.id)&&(tab==='all'||item.kind===tab)),[report.items,hiddenIds,tab])
  const pending=tx.loading||accounts.loading||categories.loading||subscriptions.loading
  const ignore=(id:string)=>{
    const next=Array.from(new Set([...hiddenIds,id])).slice(-300)
    setHiddenIds(next)
    try{localStorage.setItem(storageKey,JSON.stringify(next))}catch{}
  }
  const restore=()=>{setHiddenIds([]);try{localStorage.removeItem(storageKey)}catch{}}
  const open=(item:ReviewItem)=>router.push(item.href)
  return <main className="mx-auto min-h-[100dvh] max-w-2xl space-y-4 bg-gray-50 px-4 pb-32 pt-4 dark:bg-slate-950">
    <header className="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-black/5 bg-gray-50/95 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95">
      <button type="button" onClick={()=>router.push('/more')} aria-label="Voltar para Mais" className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white text-gray-600 dark:bg-slate-800 dark:text-gray-200"><ArrowLeft size={19}/></button>
      <div className="min-w-0 flex-1"><p className="text-[11px] font-medium text-gray-400">Inteligência sem mexer no dinheiro</p><h1 className="text-[18px] font-bold text-gray-950 dark:text-white">Central de Revisão</h1></div>
      <ShieldCheck size={19} className="text-teal-600" />
    </header>
    <ContextToggle />
    <section className="rounded-[24px] border border-teal-100 bg-white p-4 shadow-sm dark:border-teal-900/40 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2"><CalendarDays size={16} className="text-teal-600"/><p className="text-[12px] font-semibold text-gray-600 dark:text-gray-300">Realizado neste mês · até {report.end.split('-').reverse().join('/')}</p></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[16px] bg-emerald-50 p-3 dark:bg-emerald-500/10"><p className="text-[11px] text-gray-500">Entradas de caixa</p><p className="text-[16px] font-bold text-emerald-700 dark:text-emerald-400">{brl(report.income)}</p></div>
        <div className="rounded-[16px] bg-rose-50 p-3 dark:bg-rose-500/10"><p className="text-[11px] text-gray-500">Saídas de caixa</p><p className="text-[16px] font-bold text-rose-700 dark:text-rose-400">{brl(report.expense)}</p></div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-[14px] bg-gray-50 px-3 py-3 dark:bg-slate-800"><span className="text-[12px] font-medium text-gray-600 dark:text-gray-300">Resultado simples</span><span className={`text-[15px] font-bold ${report.net<0?'text-rose-600':'text-teal-700 dark:text-teal-400'}`}>{brl(report.net)}</span></div>
      <p className="mt-2 text-[10px] leading-4 text-gray-400">Apenas caixa realizado; exclui transferências, faturas, compras no cartão e compromissos futuros. Não é o saldo das contas. São {report.records} movimentações consideradas.</p>
    </section>
    <section className="rounded-[22px] border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-[15px] font-bold text-gray-900 dark:text-white">Sua fila de conferência</h2><p className="mt-1 text-[11px] text-gray-400">Sugestões baseadas em indícios, nunca alterações automáticas.</p></div><span className="rounded-full bg-teal-50 px-2.5 py-1 text-[12px] font-bold text-teal-700 dark:bg-teal-500/10 dark:text-teal-400">{report.items.length-hiddenIds.filter(id=>report.items.some(item=>item.id===id)).length}</span></div>
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2">{filters.map(f=><button key={f.id} type="button" onClick={()=>setTab(f.id)} aria-pressed={tab===f.id} className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-semibold ${tab===f.id?'bg-teal-700 text-white':'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-300'}`}>{f.label}</button>)}</div>
      {pending?<p role="status" className="py-8 text-center text-[13px] text-gray-500">Lendo movimentações locais…</p>:visible.length===0?<div className="py-8 text-center"><CheckCheck size={30} className="mx-auto text-teal-600"/><p className="mt-2 text-[14px] font-semibold text-gray-800 dark:text-gray-100">Nenhuma sugestão neste filtro</p><p className="mt-1 text-[11px] text-gray-400">Isso não substitui a conciliação do extrato bancário.</p></div>:<div className="mt-2 space-y-2">{visible.slice(0,70).map(item=>{const Icon=icons[item.kind];return <article key={item.id} className="rounded-[17px] border border-gray-100 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex items-start gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[item.kind]}`}><Icon size={18}/></div><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{labels[item.kind]}</p><p className="mt-0.5 text-[13px] font-semibold text-gray-900 dark:text-white">{item.title}</p><p className="mt-1 break-words text-[12px] text-gray-600 dark:text-gray-300">{item.detail}</p><p className="mt-1 text-[11px] leading-4 text-gray-500">{item.evidence}</p></div></div>
        <div className="mt-3 flex gap-2 pl-12"><button type="button" onClick={()=>open(item)} className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-teal-700 px-3 text-[11px] font-semibold text-white">Conferir <ArrowRight size={14}/></button><button type="button" onClick={()=>ignore(item.id)} className="flex min-h-9 items-center gap-1.5 rounded-[12px] border border-gray-200 px-3 text-[11px] font-semibold text-gray-500 dark:border-slate-600 dark:text-gray-300"><EyeOff size={13}/> Ignorar</button></div>
      </article>})}</div>}
      {hiddenIds.length>0&&<button type="button" onClick={restore} className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-teal-600"><RefreshCw size={14}/> Restaurar sugestões ignoradas neste aparelho</button>}
    </section>
    <button type="button" onClick={()=>router.push('/agenda')} className="flex w-full items-center justify-between rounded-[17px] border border-teal-200 bg-teal-50 px-4 py-3 text-left text-[12px] font-semibold text-teal-800 active:scale-[0.99] dark:border-teal-900 dark:bg-teal-900/20 dark:text-teal-200">Ver Agenda Financeira 360 <CalendarDays size={17}/></button>
    <section className="rounded-[20px] border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-slate-900"><p className="text-[12px] font-bold text-gray-900 dark:text-white">Atalhos para regularizar</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={()=>router.push('/conciliation')} className="flex items-center justify-center gap-2 rounded-[14px] border border-gray-200 px-3 py-3 text-[12px] font-semibold text-gray-600 dark:border-slate-700 dark:text-gray-200"><ClipboardCheck size={16}/> Inbox</button><button type="button" onClick={()=>router.push('/reports')} className="flex items-center justify-center gap-2 rounded-[14px] border border-gray-200 px-3 py-3 text-[12px] font-semibold text-gray-600 dark:border-slate-700 dark:text-gray-200"><Search size={16}/> Relatórios</button></div>
      <p className="mt-3 text-[11px] leading-4 text-gray-400">As sugestões de duplicidade ou recorrência podem ter falsos positivos. Ignorar é local e não exclui a transação. O aplicativo nunca concilia, cria assinatura, edita ou paga a partir desta tela.</p>
    </section>
  </main>
}
