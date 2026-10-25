'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, CreditCard, Info, Layers3, PiggyBank, Plus, Save, ShieldCheck, Trash2, Wallet } from 'lucide-react'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useToast } from '@/contexts/ToastContext'
import { buildFinancePlanning, normalizePlanningGroups, normalizePlanningReserves, normalizePlanningFlexLimits, type PlanningBucket, type PlanningReserve } from '@/lib/financePlanning'
import { planningDecision } from '@/lib/planningDecisionPolicy'
import { planningReservePriorities } from '@/lib/planningReservePriority'
import { filterPlanningReserves, reserveVisibleSummary, type ReserveView } from '@/lib/planningReserveSearch'

const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const panel = 'rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900'
const names: Record<PlanningBucket, string> = { fixed: 'Fixos', flex: 'Flexíveis', irregular: 'Não mensais' }
const descriptions: Record<PlanningBucket, string> = {
  fixed: 'Despesas frequentes ou difíceis de reduzir',
  flex: 'Compras e gastos que variam ao longo do mês',
  irregular: 'Despesas pontuais, anuais e sazonais',
}
const blank = () => ({name:'',value:'',date:'',saved:''})
const localISO = () => {const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`}
const parseCurrency = (s: string) => { const v=s.trim().replace(/\s|R\$/gi,'');return Number(v.includes(',')?v.replace(/\./g,'').replace(',','.'):v) }
const fmtDate=(s:string)=>s.split('-').reverse().join('/')

export default function FinancialPlanningPage() {
  const router=useRouter()
  const { effectiveContext }=useContext_()
  const context=effectiveContext==='dfl'?'dfl':'personal'
  const { settings, loading: settingsLoading, updateSettings }=useUserSettings()
  const { showToast }=useToast()
  const tx=useLocalData({table:'transactions',filters:{context}})
  const categories=useLocalData({table:'categories',filters:{context}})
  const [now,setNow]=useState(localISO)
  const [working,setWorking]=useState(false)
  const [cap,setCap]=useState('')
  const [editingCap,setEditingCap]=useState(false)
  const [draft,setDraft]=useState(blank)
  const [editingId,setEditingId]=useState<string|null>(null)
  const [showAll,setShowAll]=useState(false)
  const [categorySearch,setCategorySearch]=useState('')
  const [categoryGroup,setCategoryGroup]=useState<'all'|'fixed'|'flex'|'irregular'>('all')
  const [reserveView,setReserveView]=useState<ReserveView>('urgent')
  const [reserveSearch,setReserveSearch]=useState('')
  const groups=useMemo(()=>normalizePlanningGroups(settings?.preferences.planning_groups),[settings?.preferences.planning_groups])
  const reserves=useMemo(()=>normalizePlanningReserves(settings?.preferences.planning_reserves),[settings?.preferences.planning_reserves])
  const limits=useMemo(()=>normalizePlanningFlexLimits(settings?.preferences.planning_flex_limits),[settings?.preferences.planning_flex_limits])
  useEffect(()=>{if(!editingCap)setCap(limits[context]>0?String(limits[context]).replace('.',','):'')},[limits,context,editingCap])
  useEffect(()=>{const listener=()=>setNow(localISO());window.addEventListener('focus',listener);return()=>window.removeEventListener('focus',listener)},[])
  const data=useMemo(()=>buildFinancePlanning(tx.data||[],categories.data||[],context,now,groups,reserves,limits),[tx.data,categories.data,context,now,groups,reserves,limits])
  const decision=useMemo(()=>planningDecision({
    flexibleLimit:data.flexibleLimit,
    flexibleRemaining:data.flexibleRemaining,
    flexiblePaceDelta:data.flexiblePaceDelta,
    reserveOutstanding:data.reserveOutstanding,
    reserveMonthlySuggested:data.reserveMonthlySuggested,
    reserveCount:data.reserves.length
  }),[data])

  const reservePriority=useMemo(
    ()=>planningReservePriorities(data.reserves,now),
    [data.reserves,now]
  )

  const reserveVisible=useMemo(
    ()=>filterPlanningReserves(reservePriority.entries,reserveView,reserveSearch),
    [reservePriority,reserveView,reserveSearch]
  )
  const reserveVisibleTotals=useMemo(
    ()=>reserveVisibleSummary(reserveVisible),
    [reserveVisible]
  )

  const reservePendingCount=reservePriority.entries.filter(
    r=>r.status!=='complete'
  ).length

  const categoryRows=useMemo(()=>[...(categories.data||[])].filter(c=>String(c.type)==='expense').sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR')),[categories.data])
  const liveIds=useMemo(()=>new Set(data.categoryBreakdown.map(c=>c.id)),[data.categoryBreakdown])
  const displayCategories=useMemo(()=>{
    const base=showAll?categoryRows:categoryRows.filter(c=>liveIds.has(String(c.id)))
    const tokens=categorySearch.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim().split(/\s+/).filter(Boolean)
    return base.filter(c=>{
      const id=String(c.id)
      const bucket=groups[context][id]||'flex'
      if(categoryGroup!=='all'&&bucket!==categoryGroup)return false
      const name=String(c.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR')
      return tokens.every(t=>name.includes(t))
    })
  },[showAll,categoryRows,liveIds,categorySearch,categoryGroup,groups,context])
  const notices = (synced:boolean,what:string)=>showToast(synced?`${what} sincronizado.`:`${what} salvo neste aparelho; sincronização pendente.`,synced?'success':'info')
  const saveBucket=async(id:string,bucket:PlanningBucket)=>{
    if(!settings||working)return
    setWorking(true)
    try{const result=await updateSettings({preferences:{planning_groups:{...groups,[context]:{...groups[context],[id]:bucket}}}});notices(result.synced,'Classificação')}
    catch{showToast('Não foi possível salvar a classificação.','error')}
    finally{setWorking(false)}
  }
  const saveCap=async()=>{
    if(!settings||working)return
    const value=cap.trim()?parseCurrency(cap):0
    if(!Number.isFinite(value)||value<0||value>100000000){showToast('Limite inválido. Use até R$ 100 milhões.','error');return}
    setWorking(true)
    try{const result=await updateSettings({preferences:{planning_flex_limits:{...limits,[context]:Math.round(value*100)/100}}});notices(result.synced,'Limite flexível');setEditingCap(false)}
    catch{showToast('Não foi possível salvar o limite.','error')}
    finally{setWorking(false)}
  }
  const saveReserve=async()=>{
    if(!settings||working)return
    const value=parseCurrency(draft.value),saved=draft.saved.trim()?parseCurrency(draft.saved):0
    if(!draft.name.trim()||draft.name.trim().length>90||!Number.isFinite(value)||value<=0||value>100000000||!Number.isFinite(saved)||saved<0||saved>value){showToast('Confira nome, valor e quantia já separada.','error');return}
    const updated:PlanningReserve={id:editingId||crypto.randomUUID(),context,name:draft.name.trim(),target_amount:Math.round(value*100)/100,declared_saved:Math.round(saved*100)/100,target_date:draft.date}
    const proposed=[...reserves.filter(x=>x.id!==editingId),updated]
    if(proposed.length>60||normalizePlanningReserves(proposed).length!==proposed.length){showToast('Data inválida ou limite de 60 reservas atingido.','error');return}
    setWorking(true)
    try{const result=await updateSettings({preferences:{planning_reserves:proposed}});notices(result.synced,'Reserva planejada');setDraft(blank());setEditingId(null)}
    catch{showToast('Não foi possível salvar esta reserva.','error')}
    finally{setWorking(false)}
  }
  const editReserve=(r:PlanningReserve)=>{setEditingId(r.id);setDraft({name:r.name,value:String(r.target_amount).replace('.',','),saved:String(r.declared_saved).replace('.',','),date:r.target_date})}
  const removeReserve=async(id:string)=>{
    if(!settings||working||!window.confirm('Remover esta reserva do planejamento? Nenhuma transação será alterada.'))return
    setWorking(true)
    try{const result=await updateSettings({preferences:{planning_reserves:reserves.filter(r=>r.id!==id)}});notices(result.synced,'Reserva removida');if(editingId===id){setEditingId(null);setDraft(blank())}}
    catch{showToast('Não foi possível remover esta reserva.','error')}
    finally{setWorking(false)}
  }
  const metric=(label:string,value:string,detail:string,accent='text-slate-900 dark:text-white')=><div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70"><p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p><p className={`mt-2 break-words text-[18px] font-bold tabular-nums ${accent}`}>{value}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</p></div>
  return <main className="mx-auto min-h-screen max-w-2xl space-y-4 bg-[#f7f8fa] px-4 pb-32 pt-3 dark:bg-slate-950">
    <header className="flex items-center gap-3"><button type="button" onClick={()=>router.push('/more')} aria-label="Voltar" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-600 dark:bg-slate-900 dark:text-white"><ArrowLeft size={19}/></button><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-widest text-teal-600">Planejamento inteligente · V173</p><h1 className="text-[20px] font-black text-slate-900 dark:text-white">Meu plano financeiro</h1></div><PiggyBank size={22} className="text-teal-600"/></header>
    <ContextToggle />
    <section
      aria-label="Navegação financeira"
      className="grid grid-cols-3 gap-2"
    >
      {([
        { label: 'Home', path: '/home' },
        { label: 'Transações', path: '/transactions' },
        { label: 'Inbox', path: '/conciliation' }
      ] as const).map(item => (
        <button
          key={item.path}
          type="button"
          onClick={() => router.push(item.path)}
          className="min-h-11 rounded-2xl border border-slate-200 bg-white px-2 text-center text-[11px] font-bold text-slate-700 transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {item.label}
        </button>
      ))}
    </section>

    <section
      aria-label="Como usar o planejamento"
      className="rounded-[20px] border border-teal-200/70 bg-teal-50/60 p-3 dark:border-teal-900/50 dark:bg-teal-950/20"
    >
      <p className="text-[12px] font-bold text-teal-900 dark:text-teal-200">
        Do realizado ao planejado
      </p>
      <p className="mt-1 text-[11px] leading-5 text-teal-800/80 dark:text-teal-200/80">
        Transações registram o que aconteceu. A Inbox reúne o que precisa de conferência.
        Aqui você organiza limites, categorias e reservas para o futuro.
        Reservas declaradas não representam transferências automáticas.
      </p>
    </section>

    <button type="button" aria-label="Abrir Radar de Fôlego para simular aperto financeiro e prioridades" onClick={()=>router.push('/cash-pressure')} className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 text-left text-[12px] font-bold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">Radar de Fôlego · simular aperto e prioridades <ChevronRight size={16}/></button>
    {(tx.loading||categories.loading||settingsLoading) ? (
      <p role="status" aria-live="polite" className="rounded-xl bg-slate-100 px-3 py-2 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        Organizando seus dados locais…
      </p>
    ) : (
      <p role="status" className="px-1 text-[10px] text-slate-500 dark:text-slate-400">
        Dados locais carregados · {context === 'dfl' ? 'DFL' : 'Pessoal'}
      </p>
    )}
    <section className={panel} aria-label="Resumo para decidir">
      <div className="flex items-center gap-2">
        <ShieldCheck size={19} className="text-teal-600" aria-hidden="true"/>
        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
          Prioridades do planejamento
        </h2>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        {decision.title}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {decision.explanation}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
          <p className="text-[11px] text-slate-500">Metas cadastradas</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            {decision.reserveCount}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
          <p className="text-[11px] text-slate-500">Falta declarar nas metas</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            {money(decision.reserveOutstanding)}
          </p>
        </div>
      </div>
      {decision.reservePending && (
        <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
          Referência mensal para metas: {money(decision.reserveMonthlySuggested)}.
          É uma sugestão, não uma despesa lançada.
        </p>
      )}
      <p className="mt-3 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
        Gastos observados, limites e reservas são indicadores diferentes.
        Nenhum deles confirma dinheiro disponível em conta.
      </p>
    </section>

    <section className={panel}><div className="flex items-center gap-2"><Layers3 size={20} className="text-teal-600"/><h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Três tipos de gastos</h2></div><p className="mt-1 text-[11px] leading-5 text-slate-500">Gastos econômicos observados em {data.month}. A classificação inicial é Flexível até você escolher outra; isso não muda lançamentos.</p><div className="mt-3 grid grid-cols-2 gap-2">{(['fixed','flex','irregular'] as const).map(bucket=><div key={bucket} className="rounded-2xl border border-slate-100 px-3 py-3 dark:border-slate-700"><p className="text-[11px] text-slate-500">{names[bucket]}</p><p className="mt-1 text-[19px] font-bold tabular-nums text-slate-900 dark:text-white">{money(data.spent[bucket])}</p><p className="mt-1 text-[10px] text-slate-500">Mês passado: {money(data.previousSpent[bucket])}</p></div>)}{metric('Total observado',money(data.totalSpent),'Não é saldo nem compromisso futuro','text-teal-700 dark:text-teal-300')}</div><p className="mt-3 text-[11px] text-slate-500">{data.classifiedCategoryCount} de {data.activeCategoryCount} categorias movimentadas classificadas manualmente.</p></section>
    <section className={panel}><div className="flex items-center gap-2"><Wallet size={19} className="text-teal-600"/><h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Limite só para despesas flexíveis</h2></div><p className="mt-1 text-[11px] leading-5 text-slate-500">Independente do limite mensal geral do Ritmo Financeiro. Não é dinheiro livre na conta.</p><div className="mt-3 flex gap-2"><input type="text" inputMode="decimal" value={cap} onFocus={()=>setEditingCap(true)} onChange={e=>setCap(e.target.value)} aria-label="Limite de gastos flexíveis" placeholder="Ex.: 1.500,00" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-[14px] font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/><button type="button" disabled={working||!settings} onClick={saveCap} className="flex items-center gap-1.5 rounded-2xl bg-teal-700 px-4 text-[12px] font-bold text-white disabled:opacity-50"><Save size={16}/> Salvar</button></div><div className="mt-3 grid grid-cols-2 gap-2">{metric('Gasto flexível',money(data.spent.flex),'Compra no cartão é reconhecida na data da compra')}{metric('Resta dentro do limite',data.flexibleRemaining===null?'Sem limite':money(data.flexibleRemaining),'Não é saldo do banco')}</div>{data.flexibleLimit!==null&&<><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className={`h-full rounded-full ${data.spent.flex>data.flexibleLimit?'bg-rose-500':'bg-teal-500'}`} style={{width:`${Math.min(100,data.spent.flex/data.flexibleLimit*100)}%`}}/></div><p className="mt-2 text-[11px] text-slate-500">Distribuição linear do restante: {money(data.flexibleDailyAllowance||0)}/dia nos {data.remainingDays} dias restantes. Isso não é previsão de caixa.</p></>}</section>
    <section className={panel}><div className="flex items-start justify-between gap-2"><div><div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-violet-500"/><h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Classificar categorias</h2></div><p className="mt-1 text-[11px] leading-5 text-slate-500">Escolha um grupo para cada categoria. Sua escolha é reversível.</p></div><button type="button" onClick={()=>setShowAll(v=>!v)} className="rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">{showAll?'Usadas':'Todas'}</button></div>
    <div className="mt-3 space-y-2">
      <input
        type="search"
        aria-label="Buscar categoria por nome"
        value={categorySearch}
        onChange={e=>setCategorySearch(e.target.value)}
        placeholder="Buscar categoria..."
        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      />
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Filtrar grupo das categorias">
        {([
          ['all','Todas'],['fixed','Fixos'],['flex','Flexíveis'],['irregular','Não mensais']
        ] as const).map(([value,label])=>(
          <button key={value} type="button"
            aria-pressed={categoryGroup===value}
            onClick={()=>setCategoryGroup(value)}
            className={`min-h-11 rounded-xl border px-1 text-[10px] font-semibold ${
              categoryGroup===value
                ? 'border-teal-600 bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200'
                : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
            }`}>
            {label}
          </button>
        ))}
      </div>
      <p role="status" className="text-[11px] text-slate-500">
        {Math.min(displayCategories.length,showAll?250:75)} de {displayCategories.length} categorias encontradas
      </p>
    </div>
    <div className="mt-3 space-y-2">{displayCategories.slice(0,showAll?250:75).map(cat=>{const id=String(cat.id),bucket=groups[context][id]||'flex',spent=data.categoryBreakdown.find(x=>x.id===id)?.amount||0;return <div key={id} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/70"><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100">{cat.name||'Sem nome'}</p><p className="text-[10px] text-slate-500">{money(spent)} neste mês · {groups[context][id]?'Classificação definida':'Padrão: Flexível'}</p></div><select aria-label={`Grupo de ${cat.name||'categoria'}`} value={bucket} disabled={working||!settings} onChange={e=>void saveBucket(id,e.target.value as PlanningBucket)} className="max-w-[129px] rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-white">{(['flex','fixed','irregular'] as const).map(v=><option value={v} key={v}>{names[v]}</option>)}</select></div>})}{displayCategories.length===0&&<p className="py-4 text-center text-[12px] text-slate-500">Ainda não há categorias movimentadas neste mês. Toque em Todas para classificar antecipadamente.</p>}</div><p className="mt-3 text-[10px] text-slate-500">Fixos: {descriptions.fixed}. Flexíveis: {descriptions.flex}. Não mensais: {descriptions.irregular}.</p></section>
    <section className={panel} aria-label="Agenda das metas financeiras">
      <div className="flex items-center gap-2">
        <CalendarDays size={19} className="text-teal-600"/>
        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
          Agenda de metas
        </h2>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">
        Reservas planejadas não são dívidas nem saídas confirmadas.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {([
          ['Vencidas', reservePriority.overdue],
          ['Até 30 dias', reservePriority.upcoming],
          ['Concluídas', reservePriority.complete]
        ] as const).map(([label,count])=>(
          <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <p className="text-[10px] text-slate-500">{label}</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{count}</p>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <label htmlFor="planning-reserve-search" className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          Buscar reserva
        </label>
        <input
          id="planning-reserve-search"
          type="search"
          value={reserveSearch}
          onChange={e=>setReserveSearch(e.target.value)}
          placeholder="Nome da meta..."
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Filtrar agenda de metas">
        {([
          ['urgent','Até 30 dias'],
          ['overdue','Vencidas'],
          ['all','Todas'],
          ['complete','Concluídas']
        ] as const).map(([view,label])=>(
          <button
            key={view}
            type="button"
            aria-pressed={reserveView===view}
            onClick={()=>setReserveView(view)}
            className={`min-h-11 rounded-xl border px-2 py-2 text-[11px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 ${
              reserveView===view
                ? 'border-teal-600 bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200'
                : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500" role="status">
        {reserveVisible.length} de {reservePriority.entries.length} metas exibidas
        {' · '}{reservePendingCount} com valor a declarar
        {' · '}Falta declarar nas metas exibidas: {money(reserveVisibleTotals.outstanding)}
      </p>
      <div className="mt-3 space-y-2">
        {reserveVisible.map(r=>(
          <div key={r.id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold dark:text-white">{r.name}</p>
              <p className="text-[11px] text-slate-500">
                {r.status==='overdue'?'Vencida':r.status==='upcoming'?'Próxima':r.status==='complete'?'Concluída':'Futura'}
                {' · '}{fmtDate(r.target_date)}
              </p>
              <p className="text-[11px] text-slate-500">
                Falta declarar: {money(r.outstanding)}
              </p>
            </div>
            <button type="button"
              onClick={()=>{
                const original=data.reserves.find(x=>x.id===r.id)
                if(original)editReserve(original)
                document.getElementById('planning-reserve-editor')?.scrollIntoView({behavior:'smooth',block:'start'})
              }}
              className="min-h-11 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-teal-700 dark:border-slate-700">
              Editar
            </button>
          </div>
        ))}
        {reserveVisible.length===0&&(
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500 dark:border-slate-700">
            {reserveView==='urgent'
              ? 'Nenhuma meta vencida ou nos próximos 30 dias corresponde à busca.'
              : reserveView==='overdue'
                ? 'Nenhuma meta vencida corresponde à busca.'
                : reserveView==='complete'
                  ? 'Nenhuma meta concluída corresponde à busca.'
                  : 'Nenhuma reserva corresponde à busca neste contexto.'}
          </p>
        )}
      </div>
    </section>

    <section className={panel}><div className="flex items-center gap-2"><PiggyBank size={20} className="text-amber-600"/><h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Reservas para gastos futuros</h2></div><p className="mt-1 text-[11px] leading-5 text-slate-500">Ex.: IPVA, seguro, presente, manutenção, licença. O valor “já separado” é declarado manualmente, não é verificado em uma conta. Nenhuma movimentação é criada.</p><div className="mt-3 grid grid-cols-2 gap-2">{metric('Falta planejar',money(data.reserveOutstanding),'Somatório ainda não declarado como separado')}{metric('Parcela mensal sugerida',money(data.reserveMonthlySuggested),'Estimativa de planejamento, não débito automático')}</div><div className="mt-3 space-y-2">{data.reserves.map(r=><div key={r.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-[13px] font-bold text-slate-800 dark:text-white">{r.name}</p><p className="mt-1 text-[11px] text-slate-500">Meta: {money(r.target_amount)} · vence {fmtDate(r.target_date)}</p><p className="mt-1 text-[11px] text-slate-500">Declarado separado: {money(r.declared_saved)} · Falta: {money(r.outstanding)}</p><p className={`mt-1 text-[11px] font-semibold ${r.overdue?'text-rose-600':'text-teal-700 dark:text-teal-300'}`}>{r.overdue?'Data vencida · reveja a meta':'Sugerido: '+money(r.monthlySuggested)+'/mês'}</p></div><button type="button" onClick={()=>editReserve(r)} aria-label={`Editar ${r.name}`} className="rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Editar</button><button type="button" disabled={working} onClick={()=>void removeReserve(r.id)} aria-label={`Remover ${r.name}`} className="rounded-xl border border-rose-100 p-2 text-rose-600 dark:border-rose-900"><Trash2 size={17}/></button></div></div>)}</div><div id="planning-reserve-editor" className="mt-4 scroll-mt-20 border-t border-slate-100 pt-4 dark:border-slate-700">
    {editingId&&(
      <button type="button" disabled={working}
        onClick={()=>{setEditingId(null);setDraft(blank())}}
        className="mb-3 min-h-11 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
        Cancelar edição e limpar formulário
      </button>
    )}
    <h3 className="flex items-center gap-2 text-[13px] font-bold text-slate-800 dark:text-white"><Plus size={17}/>{editingId?'Editar reserva planejada':'Adicionar reserva planejada'}</h3><div className="mt-3 space-y-2"><input aria-label="Nome da reserva" value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))} placeholder="IPVA, seguro, viagem..." maxLength={90} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/><div className="grid grid-cols-2 gap-2"><label className="text-[11px] text-slate-500">Valor alvo<input value={draft.value} inputMode="decimal" onChange={e=>setDraft(d=>({...d,value:e.target.value}))} placeholder="1.200,00" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-[13px] text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label><label className="text-[11px] text-slate-500">Já separado (manual)<input value={draft.saved} inputMode="decimal" onChange={e=>setDraft(d=>({...d,saved:e.target.value}))} placeholder="0,00" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-[13px] text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label></div><label className="block text-[11px] text-slate-500">Vencimento esperado<input value={draft.date} onChange={e=>setDraft(d=>({...d,date:e.target.value}))} type="date" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label><div className="flex gap-2"><button type="button" disabled={working||!settings} onClick={saveReserve} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-[12px] font-bold text-white disabled:opacity-50"><Save size={16}/>{working?'Salvando':'Salvar reserva'}</button>{editingId&&<button type="button" onClick={()=>{setEditingId(null);setDraft(blank())}} className="rounded-xl border border-slate-200 px-4 text-[12px] text-slate-500">Cancelar</button>}</div></div></div></section>
    <section className={panel}><div className="flex items-center gap-2"><AlertTriangle size={18} className="text-amber-600"/><h2 className="text-[15px] font-bold text-slate-800 dark:text-white">Recomendações do planejamento</h2></div><div className="mt-3 space-y-2">{data.recommendations.length?data.recommendations.map((note,i)=><p key={i} className="rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">{note}</p>):<p className="text-[12px] text-slate-500">Sem alertas novos para estas configurações.</p>}</div><div className="mt-3 flex gap-2 rounded-xl bg-teal-50 p-3 dark:bg-teal-950/30"><ShieldCheck size={19} className="shrink-0 text-teal-700"/><p className="text-[11px] leading-5 text-slate-600 dark:text-slate-300">Este plano é informativo. Não cria lançamentos, reserva dinheiro real, edita transações nem substitui o saldo das contas. Para dinheiro efetivo, use Transações ou Metas e Caixinhas.</p></div></section>
    <nav aria-label="Acesso a outras áreas" className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>router.push('/spending-pulse')} className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-white px-2 text-[12px] font-bold text-slate-700 dark:bg-slate-900 dark:text-white"><CreditCard size={16}/> Ritmo <ChevronRight size={14}/></button><button type="button" onClick={()=>router.push('/agenda')} className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-white px-2 text-[12px] font-bold text-slate-700 dark:bg-slate-900 dark:text-white"><CalendarDays size={16}/> Agenda <ChevronRight size={14}/></button></nav>
    <p className="flex items-start gap-2 text-[10px] leading-4 text-slate-500"><Info size={14} className="shrink-0"/>Orçamento por categoria, caixinhas, recorrências e saldos existentes permanecem independentes. O planejamento não soma compromissos para deduzir saldo.</p>
  </main>
}
