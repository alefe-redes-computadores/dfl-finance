/**
 * R432 — consultas locais ampliadas. Motor puro, sem I/O, Gemini ou escrita.
 * Nao tenta explicar causas; palavras/entidades ambiguas ficam com o chat Gemini.
 */
import {
  filterRealizedFinancialTransactions,
  getFinancialFlowSummary,
  type FinancialTransactionLike,
} from '@/lib/financialMetrics'

export type Financial360Kind = 'comparison' | 'pending-expenses' | 'receivables' | 'open-invoices' | 'due'
export type Financial360Metric = 'expense' | 'income' | 'net'
export type Financial360Context = 'dfl' | 'personal'
export type Financial360Month = { start: string; end: string; label: string; key: string }
export type Financial360Question = {
  kind: Financial360Kind
  title: string
  description: string
  metric?: Financial360Metric
  periods?: readonly [Financial360Month, Financial360Month]
  month?: Financial360Month
  start?: string
  end?: string
  dueSource?: 'all' | 'invoices'
}
export type Financial360Item = { id: string; label: string; source: string; date?: string; amount?: number; href: string }
export type Financial360Answer = {
  state: 'ready' | 'no-data' | 'insufficient'
  title: string
  detail: string
  count: number
  total?: number
  first?: { label: string; amount: number; count: number }
  second?: { label: string; amount: number; count: number }
  difference?: number
  items?: Financial360Item[]
}
export type Financial360Inputs = {
  transactions?: readonly (FinancialTransactionLike & { id?: string; description?: string; due_date?: string | null; credit_card_id?: string | null; invoice_id?: string | null })[]
  invoices?: readonly { id: string; context?: Financial360Context; credit_card_id: string; due_date: string; total_amount: number; paid_amount: number; status: string }[]
  cards?: readonly { id: string; context?: Financial360Context; name: string }[]
  subscriptions?: readonly { id: string; context?: Financial360Context; name: string; next_due_date?: string | null; amount: number; status: string }[]
  debts?: readonly { id: string; context?: Financial360Context; person_name: string; total_amount: number; paid_amount: number; due_date?: string | null; status: string }[]
  loans?: readonly { id: string; context?: Financial360Context; description?: string | null; direction?: string | null; lender?: string | null; remaining_amount: number; due_date?: string | null; status: string }[]
  financings?: readonly { id: string; context?: Financial360Context; name: string; next_due_date?: string | null; installment_value?: number; installment_amount?: number; status: string }[]
}
const fold = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[?!.:,;]+$/g,'').replace(/\s+/g,' ').trim()
const pad = (v: number) => String(v).padStart(2,'0')
const iso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const moneyValue = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? Math.max(0,n) : 0 }
const month = (y: number,m: number): Financial360Month => {
  const key = `${y}-${pad(m)}`
  return {key,start:`${key}-01`,end:`${key}-${pad(new Date(y,m,0).getDate())}`,label:new Date(y,m-1,15,12).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}
}
const names: Record<string,number> = { janeiro:1,jan:1,fevereiro:2,fev:2,marco:3,mar:3,abril:4,abr:4,maio:5,mai:5,junho:6,jun:6,julho:7,jul:7,agosto:8,ago:8,setembro:9,set:9,outubro:10,out:10,novembro:11,nov:11,dezembro:12,dez:12 }
const monthToken = /\b(mes passado|mes anterior|mes atual|este mes|esse mes|neste mes|desse mes|deste mes|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|(?:0?[1-9]|1[0-2])\/(?:20\d{2}|\d{2}))(?:(?: de | )(20\d{2}))?\b/g
function parseMonthToken(value: string, yearPart: string | undefined, reference: Date): Financial360Month | null {
  let y=reference.getFullYear(),m=reference.getMonth()+1
  if (/^mes (?:passado|anterior)$/.test(value)) { const d=new Date(y,m-2,15,12); return month(d.getFullYear(),d.getMonth()+1) }
  if (/^(?:mes atual|este mes|esse mes|neste mes|desse mes|deste mes)$/.test(value)) return month(y,m)
  if (value.includes('/')) {const a=value.split('/');m=Number(a[0]);y=a[1].length===2?2000+Number(a[1]):Number(a[1])}
  else {m=names[value] ?? 0;if(yearPart)y=Number(yearPart)}
  return y>=2000&&y<=2099&&m>=1&&m<=12?month(y,m):null
}
function findMonths(input: string, reference: Date): Financial360Month[] {
  const out: Financial360Month[]=[]
  // RegExp.exec, em vez de String.matchAll, funciona com o target TS legado
  // do Finance sem downlevelIteration nem alteracao no tsconfig.
  // Instancia local evita compartilhar lastIndex entre consultas consecutivas.
  const scanner = new RegExp(monthToken.source, monthToken.flags)
  let match = scanner.exec(input)
  while (match !== null) {
    const item = parseMonthToken(match[1], match[2], reference)
    if (item) out.push(item)
    match = scanner.exec(input)
  }
  return out
}
function asDays(input: string, reference: Date): {start:string;end:string;label:string}|null {
  const today=new Date(reference.getFullYear(),reference.getMonth(),reference.getDate(),12)
  let n=0
  const match=input.match(/\b(?:nos?|para os?|dentro dos?)?\s*proximos? (7|15|30) dias\b/)
  if(match)n=Number(match[1])
  else if(/\besta semana\b/.test(input))n=7-((today.getDay()+6)%7)
  else if(/\bhoje\b/.test(input))n=1
  else if(/\bamanha\b/.test(input)){today.setDate(today.getDate()+1);n=1}
  if(!n)return null
  const last=new Date(today);last.setDate(last.getDate()+n-1)
  return {start:iso(today),end:iso(last),label:n===1?(input.includes('amanha')?'amanhã':'hoje'):match?`próximos ${n} dias`:'até domingo'}
}
const unsafeQualifier = /\b(nubank|inter|itau|bradesco|caixa|mercado|alimentacao|conta especifica|cartao especifico|categoria|por que|porque|motivo|explique|qual conta)\b/
/** Frases curtas comprovaveis. Falhas de interpretacao deixam a busca/Gemini agir normalmente. */
export function interpretFinancialQuestion360(input: string, reference=new Date()): Financial360Question | null {
  if(input.length<4||input.length>240)return null
  const q=fold(input)
  if(!q || /\b(criar|cadastrar|registrar|excluir|editar|apagar|transferir|pagar|anexar)\b/.test(q))return null
  const comparison= /\b(compare|comparar?|comparacao|comparativo|diferenca|variacao|versus|vs|gastei mais)\b/.test(q)
  if(comparison) {
    if(unsafeQualifier.test(q)||/\b(?:hoje|ontem|semana|ultimos|desde|ate|fatura|pendente|vencimento)\b/.test(q))return null
    const metric:Financial360Metric|null=/\b(receitas?|entradas?|recebi|ganhei)\b/.test(q)?'income':/\b(despesas?|gastos?|gastei)\b/.test(q)?'expense':/\b(resultado|fluxo|balanco)\b/.test(q)?'net':null
    if(!metric)return null
    const refs=findMonths(q,reference)
    if(refs.length!==2||refs[0].key===refs[1].key||/\b20\d{2}\b/.test(q.replace(monthToken,' ')))return null
    const gap=Math.abs((Number(refs[0].key.slice(0,4))-Number(refs[1].key.slice(0,4)))*12+Number(refs[0].key.slice(5,7))-Number(refs[1].key.slice(5,7)))
    if(gap>18)return null
    return {kind:'comparison',title:'Comparativo financeiro',description:`${refs[0].label} × ${refs[1].label}`,metric,periods:[refs[0],refs[1]]}
  }
  const dates=asDays(q,reference)
  if(dates && /\b(vencem?|vencimentos?|vence|vencerao|faturas?|contas? a pagar|pagamentos? a vencer)\b/.test(q)) {
    if(/\b(?:nubank|do cartao|da conta|de um cartao|de uma conta|pessoa|cliente|valor exato)\b/.test(q))return null
    const invoices=/\b(fatura|faturas|cartao|cartoes)\b/.test(q)
    return {kind:'due',title:invoices?'Faturas a vencer':'Próximos vencimentos',description:dates.label,start:dates.start,end:dates.end,dueSource:invoices?'invoices':'all'}
  }
  if(/^(?:(?:minhas? )?faturas? (?:em aberto|abertas?|pendentes?)|quais? (?:sao )?(?:as )?faturas? (?:em aberto|abertas|pendentes)|quanto (?:eu )?devo (?:de|em|nas?) faturas?|total (?:das? )?faturas? (?:abertas|em aberto))$/.test(q))
    return {kind:'open-invoices',title:'Faturas em aberto',description:'Valores restantes nas faturas cadastradas'}
  if(/^(?:quanto (?:eu )?(?:tenho|falta) (?:para|pra|a) receber|quanto tenho (?:de )?valores? a receber|quem (?:me )?deve|valores? a receber|meus valores? a receber)$/.test(q))
    return {kind:'receivables',title:'Valores a receber',description:'Valores ainda não quitados no controle de devedores'}
  const pending=/^(?:quais? (?:sao )?(?:as )?)?(?:despesas?|pagamentos?|gastos?) pendentes?(?: (?:de|em|no|do) .+)?$|^quanto (?:tenho|ha|existe) (?:de )?(?:despesas?|pagamentos?|gastos?) pendentes?(?: (?:de|em|no|do) .+)?$/.test(q)
  if(pending) {
    if(/\b(?:cartao|fatura|nubank|conta|categoria|com|semana|hoje|ontem)\b/.test(q))return null
    const refs=findMonths(q,reference)
    if(refs.length>1)return null
    const hasSuffix=/\bpendentes? (?:de|em|no|do) (.+)$/.test(q)
    const hasTime=/\b(?:de|em|no|do)\s+(?:20\d{2}|\d{1,2}\/\d{2,4}|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|mes passado|mes anterior|este mes|esse mes|mes atual)/.test(q)
    if(((hasTime||hasSuffix)&&!refs.length)||/\b20\d{2}\b/.test(q.replace(monthToken,' ')))return null
    return {kind:'pending-expenses',title:'Despesas pendentes',description:refs[0]?.label??'Todos os períodos cadastrados',month:refs[0]}
  }
  return null
}
function validDate(value: string|undefined|null): value is string {if(!value||!/^20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(value))return false;const d=new Date(`${value}T12:00:00`);return !Number.isNaN(d.getTime())&&iso(d)===value}
function within(value:string|undefined|null,start:string,end:string):value is string{return validDate(value)&&value>=start&&value<=end}
function list(items:Financial360Item[]):Financial360Item[]{return items.sort((a,b)=>(a.date??'9999').localeCompare(b.date??'9999')||a.label.localeCompare(b.label)).slice(0,6)}
export function answerFinancialQuestion360(q:Financial360Question,input:Financial360Inputs,context:Financial360Context):Financial360Answer {
  // A tela consulta exclusivamente registros do usuario/contexto. Filtro canonico
  // abaixo protege as consultas numericas mesmo se o chamador errar o contexto.
  const transactions=(input.transactions??[]).filter(tx=>tx.context===context)
  const no=(detail:string):Financial360Answer=>({state:'no-data',title:q.title,detail,count:0})
  if(q.kind==='comparison') {
    const [a,b]=q.periods??[]
    if(!a||!b||!q.metric)return no('Períodos incompletos. Abra o Gemini para uma análise mais detalhada.')
    const rows=(span:Financial360Month)=>filterRealizedFinancialTransactions([...transactions],{context,start:span.start,end:span.end})
    const ra=rows(a),rb=rows(b)
    if(!ra.length||!rb.length)return {state:'insufficient',title:q.title,detail:'Não há registros realizados suficientes nos dois meses para uma comparação confiável neste dispositivo.',count:ra.length+rb.length}
    const metric=(r:FinancialTransactionLike[])=>{const v=getFinancialFlowSummary(r);return q.metric==='income'?v.income:q.metric==='expense'?v.expense:v.balance}
    const one=metric(ra),two=metric(rb)
    return {state:'ready',title:q.title,detail:`${q.metric==='income'?'Receitas':q.metric==='expense'?'Despesas':'Receitas menos despesas'} · valores realizados, não saldo bancário.`,count:ra.length+rb.length,first:{label:a.label,amount:one,count:ra.length},second:{label:b.label,amount:two,count:rb.length},difference:one-two}
  }
  if(q.kind==='pending-expenses') {
    const valid=transactions.filter(tx=>tx.status==='pending'&&(tx.type==='expense'||tx.type==='sangria')&&!tx.credit_card_id&&!tx.invoice_id&&!tx.transfer_group_id&&!tx.goal_id&&(!q.month||within(tx.date,q.month.start,q.month.end)))
    if(!valid.length)return no(`Nenhuma despesa pendente local encontrada · ${q.description}. Compras no cartão são acompanhadas pelas faturas.`)
    const total=valid.reduce((a,b)=>a+moneyValue(b.amount),0)
    const items=list(valid.map(tx=>({id:tx.id??'',label:tx.description||'Despesa pendente',source:'Despesa',date:tx.due_date||tx.date||undefined,amount:moneyValue(tx.amount),href:tx.id?`/transactions/details?id=${encodeURIComponent(tx.id)}`:'/transactions'})))
    return {state:'ready',title:q.title,detail:`${q.description} · sem incluir compras de cartão já representadas por fatura.`,count:valid.length,total,items}
  }
  if(q.kind==='receivables') {
    const valid=(input.debts??[]).filter(x=>(!x.context||x.context===context)&&(x.status==='pending'||x.status==='partial')&&moneyValue(x.total_amount)-moneyValue(x.paid_amount)>0)
    if(!valid.length)return no('Nenhum valor a receber em aberto encontrado neste dispositivo.')
    const total=valid.reduce((a,b)=>a+Math.max(0,moneyValue(b.total_amount)-moneyValue(b.paid_amount)),0)
    const items=list(valid.map(x=>({id:x.id,label:x.person_name||'Valor a receber',source:'A receber',date:x.due_date||undefined,amount:Math.max(0,moneyValue(x.total_amount)-moneyValue(x.paid_amount)),href:`/debts/details?id=${encodeURIComponent(x.id)}`})))
    return {state:'ready',title:q.title,detail:'Valores a receber registrados; não equivalem a dinheiro em caixa.',count:valid.length,total,items}
  }
  const cardById=new Map((input.cards??[]).filter(x=>!x.context||x.context===context).map(x=>[x.id,x.name]))
  const invoices=(input.invoices??[]).filter(x=>(!x.context||x.context===context)&&x.status!=='paid'&&moneyValue(x.total_amount)-moneyValue(x.paid_amount)>0)
  if(q.kind==='open-invoices') {
    if(!invoices.length)return no('Nenhuma fatura com saldo restante encontrada neste dispositivo.')
    const total=invoices.reduce((v,x)=>v+Math.max(0,moneyValue(x.total_amount)-moneyValue(x.paid_amount)),0)
    const items=list(invoices.map(x=>({id:x.id,label:cardById.get(x.credit_card_id)||'Cartão',source:'Fatura',date:x.due_date,amount:Math.max(0,moneyValue(x.total_amount)-moneyValue(x.paid_amount)),href:x.credit_card_id?`/cards/details?id=${encodeURIComponent(x.credit_card_id)}`:'/cards'})))
    return {state:'ready',title:q.title,detail:'Saldo restante das faturas cadastradas, inclusive vencidas. Não representa o limite utilizado total.',count:invoices.length,total,items}
  }
  if(q.kind==='due'&&q.start&&q.end) {
    let items:Financial360Item[]=invoices.filter(x=>within(x.due_date,q.start!,q.end!)).map(x=>({id:`invoice:${x.id}`,label:cardById.get(x.credit_card_id)||'Cartão',source:'Fatura',date:x.due_date,amount:Math.max(0,moneyValue(x.total_amount)-moneyValue(x.paid_amount)),href:x.credit_card_id?`/cards/details?id=${encodeURIComponent(x.credit_card_id)}`:'/cards'}))
    if(q.dueSource!=='invoices') {
      items.push(...transactions.filter(x=>x.status==='pending'&&(x.type==='expense'||x.type==='sangria')&&!x.credit_card_id&&!x.invoice_id&&!x.transfer_group_id&&!x.goal_id&&within(x.due_date||x.date,q.start!,q.end!)).map(x=>({id:`tx:${x.id}`,label:x.description||'Despesa pendente',source:'Despesa',date:x.due_date||x.date||undefined,amount:moneyValue(x.amount),href:x.id?`/transactions/details?id=${encodeURIComponent(x.id)}`:'/transactions'})))
      items.push(...(input.subscriptions??[]).filter(x=>(!x.context||x.context===context)&&x.status==='active'&&within(x.next_due_date,q.start!,q.end!)).map(x=>({id:`sub:${x.id}`,label:x.name||'Assinatura',source:'Assinatura',date:x.next_due_date||undefined,amount:moneyValue(x.amount),href:`/subscriptions/details?id=${encodeURIComponent(x.id)}`})))
      items.push(...(input.loans??[]).filter(x=>(!x.context||x.context===context)&&x.direction==='borrowed'&&x.status!=='paid'&&within(x.due_date,q.start!,q.end!)).map(x=>({id:`loan:${x.id}`,label:x.description||x.lender||'Empréstimo',source:'Empréstimo · data contratual',date:x.due_date||undefined,href:`/loans/details?id=${encodeURIComponent(x.id)}`})))
      items.push(...(input.financings??[]).filter(x=>(!x.context||x.context===context)&&x.status!=='paid'&&within(x.next_due_date,q.start!,q.end!)).map(x=>({id:`fin:${x.id}`,label:x.name||'Financiamento',source:'Parcela de financiamento',date:x.next_due_date||undefined,amount:moneyValue(x.installment_amount||x.installment_value),href:`/financings/details?id=${encodeURIComponent(x.id)}`})))
    }
    if(!items.length)return no(`Nenhum vencimento cadastrado entre ${q.start} e ${q.end}. Não inclui vencimentos sem data ou ciclos futuros não materializados.`)
    return {state:'ready',title:q.title,detail:`${q.description}. Itens por origem; podem representar o mesmo compromisso e não são somados.`,count:items.length,items:list(items)}
  }
  return no('Não foi possível verificar esta pergunta com os dados locais disponíveis.')
}

/** Rota de aprofundamento explícito; nunca grava valores ou altera contexto. */
export function financial360Destination(q:Financial360Question):string {
  switch(q.kind){case 'comparison':return '/analysis';case 'pending-expenses':return '/transactions';case 'receivables':return '/debts';case 'open-invoices':return '/cards';case 'due':return q.dueSource==='invoices'?'/cards':'/agenda'}
}
