// V169: sugestoes deterministicas e SOMENTE LEITURA; nao altera ledger.
// Fontes: transacoes e cadastros do contexto ja sincronizados localmente.
export type ReviewKind = 'duplicate' | 'metadata' | 'recurring' | 'unusual' | 'inbox'
export type ReviewContext = 'dfl' | 'personal'
export interface ReviewItem {
  id: string
  kind: ReviewKind
  title: string
  detail: string
  evidence: string
  date: string
  amount: number
  href: string
}
export interface ReviewSummary {
  income: number
  expense: number
  net: number
  records: number
  start: string
  end: string
  items: ReviewItem[]
  counts: Record<ReviewKind, number>
}
type Row = Record<string, any>
const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const norm = (v: unknown) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
const cents = (v: unknown) => Math.round(Number(v || 0) * 100)
const civil = (v: Date) => [v.getFullYear(), String(v.getMonth() + 1).padStart(2, '0'), String(v.getDate()).padStart(2, '0')].join('-')
const addDays = (d: string, offset: number) => {
  const [y,m,dd] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m-1, dd + offset, 12)).toISOString().slice(0, 10)
}
const isoValid = (s: unknown) => typeof s === 'string' && /^20\d\d-\d\d-\d\d$/.test(s)
const dateDistance = (a: string,b: string) => Math.abs((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000)
const positiveAmount = (v: unknown) => {const n=Number(v);return Number.isFinite(n)&&n>0?n:0}
const simple = (r: Row) => ['income','expense','sangria'].includes(String(r.type)) && !r.transfer_group_id && !r.goal_id && !r.invoice_id && !r.loan_id && !r.financing_id && !r.debt_id
const realizedCash = (r: Row) => simple(r) && r.status==='done' && r.affects_balance!==false && !r.credit_card_id
const rowHref=(r: Row)=>`/transactions/details?id=${encodeURIComponent(String(r.id))}`
const isImported=(r:Row)=>['whatsapp','ai_ocr','ofx_import','ofx_merged','csv_import','csv'].includes(String(r.source||''))
const mean=(a:number[])=>a.reduce((s,v)=>s+v,0)/Math.max(1,a.length)

/** Never mutate input. Never infer money received from pending or credit-card charges. */
export function buildFinancialReview(
  raw: Row[], accounts: Row[], categories: Row[], subscriptions: Row[],
  context: ReviewContext, now = new Date()
): ReviewSummary {
  const today=civil(now),start=today.slice(0,7)+'-01', earliest=addDays(today,-183)
  const current=(raw||[]).filter(r=>r&&r.context===context&&isoValid(r.date)&&r.date<=today&&r.date>=earliest&&positiveAmount(r.amount)>0)
  const cash=current.filter(realizedCash)
  const inMonth=cash.filter(r=>r.date>=start)
  const income=inMonth.filter(r=>r.type==='income').reduce((a,r)=>a+positiveAmount(r.amount),0)
  const expense=inMonth.filter(r=>r.type==='expense'||r.type==='sangria').reduce((a,r)=>a+positiveAmount(r.amount),0)
  const itemList: ReviewItem[]=[]
  const push=(item:ReviewItem)=>{if(itemList.length<130)itemList.push(item)}
  const categoryById=new Map((categories||[]).filter(c=>c.context===context).map(c=>[String(c.id),String(c.name||'Sem categoria')]))
  const accountById=new Map((accounts||[]).filter(a=>a.context===context).map(a=>[String(a.id),String(a.name||'Conta')]))

  // Mesmo valor + conta + tipo + descricao em ate 1 dia e somente indício.
  const duplicateGroups=new Map<string,Row[]>()
  for(const r of current.filter(r=>simple(r)&&['done','pending'].includes(String(r.status)))) {
    const text=norm(r.description)
    const bank=String(r.credit_card_id||r.account_id||'')
    if(!r.id||text.length<5||!bank)continue
    const key=[r.type,cents(r.amount),bank,text,r.status].join('|')
    const group=duplicateGroups.get(key)||[];group.push(r);duplicateGroups.set(key,group)
  }
  for(const group of Array.from(duplicateGroups.values())){
    group.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.id).localeCompare(String(b.id)))
    for(let j=1;j<group.length;j++){
      const a=group[j-1],b=group[j]
      if(dateDistance(a.date,b.date)>1)continue
      if(a.id===b.id)continue
      if(a.idempotency_key&&a.idempotency_key===b.idempotency_key)continue
      if(a.recurring_group_id && a.recurring_group_id===b.recurring_group_id)continue
      const ids=[String(a.id),String(b.id)].sort()
      push({id:'duplicate:'+ids.join(':'),kind:'duplicate',title:'Possível lançamento repetido',detail:String(b.description||'Transação'),
        evidence:`${money(positiveAmount(b.amount))} · ${a.date} e ${b.date} · ${accountById.get(String(b.account_id||''))||'mesma conta/cartão'}`,date:b.date,amount:positiveAmount(b.amount),href:rowHref(b)})
    }
  }

  // Registros realizados incompletos e importações ainda não revisadas.
  for(const r of current.filter(r=>simple(r)).sort((a,b)=>String(b.date).localeCompare(String(a.date)))){
    if(!r.id)continue
    const amount=positiveAmount(r.amount),short=String(r.description||'Sem descrição')
    if(r.status==='done' && !r.credit_card_id && !r.account_id){
      push({id:'metadata-account:'+r.id,kind:'metadata',title:'Movimentação sem conta',detail:short,evidence:`${money(amount)} · ${r.date} · confira antes de confiar no saldo`,date:r.date,amount,href:rowHref(r)})
    }
    if(r.status==='done' && !r.category_id){
      push({id:'metadata-category:'+r.id,kind:'metadata',title:'Falta categoria',detail:short,evidence:`${money(amount)} · ${r.date} · melhora a análise dos gastos`,date:r.date,amount,href:rowHref(r)})
    }
    if(r.status==='pending' && !r.reviewed_at && isImported(r)){
      push({id:'inbox:'+r.id,kind:'inbox',title:'Importação para conferir',detail:short,evidence:`${money(amount)} · ${r.date} · ainda não é saldo realizado`,date:r.date,amount,href:'/conciliation'})
    }
  }

  // Suspeita de recorrência: mesma descricao+conta, >=3 meses, valor estável.
  const recurringGroups=new Map<string,Row[]>()
  for(const r of cash.filter(r=>(r.type==='expense'||r.type==='sangria')&&!r.recurring_group_id)){
    const name=norm(r.description),bank=String(r.account_id||'')
    if(name.length<5||!bank)continue
    const key=name+'|'+bank
    const group=recurringGroups.get(key)||[];group.push(r);recurringGroups.set(key,group)
  }
  const normalizedSubscriptions=new Set((subscriptions||[]).filter(s=>s.context===context&&s.status!=='cancelled').map(s=>norm(s.name)))
  for(const [key,group] of Array.from(recurringGroups.entries())){
    const description=norm(group[0]?.description)
    if(normalizedSubscriptions.has(description))continue
    const monthBuckets=new Map<string,Row>()
    for(const r of group.sort((a,b)=>String(b.date).localeCompare(String(a.date)))){
      const month=r.date.slice(0,7)
      if(!monthBuckets.has(month))monthBuckets.set(month,r)
    }
    const unique=Array.from(monthBuckets.values()).sort((a,b)=>String(b.date).localeCompare(String(a.date)))
    if(unique.length<3||dateDistance(unique[0].date,today)>45)continue
    const last=unique.slice(0,4),amounts=last.map(r=>positiveAmount(r.amount)),avg=mean(amounts)
    if(avg<10||Math.max(...amounts)-Math.min(...amounts)>Math.max(5,avg*0.12))continue
    const monthNumbers=last.map(r=>Number(r.date.slice(0,4))*12+Number(r.date.slice(5,7)))
    if(monthNumbers.some((v,i)=>i>0&&monthNumbers[i-1]-v>2))continue
    const r=unique[0],display=String(r.description)
    push({id:'recurring:'+key,kind:'recurring',title:'Possível gasto recorrente',detail:display,evidence:`${last.length} meses observados · cerca de ${money(avg)} por ocorrência · não cria assinatura automaticamente`,date:r.date,amount:avg,href:'/subscriptions'})
  }

  // Despesa fora do histórico: mediana da mesma categoria e 5 amostras previas.
  const categoryGroups=new Map<string,Row[]>()
  for(const r of cash.filter(r=>(r.type==='expense'||r.type==='sangria')&&r.category_id&&r.account_id)){
    const key=String(r.category_id)
    const group=categoryGroups.get(key)||[];group.push(r);categoryGroups.set(key,group)
  }
  for(const [category, group] of Array.from(categoryGroups.entries())){
    const sorted=group.sort((a,b)=>String(b.date).localeCompare(String(a.date)))
    const recent=sorted.find(r=>r.date>=addDays(today,-30))
    if(!recent)continue
    const historical=sorted.filter(r=>r.id!==recent.id&&r.date<recent.date).slice(0,15).map(r=>positiveAmount(r.amount)).sort((a,b)=>a-b)
    if(historical.length<5)continue
    const median=historical[Math.floor(historical.length/2)]
    const amount=positiveAmount(recent.amount)
    if(median<10||amount<100||amount<median*2.5)continue
    push({id:'unusual:'+String(recent.id),kind:'unusual',title:'Gasto acima do seu padrão',detail:String(recent.description||'Gasto'),evidence:`${money(amount)} · mediana histórica ${money(median)} · ${categoryById.get(category)||'Categoria'} · compare antes de decidir`,date:recent.date,amount,href:rowHref(recent)})
  }
  const order:Record<ReviewKind,number>={duplicate:0,inbox:1,metadata:2,unusual:3,recurring:4}
  itemList.sort((a,b)=>order[a.kind]-order[b.kind]||b.date.localeCompare(a.date)||a.id.localeCompare(b.id))
  const counts:Record<ReviewKind,number>={duplicate:0,metadata:0,recurring:0,unusual:0,inbox:0}
  for(const item of itemList)counts[item.kind]++
  return {income,expense,net:income-expense,records:inMonth.length,start,end:today,items:itemList,counts}
}
