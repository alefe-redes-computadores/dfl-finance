// V173 - Planejamento financeiro puro. Nenhuma operação de banco ou de saldo.
import { isPaceExpense, type PaceTransaction, type PaceContext } from './financePace'

export type PlanningBucket = 'fixed' | 'flex' | 'irregular'
export type PlanningGroupMap = { dfl: Record<string, PlanningBucket>; personal: Record<string, PlanningBucket> }
export type PlanningReserve = {
  id: string
  context: PaceContext
  name: string
  target_amount: number
  target_date: string
  declared_saved: number
}
export type PlanningCategory = { id?: string; name?: string | null }
export type PlanningSnapshot = {
  context: PaceContext; today: string; month: string
  spent: Record<PlanningBucket, number>; totalSpent: number
  previousSpent: Record<PlanningBucket, number>
  classifiedCategoryCount: number; activeCategoryCount: number
  flexibleLimit: number | null; flexibleRemaining: number | null; flexibleDailyAllowance: number | null
  flexiblePaceDelta: number | null; remainingDays: number
  categoryBreakdown: { id: string; name: string; bucket: PlanningBucket; amount: number; count: number }[]
  reserves: (PlanningReserve & { outstanding: number; overdue: boolean; monthsToTarget: number; monthlySuggested: number })[]
  reserveMonthlySuggested: number; reserveOutstanding: number; recommendations: string[]
}
const isoRe = /^(20\d\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const money = (n: number) => Math.round(n * 100) / 100
const obj = (x: unknown): Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {}
const safeMoney = (x: unknown) => {const v=Number(x);return Number.isFinite(v)&&v>=0?money(Math.min(v,100000000)):0}
const validDate = (value: unknown): value is string => {
  if(typeof value!=='string'||!isoRe.test(value))return false
  const [y,m,d]=value.split('-').map(Number),v=new Date(Date.UTC(y,m-1,d,12))
  return v.getUTCFullYear()===y&&v.getUTCMonth()===m-1&&v.getUTCDate()===d
}
export function normalizePlanningGroups(value: unknown): PlanningGroupMap {
  const source=obj(value),result:PlanningGroupMap={dfl:{},personal:{}}
  for(const context of ['dfl','personal'] as const){
    const group=obj(source[context])
    for(const [id,bucket] of Object.entries(group).slice(0,300)){
      if(id.length>0&&id.length<=128&&['fixed','flex','irregular'].includes(String(bucket)))result[context][id]=bucket as PlanningBucket
    }
  }
  return result
}
export function normalizePlanningReserves(value: unknown): PlanningReserve[] {
  if(!Array.isArray(value))return []
  const found=new Set<string>(),result:PlanningReserve[]=[]
  for(const item of value.slice(0,100)){
    const r=obj(item),id=String(r.id||'').trim(),name=String(r.name||'').trim()
    if(!id||id.length>80||found.has(id)||!name||name.length>90||!validDate(r.target_date))continue
    if(r.context!=='dfl'&&r.context!=='personal')continue
    const target=safeMoney(r.target_amount)
    if(target<=0)continue
    found.add(id)
    result.push({id,name,context:r.context,target_amount:target,target_date:r.target_date,declared_saved:Math.min(target,safeMoney(r.declared_saved))})
    if(result.length>=60)break
  }
  return result
}
export function normalizePlanningFlexLimits(value: unknown): {dfl:number;personal:number} {
  const raw=obj(value)
  return {dfl:safeMoney(raw.dfl),personal:safeMoney(raw.personal)}
}
const previousMonth=(date:string)=>{
  const [y,m]=date.slice(0,7).split('-').map(Number)
  const v=new Date(Date.UTC(y,m-2,1,12))
  return `${v.getUTCFullYear()}-${String(v.getUTCMonth()+1).padStart(2,'0')}`
}
const monthDistance=(today:string,target:string)=> (Number(target.slice(0,4))-Number(today.slice(0,4)))*12 + Number(target.slice(5,7))-Number(today.slice(5,7))
/** Plano e disponibilidade de limite NÃO são saldo de caixa. Toda classificação manual é reversível. */
export function buildFinancePlanning(rows:PaceTransaction[], categories:PlanningCategory[], context:PaceContext,today:string,groupsInput:unknown,reservesInput:unknown,limitsInput:unknown):PlanningSnapshot {
  if(!validDate(today))throw new Error('V173: data civil inválida')
  const groups=normalizePlanningGroups(groupsInput)[context]
  const reserves=normalizePlanningReserves(reservesInput).filter(x=>x.context===context)
  const limits=normalizePlanningFlexLimits(limitsInput)
  const month=today.slice(0,7),prev=previousMonth(today),lastDay=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7)),0,12)).getUTCDate()
  const remainingDays=Math.max(0,lastDay-Number(today.slice(8,10)))
  const categoryMap=new Map(categories.filter(x=>x.id).map(x=>[String(x.id),String(x.name||'Sem nome')]))
  const spent:Record<PlanningBucket,number>={fixed:0,flex:0,irregular:0}
  const previousSpent:Record<PlanningBucket,number>={fixed:0,flex:0,irregular:0}
  const categoriesOut=new Map<string,{id:string;name:string;bucket:PlanningBucket;amount:number;count:number}>()
  const active=new Set<string>()
  for(const tx of rows){
    if(!isPaceExpense(tx,context))continue
    const d=String(tx.date),id=String(tx.category_id||'uncategorized'),bucket=groups[id]||'flex'
    if(!d.startsWith(month)&&!d.startsWith(prev))continue
    const amount=money(Number(tx.amount)||0)
    if(d.startsWith(prev)){previousSpent[bucket]+=amount;continue}
    if(d>today)continue
    spent[bucket]+=amount;active.add(id)
    const prevCategory=categoriesOut.get(id)||{id,name:categoryMap.get(id)||'Sem categoria',bucket,amount:0,count:0}
    prevCategory.amount+=amount;prevCategory.count++;categoriesOut.set(id,prevCategory)
  }
  for(const bucket of ['fixed','flex','irregular'] as const){spent[bucket]=money(spent[bucket]);previousSpent[bucket]=money(previousSpent[bucket])}
  const limit=limits[context]>0?limits[context]:null
  const flexibleRemaining=limit===null?null:money(Math.max(0,limit-spent.flex))
  const flexibleDailyAllowance=flexibleRemaining===null?null:remainingDays>0?money(flexibleRemaining/remainingDays):0
  const flexiblePaceDelta=limit===null?null:money(spent.flex - limit*Number(today.slice(8,10))/lastDay)
  const computed=reserves.map(x=>{
    const months=Math.max(1,monthDistance(today,x.target_date)+1)
    const outstanding=money(Math.max(0,x.target_amount-x.declared_saved))
    return {...x,overdue:x.target_date<today,monthsToTarget:months,outstanding,monthlySuggested:money(outstanding/months)}
  }).sort((a,b)=>a.target_date.localeCompare(b.target_date)||a.name.localeCompare(b.name,'pt-BR'))
  const reserveMonthlySuggested=money(computed.reduce((s,r)=>s+r.monthlySuggested,0))
  const totalSpent=money(spent.fixed+spent.flex+spent.irregular)
  const recommendations:string[]=[]
  if(!active.size)recommendations.push('Sem despesas observadas neste mês. Classifique categorias quando houver dados.')
  if(active.size>0 && Array.from(active).filter(x=>Boolean(groups[x])).length<active.size)recommendations.push('Algumas categorias ainda usam o padrão Flexível. Revise a classificação para melhorar a leitura.')
  if(limit===null)recommendations.push('Defina um limite específico para gastos flexíveis, separado do limite mensal geral.')
  else if(spent.flex>limit)recommendations.push('O limite flexível já foi ultrapassado. Verifique as categorias antes de planejar novos gastos.')
  else if(flexiblePaceDelta!==null&&flexiblePaceDelta>limit*0.12)recommendations.push('O ritmo dos gastos flexíveis está acima da distribuição linear do limite.')
  if(computed.some(r=>r.overdue&&r.outstanding>0))recommendations.push('Há uma reserva com vencimento passado e valor ainda não declarado como separado.')
  if(spent.irregular>0&&!computed.length)recommendations.push('Há gastos não mensais classificados, mas nenhuma reserva futura cadastrada.')
  return {context,today,month,spent,previousSpent,totalSpent,classifiedCategoryCount:Array.from(active).filter(x=>Boolean(groups[x])).length,activeCategoryCount:active.size,
    flexibleLimit:limit,flexibleRemaining,flexibleDailyAllowance,flexiblePaceDelta,remainingDays,
    categoryBreakdown:Array.from(categoriesOut.values()).map(x=>({...x,amount:money(x.amount)})).sort((a,b)=>b.amount-a.amount),
    reserves:computed,reserveMonthlySuggested,reserveOutstanding:money(computed.reduce((s,r)=>s+r.outstanding,0)),recommendations}
}
