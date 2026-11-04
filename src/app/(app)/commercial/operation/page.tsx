'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileSpreadsheet, ShieldCheck, ArrowRightLeft, RotateCcw, Download, AlertTriangle } from 'lucide-react'
import { formatCents } from '@/lib/commercialSettlement'
import { normalizeSales, normalizeReceipts, reconcile, summary, type SaleResult, type Receipt, type Match } from '@/lib/commercialBatch'
import { parseCsv, mapSales, mapReceipts, type TablePreview } from '@/lib/commercialImport'
import { exportSession, importSession } from '@/lib/commercialSession'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

const panel = 'rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900'
const control = 'w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
type Mode = 'sales' | 'receipts'

export default function CommercialOperationPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const haptic = useHapticFeedback()
  const [mode, setMode] = useState<Mode>('sales')
  const [table, setTable] = useState<TablePreview | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [sales, setSales] = useState<SaleResult[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [selectedSales, setSelectedSales] = useState<string[]>([])
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [error, setError] = useState('')
  const totals = useMemo(() => summary(sales, receipts), [sales, receipts])
  const required = mode === 'sales' ? ['reference', 'date', 'gross'] : ['reference', 'date', 'amount']
  const optional = mode === 'sales' ? ['commission', 'processing', 'fixed', 'retention', 'adjustments'] : []
  const labels: Record<string, string> = { reference: 'ID único', date: 'Data AAAA-MM-DD', gross: 'Valor bruto R$', commission: 'Comissão %', processing: 'Processamento %', fixed: 'Taxa fixa R$', retention: 'Retenção R$', adjustments: 'Ajustes +/- R$', amount: 'Repasse recebido R$' }
  const usedSales = new Set(matches.flatMap(m => m.saleReferences))
  const usedReceipts = new Set(matches.flatMap(m => m.receiptReferences))

  async function openFile(file: File | undefined) {
    if (!file) return
    setError('')
    setTable(null)
    setMapping({})
    try {
      if (file.size > 2_000_000) throw Error('Arquivo maior que 2 MB')
      const parsed = parseCsv(await file.text())
      setTable(parsed)
      const next: Record<string, string> = {}
      for (const key of [...required, ...optional]) {
        const exact = parsed.headers.find(h => h.toLowerCase() === key)
        if (exact) next[key] = exact
      }
      setMapping(next)
      haptic.light()
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha na leitura'); haptic.error() }
  }

  function applyPreview() {
    if (!table) return
    try {
      if (required.some(key => !mapping[key])) throw Error('Mapeie as colunas obrigatórias')
      if (mode === 'sales') {
        const rows = normalizeSales(mapSales(table, { reference: mapping.reference, date: mapping.date, gross: mapping.gross, commission: mapping.commission, processing: mapping.processing, fixed: mapping.fixed, retention: mapping.retention, adjustments: mapping.adjustments }))
        const existing = new Set(sales.map(s => s.reference))
        if (rows.some(row => existing.has(row.reference))) throw Error('IDs de venda já carregados; revise antes de importar')
        setSales(prev => [...prev, ...rows])
      } else {
        const rows = normalizeReceipts(mapReceipts(table, { reference: mapping.reference, date: mapping.date, amount: mapping.amount }))
        const existing = new Set(receipts.map(r => r.reference))
        if (rows.some(row => existing.has(row.reference))) throw Error('IDs de repasse já carregados; revise antes de importar')
        setReceipts(prev => [...prev, ...rows])
      }
      setTable(null); setMapping({}); setError(''); haptic.success(); showToast('Prévia adicionada somente à sessão local.', 'success')
    } catch (e) { setError(e instanceof Error ? e.message : 'Dados inválidos'); haptic.error() }
  }

  function toggle(ref: string, kind: Mode) {
    const setter = kind === 'sales' ? setSelectedSales : setSelectedReceipts
    setter(prev => prev.includes(ref) ? prev.filter(x => x !== ref) : [...prev, ref])
  }
  function matchSelected() {
    try {
      const match = reconcile(sales, receipts, selectedSales, selectedReceipts)
      if (selectedSales.some(ref => usedSales.has(ref)) || selectedReceipts.some(ref => usedReceipts.has(ref))) throw Error('Um item já conciliado não pode ser reutilizado')
      setMatches(prev => [...prev, match]); setSelectedSales([]); setSelectedReceipts([])
      haptic.success(); showToast('Conciliação simulada, sem gravação financeira.', 'success')
    } catch (e) { setError(e instanceof Error ? e.message : 'Seleção inválida'); haptic.error() }
  }
  function reset() { setSales([]); setReceipts([]); setMatches([]); setSelectedSales([]); setSelectedReceipts([]); setTable(null); setMapping({}); setError(''); haptic.light() }
  function exportAudit() {
    try {
      const payload = exportSession(sales, receipts, matches)
      const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
      const a = document.createElement('a')
      try { a.href = url; a.download = 'dfl-operacao-simulada-v2.json'; document.body.appendChild(a); a.click() }
      finally { a.remove(); URL.revokeObjectURL(url) }
      haptic.success()
      showToast('Sessão exportada com estrutura verificável.', 'success')
    } catch { haptic.error(); showToast('Falha ao exportar sessão.', 'error') }
  }
  async function restoreAudit(file: File | undefined) {
    if (!file) return
    try {
      if (file.size > 5_000_000) throw Error('Arquivo maior que 5 MB')
      const restored = importSession(await file.text())
      if (sales.length || receipts.length || matches.length) {
        if (!window.confirm('Substituir toda a sessão simulada atual pelo arquivo?')) return
      }
      setSales(normalizeSales(restored.sales))
      setReceipts(normalizeReceipts(restored.receipts))
      setMatches(restored.matches)
      setSelectedSales([]); setSelectedReceipts([]); setTable(null); setMapping({}); setError('')
      haptic.success(); showToast('Sessão simulada restaurada e conferida.', 'success')
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha na restauração'); haptic.error() }
  }

  return <main className="mx-auto min-h-screen max-w-2xl space-y-4 px-4 pb-28 pt-5 text-slate-900 dark:text-slate-100">
    <header className="flex items-center gap-3"><button type="button" aria-label="Voltar" onClick={() => router.push('/commercial')} className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800"><ArrowLeft size={19}/></button><div className="min-w-0 flex-1"><h1 className="text-xl font-bold">Operação comercial</h1><p className="text-xs text-slate-500">Importação e conciliação em simulação</p></div><FileSpreadsheet className="text-teal-500"/></header>
    <section className="flex gap-3 rounded-3xl border border-teal-500/30 bg-teal-500/5 p-4"><ShieldCheck className="shrink-0 text-teal-500"/><p className="text-sm">Laboratório local: CSV não é enviado ao servidor. Nada altera saldo, extratos, vendas reais ou plataformas. Os dados não são enviados ao servidor. Exporte a sessão para preservá-la.</p></section>
    <section className="grid grid-cols-2 gap-2">{[['Bruto', totals.grossCents], ['A receber simulado', totals.payableCents], ['Repasses importados', totals.receivedCents], ['Diferença agregada', totals.differenceCents]].map(([name, value]) => <div className={panel} key={String(name)}><p className="text-xs text-slate-500">{name}</p><p className="mt-2 break-words text-lg font-bold tabular-nums">{formatCents(Number(value))}</p></div>)}</section>
    <section className={`${panel} space-y-3`}><h2 className="font-bold">1. Importar CSV com prévia</h2><div className="grid grid-cols-2 gap-2">{(['sales','receipts'] as const).map(value => <button type="button" key={value} onClick={() => { setMode(value); setTable(null); setMapping({}); setError('') }} className={`rounded-xl p-3 text-sm font-semibold ${mode === value ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{value === 'sales' ? 'Vendas' : 'Repasses'}</button>)}</div><p className="text-xs text-slate-500">Máximo 2 MB / 5.000 linhas. CSV separado por ponto e vírgula, vírgula ou tabulação. Datas AAAA-MM-DD e valores no formato brasileiro.</p><input type="file" accept=".csv,text/csv,text/plain" aria-label="Selecionar CSV" className="block w-full text-sm" onChange={e => void openFile(e.target.files?.[0])}/>
    {table && <div className="space-y-3"><p className="text-sm font-semibold">{table.rows.length} registros identificados</p><div className="grid grid-cols-2 gap-2">{[...required, ...optional].map(key => <label className="space-y-1 text-xs" key={key}><span>{labels[key]}{required.includes(key) ? ' *' : ''}</span><select className={control} value={mapping[key] || ''} onChange={e => setMapping(prev => ({...prev, [key]: e.target.value}))}><option value="">{required.includes(key) ? 'Escolher coluna' : 'Não utilizar'}</option>{table.headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700"><table className="w-full text-left text-xs"><thead><tr>{table.headers.map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{table.rows.slice(0,5).map((row,i) => <tr key={i}>{row.map((cell,j) => <td key={j} className="max-w-40 truncate p-2">{cell}</td>)}</tr>)}</tbody></table></div><button type="button" onClick={applyPreview} className="w-full rounded-2xl bg-teal-600 p-3 text-sm font-bold text-white">Validar e carregar na sessão</button></div>}
    </section>
    {error && <p role="alert" className="flex gap-2 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-500"><AlertTriangle size={18}/>{error}</p>}
    <section className={`${panel} space-y-3`}><h2 className="flex items-center gap-2 font-bold"><ArrowRightLeft size={18}/> 2. Conciliação manual</h2><p className="text-xs text-slate-500">Selecione uma ou mais vendas e um ou mais repasses. Cada referência só pode participar de uma conciliação simulada.</p><h3 className="text-sm font-semibold">Vendas ({sales.length})</h3><div className="max-h-64 space-y-2 overflow-y-auto">{sales.map(s => <label key={s.reference} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950"><input type="checkbox" disabled={usedSales.has(s.reference)} checked={selectedSales.includes(s.reference)} onChange={() => toggle(s.reference, 'sales')}/><span className="min-w-0 flex-1 truncate">{s.reference} · {s.date}</span><strong className="tabular-nums">{formatCents(s.settlement.payableCents)}</strong></label>)}</div><h3 className="text-sm font-semibold">Repasses ({receipts.length})</h3><div className="max-h-64 space-y-2 overflow-y-auto">{receipts.map(r => <label key={r.reference} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950"><input type="checkbox" disabled={usedReceipts.has(r.reference)} checked={selectedReceipts.includes(r.reference)} onChange={() => toggle(r.reference, 'receipts')}/><span className="min-w-0 flex-1 truncate">{r.reference} · {r.date}</span><strong className="tabular-nums">{formatCents(r.amountCents)}</strong></label>)}</div><button type="button" onClick={matchSelected} disabled={!selectedSales.length || !selectedReceipts.length} className="w-full rounded-2xl bg-teal-600 p-3 text-sm font-bold text-white disabled:opacity-40">Conciliar seleção (simulação)</button></section>
    <section className={`${panel} space-y-3`}><h2 className="font-bold">3. Histórico desta sessão ({matches.length})</h2>{matches.map((m,i) => <div key={i} className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-950"><div className="flex justify-between gap-2"><strong>{m.status === 'matched' ? 'Conferido' : m.status === 'partial' ? 'Repasse insuficiente' : 'Repasse excedente'}</strong><span className="tabular-nums">{formatCents(m.differenceCents)}</span></div><p className="mt-1 break-all text-xs text-slate-500">Vendas: {m.saleReferences.join(', ')} · Repasses: {m.receiptReferences.join(', ')}</p><button type="button" onClick={() => setMatches(prev => prev.filter((_,j) => j !== i))} className="mt-2 text-xs font-semibold text-rose-500">Desfazer vínculo local</button></div>)}</section>
    <section className={`${panel} space-y-3`}><h2 className="font-bold">4. Continuidade segura da sessão</h2><p className="text-xs text-slate-500">Exporte um JSON verificável e restaure em outro dispositivo. O arquivo é validado antes de substituir a sessão. Nenhum dado vai ao servidor.</p><label className="block space-y-2 text-sm font-semibold"><span>Restaurar sessão JSON (v2)</span><input type="file" accept=".json,application/json" className="block w-full text-xs" onChange={e => void restoreAudit(e.target.files?.[0])}/></label></section>
    <div className="grid grid-cols-2 gap-2"><button type="button" onClick={exportAudit} disabled={!sales.length && !receipts.length} className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 p-3 text-sm font-bold disabled:opacity-40 dark:border-slate-700"><Download size={17}/> Exportar JSON</button><button type="button" onClick={reset} className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 p-3 text-sm font-bold dark:border-slate-700"><RotateCcw size={17}/> Limpar sessão</button></div>
  </main>
}
