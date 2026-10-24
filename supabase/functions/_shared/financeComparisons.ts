// V171 — Comparativos financeiros puros para consultas do WhatsApp Finance.
// Não acessa banco, não altera lançamentos e não decide pagamento.
export type FinanceBotContext = 'dfl' | 'personal' | null
export type FinanceComparisonIntent =
  | { kind: 'compare'; context: FinanceBotContext; months: [string, string] }
  | { kind: 'trend'; context: FinanceBotContext; months: string[] }
  | { kind: 'invalid'; reason: string }

export type FinanceBotTransaction = {
  date?: string | null
  context?: string | null
  type?: string | null
  amount?: number | null
  status?: string | null
  affects_balance?: boolean | null
  credit_card_id?: string | null
  invoice_id?: string | null
  transfer_group_id?: string | null
  goal_id?: string | null
  loan_id?: string | null
  financing_id?: string | null
  debt_id?: string | null
}

const months = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const aliases: Record<string, number> = {
  jan:1,janeiro:1,fev:2,fevereiro:2,mar:3,marco:3,abr:4,abril:4,
  mai:5,maio:5,jun:6,junho:6,jul:7,julho:7,ago:8,agosto:8,
  set:9,setembro:9,out:10,outubro:10,nov:11,novembro:11,dez:12,dezembro:12,
}
const normalize = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()
const monthISO = (y: number, m: number) => `${y}-${String(m).padStart(2,'0')}`
const shiftedMonth = (ym: string, offset: number) => {
  const [year, month] = ym.split('-').map(Number)
  const index = year * 12 + month - 1 + offset
  return monthISO(Math.floor(index / 12), index % 12 + 1)
}
export const monthLabel = (iso: string) => {
  const [y, m] = iso.split('-').map(Number)
  return `${(months[m-1] || 'Mês').replace(/^./, c=>c.toUpperCase())}/${y}`
}
const extractMonth = (part: string, fallbackYear: number): { iso: string; explicitYear: boolean } | null => {
  const normalized = normalize(part)
  const n = normalized.match(/\b(20\d{2})[-\/](0?[1-9]|1[0-2])\b/)
  if (n) return {iso: monthISO(Number(n[1]), Number(n[2])), explicitYear: true}
  const numeric = normalized.match(/\b(0?[1-9]|1[0-2])[-\/](\d{2}|20\d{2})\b/)
  if (numeric) return {iso: monthISO(Number(numeric[2].length===2?'20'+numeric[2]:numeric[2]),Number(numeric[1])),explicitYear:true}
  const token = normalized.split(/[^a-z0-9]+/).filter(Boolean)
  const found = token.find(value => aliases[value] !== undefined)
  if (!found) return null
  const year = normalized.match(/\b(20\d{2})\b/)
  return {iso:monthISO(year?Number(year[1]):fallbackYear,aliases[found]),explicitYear:!!year}
}

export function parseFinanceComparison(raw: string, today: string): FinanceComparisonIntent | null {
  const s = normalize(raw).replace(/^\//, '')
  const context: FinanceBotContext = /\bpessoal\b/.test(s)?'personal':/\b(empresa|empresarial|dfl)\b/.test(s)?'dfl':null
  const cleaned = s.replace(/\b(pessoal|empresa|empresarial|dfl)\b/g,' ').replace(/\s+/g,' ').trim()
  const current = /^20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(today)?today.slice(0,7):'2026-01'
  const currentYear = Number(current.slice(0,4))
  if (/^(?:evolucao|evolucao financeira|tendencia|historico financeiro)(?:\s+dos?|\s+nos?)?\s*(?:ultimos?\s+)?(?:3|6)\s+meses\b/.test(cleaned)) {
    const n = Number(cleaned.match(/\b(3|6)\s+meses\b/)?.[1]) as 3 | 6
    const list = Array.from({length:n},(_,i)=>shiftedMonth(current, i - n + 1))
    return {kind:'trend',context,months:list}
  }
  if (!/^(?:comparar|compare|comparativo)\b/.test(cleaned)) return null
  const part=cleaned.replace(/^(?:comparar|compare|comparativo)\s+(?:os\s+meses\s+de\s+)?/,'')
  const pieces=part.split(/\s+(?:e|com|vs|versus)\s+/)
  if (pieces.length !== 2) return {kind:'invalid',reason:'Use: comparar setembro e outubro 2026, ou comparar 09/2026 e 10/2026.'}
  const left=extractMonth(pieces[0],currentYear),right=extractMonth(pieces[1],currentYear)
  if (!left || !right) return {kind:'invalid',reason:'Não reconheci os dois meses. Exemplo: comparar setembro e outubro de 2026.'}
  let a=left.iso,b=right.iso
  if (!left.explicitYear && right.explicitYear) a=monthISO(Number(b.slice(0,4)),Number(a.slice(5)))
  if (!right.explicitYear && left.explicitYear) b=monthISO(Number(a.slice(0,4)),Number(b.slice(5)))
  if (a===b) return {kind:'invalid',reason:'Escolha dois meses diferentes para comparar.'}
  if (a>b) [a,b]=[b,a]
  // Mês futuro não é dado realizado; evita interpretar projeção como receita.
  if (b>current) return {kind:'invalid',reason:'A comparação é somente de meses já iniciados. Para previsão, use a Agenda Financeira.'}
  return {kind:'compare',context,months:[a,b]}
}

export type FinanceBotMonthTotal = { month: string; income: number; expense: number; net: number; count: number }
export function aggregateFinanceMonths(rows: FinanceBotTransaction[], wanted: string[], context: FinanceBotContext): FinanceBotMonthTotal[] {
  const out = new Map<string,FinanceBotMonthTotal>()
  for (const month of wanted) out.set(month,{month,income:0,expense:0,net:0,count:0})
  for (const tx of rows) {
    const month=String(tx.date||'').slice(0,7)
    const current=out.get(month)
    if(!current)continue
    if(context && tx.context!==context)continue
    if(tx.status!=='done'||tx.affects_balance!==true)continue
    if(tx.credit_card_id||tx.invoice_id||tx.transfer_group_id||tx.goal_id||tx.loan_id||tx.financing_id||tx.debt_id)continue
    const amount=Number(tx.amount)
    if(!Number.isFinite(amount)||amount<=0)continue
    if(tx.type==='income')current.income+=amount
    else if(tx.type==='expense'||tx.type==='sangria')current.expense+=amount
    else continue
    current.count++
  }
  return wanted.map(month=>{
    const m=out.get(month)!
    const income=Math.round(m.income*100)/100,expense=Math.round(m.expense*100)/100
    return {...m,income,expense,net:Math.round((income-expense)*100)/100}
  })
}
export const financeCompareDelta = (current:number,prior:number): string => {
  if(prior<=0)return 'sem base anterior'
  const n=(current-prior)/Math.abs(prior)*100
  return `${n>=0?'+':''}${n.toFixed(1)}%`
}
