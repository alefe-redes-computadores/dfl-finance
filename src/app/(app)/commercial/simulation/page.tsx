'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calculator, ShieldCheck, AlertTriangle, RotateCcw, ArrowRightLeft } from 'lucide-react'
import { calculateSettlement, formatCents, parseMoneyBR, parsePercentBR } from '@/lib/commercialSettlement'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

type Scenario = {
  gross: string
  commission: string
  processing: string
  fixed: string
  retention: string
  adjustments: string
}

const initial: Scenario = {
  gross: '1000,00', commission: '12,00', processing: '3,20',
  fixed: '0,00', retention: '0,00', adjustments: '0,00'
}

const fields: { key: keyof Scenario; label: string; hint: string }[] = [
  { key: 'gross', label: 'Vendas brutas', hint: 'R$' },
  { key: 'commission', label: 'Comissão da plataforma', hint: '%' },
  { key: 'processing', label: 'Taxa de processamento', hint: '%' },
  { key: 'fixed', label: 'Taxas fixas totais', hint: 'R$' },
  { key: 'retention', label: 'Retenções e descontos', hint: 'R$' },
  { key: 'adjustments', label: 'Ajustes a favor (+) ou contra (-)', hint: 'R$' },
]

function signedMoney(value: string): number {
  const text = value.trim()
  return text.startsWith('-') ? -parseMoneyBR(text.slice(1)) : parseMoneyBR(text.replace(/^\+/, ''))
}

function compute(s: Scenario) {
  return calculateSettlement({
    grossCents: parseMoneyBR(s.gross),
    commissionBps: parsePercentBR(s.commission),
    processingBps: parsePercentBR(s.processing),
    fixedFeeCents: parseMoneyBR(s.fixed),
    retentionCents: parseMoneyBR(s.retention),
    adjustmentsCents: signedMoney(s.adjustments)
  })
}

export default function CommercialSimulationPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const haptic = useHapticFeedback()
  const [primary, setPrimary] = useState<Scenario>(initial)
  const [comparison, setComparison] = useState<Scenario>({ ...initial, commission: '15,00' })
  const [compare, setCompare] = useState(false)
  const current = useMemo(() => {
    try { return { result: compute(primary), error: '' } }
    catch (e) { return { result: null, error: e instanceof Error ? e.message : 'Valores inválidos' } }
  }, [primary])
  const other = useMemo(() => {
    try { return { result: compute(comparison), error: '' } }
    catch (e) { return { result: null, error: e instanceof Error ? e.message : 'Valores inválidos' } }
  }, [comparison])

  const input = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white'
  const panel = 'rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900'

  function reset() {
    setPrimary(initial)
    setComparison({ ...initial, commission: '15,00' })
    haptic.light()
    showToast('Simulação restaurada.', 'info')
  }

  function renderInputs(value: Scenario, setValue: (v: Scenario) => void) {
    return fields.map(f => (
      <label key={f.key} className="block space-y-1.5">
        <span className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>{f.label}</span><span>{f.hint}</span>
        </span>
        <input inputMode="decimal" className={input} value={value[f.key]}
          onChange={e => setValue({ ...value, [f.key]: e.target.value })}
          aria-label={f.label} />
      </label>
    ))
  }

  function renderResult(result: ReturnType<typeof compute> | null, error: string) {
    if (!result) return <p role="alert" className="flex items-center gap-2 text-sm text-rose-500"><AlertTriangle size={17} /> {error}</p>
    const rows = [
      ['Vendas brutas', result.grossCents],
      ['Comissão', -result.commissionCents],
      ['Processamento', -result.processingCents],
      ['Taxas fixas', -result.fixedFeeCents],
      ['Retenções', -result.retentionCents],
      ['Ajustes', result.adjustmentsCents],
    ] as const
    return <div className="space-y-3">
      {rows.map(([label, amount]) => <div key={label} className="flex justify-between gap-3 text-sm">
        <span className="text-slate-500">{label}</span><span className="font-semibold tabular-nums">{formatCents(amount)}</span>
      </div>)}
      <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500">Resultado líquido projetado</p>
        <p className={`mt-1 text-3xl font-bold tabular-nums ${result.netCents < 0 ? 'text-rose-500' : 'text-teal-500'}`}>{formatCents(result.netCents)}</p>
        {result.shortfallCents > 0 && <p className="mt-2 text-xs text-amber-500">Déficit simulado: {formatCents(result.shortfallCents)}. Não representa dívida registrada.</p>}
      </div>
    </div>
  }

  return <main className="mx-auto min-h-screen max-w-2xl space-y-5 px-4 pb-28 pt-5 text-slate-900 dark:text-slate-100">
    <header className="flex items-center gap-3">
      <button type="button" aria-label="Voltar" onClick={() => router.push('/commercial')} className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800"><ArrowLeft size={20}/></button>
      <div className="min-w-0 flex-1"><h1 className="text-xl font-bold">Simulador de repasses</h1><p className="text-xs text-slate-500">Central Comercial 360 · cenário local</p></div>
      <Calculator className="text-teal-500" size={23}/>
    </header>
    <section className="flex gap-3 rounded-3xl border border-teal-500/20 bg-teal-500/5 p-4">
      <ShieldCheck className="shrink-0 text-teal-500" size={20}/><p className="text-sm">Simulação sem conexão com pedidos, extratos ou saldos. Nenhum dado é gravado no Supabase. Taxas são exemplos editáveis, não condições oficiais de plataformas.</p>
    </section>
    <section className={`${panel} space-y-4`}><h2 className="font-bold">Cenário principal</h2>{renderInputs(primary, setPrimary)}</section>
    <section className={`${panel} space-y-4`}><h2 className="font-bold">Resumo projetado</h2>{renderResult(current.result, current.error)}</section>
    <button type="button" onClick={() => { setCompare(v => !v); haptic.light() }} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 p-4 text-sm font-bold dark:bg-slate-800"><ArrowRightLeft size={18}/>{compare ? 'Ocultar comparação' : 'Comparar outro cenário'}</button>
    {compare && <><section className={`${panel} space-y-4`}><h2 className="font-bold">Cenário alternativo</h2>{renderInputs(comparison, setComparison)}</section>
      <section className={`${panel} space-y-4`}><h2 className="font-bold">Comparação</h2>{renderResult(other.result, other.error)}
        {current.result && other.result && <div className="border-t border-slate-200 pt-3 text-sm dark:border-slate-700">Diferença em relação ao principal: <strong className="tabular-nums">{formatCents(other.result.netCents - current.result.netCents)}</strong></div>}
      </section></>}
    <button type="button" onClick={reset} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 p-4 text-sm font-bold dark:border-slate-700"><RotateCcw size={17}/> Restaurar exemplos</button>
  </main>
}
