'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BarChart3, CalendarDays, CheckCircle2, Info, Landmark, Save, ShieldCheck, TrendingUp, Wallet } from 'lucide-react'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useToast } from '@/contexts/ToastContext'
import { buildFinancePace, type PaceContext } from '@/lib/financePace'

const money = (v: number | null) => v === null ? 'Não definido' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const shell = 'rounded-[23px] border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800'
const pct = (n: number | null) => n === null ? 'Sem comparação' : `${n > 0 ? '+' : ''}${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const todayISO = () => {
  const now = new Date()
  // Modo local civil: o dado no Dexie é YYYY-MM-DD, nunca UTC de madrugada.
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
}
export default function SpendingPulsePage() {
  const router = useRouter()
  const { effectiveContext } = useContext_()
  const context: PaceContext = effectiveContext === 'dfl' ? 'dfl' : 'personal'
  const { settings, updateSettings, loading: settingsLoading } = useUserSettings()
  const { showToast } = useToast()
  const { data: rows, loading: txLoading } = useLocalData({ table: 'transactions', filters: { context } })
  const { data: categories } = useLocalData({ table: 'categories', filters: { context } })
  const [today, setToday] = useState(todayISO)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const configured = settings?.preferences.spending_limits?.[context] || 0
  useEffect(() => {
    if (editing) return
    setDraft(configured > 0 ? String(configured).replace('.', ',') : '')
  }, [configured, context, editing])
  useEffect(() => {
    const onFocus = () => setToday(todayISO())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])
  const pace = useMemo(
    () => buildFinancePace(rows || [], context, today, configured, categories || []),
    [rows, context, today, configured, categories]
  )
  const saveLimit = async () => {
    if (!settings || saving) return
    const raw = draft.trim().replace(/\s|R\$/gi, '')
    const clean = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/(?<=\d)\.(?=\d{3}(?:\.|$))/g, '')
    const amount = clean ? Number(clean) : 0
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000000) {
      showToast('Digite um limite válido, até R$ 100 milhões.', 'error')
      return
    }
    setSaving(true)
    try {
      const result = await updateSettings({ preferences: {
        spending_limits: { ...settings.preferences.spending_limits, [context]: Math.round(amount * 100)/100 }
      } })
      showToast(result.synced ? 'Limite mensal atualizado.' : 'Limite salvo neste aparelho; sincronização pendente.', result.synced ? 'success' : 'info')
      setEditing(false)
    } catch {
      showToast('Falha ao salvar o limite.', 'error')
    } finally { setSaving(false) }
  }
  const average = pace.elapsedDays > 0 ? pace.currentExpense / pace.elapsedDays : 0
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(Number(today.slice(0,4)), Number(today.slice(5,7))-1, 1))
  const card = (title: string, content: string, detail: string) => (
    <div className="rounded-[19px] border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/60">
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-2 break-words text-[20px] font-bold tabular-nums text-slate-900 dark:text-white">{content}</p>
      <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  )
  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-4 bg-[#f7f8fa] px-4 pb-28 pt-3 dark:bg-slate-950">
      <header className="flex items-center gap-3">
        <button type="button" onClick={()=>router.push('/more')} aria-label="Voltar" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-200"><ArrowLeft size={19}/></button>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-teal-600 dark:text-teal-400">Planejamento inteligente</p><h1 className="text-[20px] font-black text-slate-900 dark:text-white">Ritmo Financeiro</h1></div>
        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">V172</span>
      </header>
      <ContextToggle />
      <section className={shell}>
        <div className="flex items-center gap-2"><BarChart3 size={19} className="text-teal-600"/><h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Seu mês em andamento</h2></div>
        <p className="mt-1 text-[11px] capitalize text-slate-500 dark:text-slate-400">{monthLabel} · {context === 'dfl' ? 'Empresa' : 'Pessoal'}</p>
        {(txLoading || settingsLoading) && <p role="status" className="mt-2 text-[11px] text-slate-400">Sincronizando sua visão local…</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {card('Despesas do mês', money(pace.currentExpense), `${pace.currentCount} lançamentos econômicos identificados`)}
          {card('Mês anterior, mesmos dias', money(pace.previousComparableExpense), `${pace.elapsedDays} primeiros dias; não é saldo`)}
          {card('Últimos 7 dias', money(pace.weekExpense), `7 dias anteriores: ${money(pace.previousWeekExpense)}`)}
          {card('Variação de gastos', pct(pace.previousPeriodChange), 'Vs. os mesmos dias do mês passado')}
        </div>
      </section>
      <section className={shell}>
        <div className="mb-2 flex items-center gap-2"><Wallet size={19} className="text-teal-600"/><h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Meu limite mensal</h2></div>
        <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">Defina quanto pretende gastar neste contexto. Não altera orçamento por categoria, saldos nem contas bancárias.</p>
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1"><label htmlFor="pulse-limit" className="mb-1.5 block text-[11px] font-semibold text-slate-500">Limite em R$ (vazio desativa)</label><input id="pulse-limit" type="text" inputMode="decimal" value={draft} onFocus={()=>setEditing(true)} onChange={e=>setDraft(e.target.value)} placeholder="Ex.: 2.500,00" className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-[15px] font-semibold text-slate-900 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/></div>
          <button type="button" disabled={saving || !settings} onClick={saveLimit} className="flex h-12 items-center gap-2 rounded-2xl bg-teal-600 px-4 text-[12px] font-bold text-white disabled:opacity-50"><Save size={16}/>{saving ? 'Salvando' : 'Salvar'}</button>
        </div>
        {pace.monthlyLimit === null ? <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500 dark:bg-slate-900">Nenhum limite configurado. Os indicadores de gasto continuam disponíveis; você decide seu objetivo.</div> : <>
          <div className="mt-4 flex items-center justify-between gap-2 text-[12px] font-semibold"><span className="text-slate-700 dark:text-slate-200">{money(pace.currentExpense)} / {money(pace.monthlyLimit)}</span><span className={pace.currentExpense > pace.monthlyLimit ? 'text-rose-600' : 'text-teal-600'}>{Math.round(pace.currentExpense / pace.monthlyLimit * 100)}%</span></div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className={`h-full rounded-full ${pace.currentExpense > pace.monthlyLimit ? 'bg-rose-500' : 'bg-teal-500'}`} style={{width:`${Math.min(100, pace.currentExpense / pace.monthlyLimit * 100)}%`}}/></div>
          <div className="mt-3 grid grid-cols-2 gap-2">{card('Resta no limite',money(pace.remainingLimit),'Não é dinheiro livre no banco')}{card('Média por dia restante',money(pace.suggestedDailyMaximum),'Distribuição linear do limite não usado')}</div>
          {pace.paceDifference !== null && <div className="mt-3 flex gap-2 rounded-2xl bg-amber-50 p-3 text-[11px] leading-5 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"><Info size={17} className="mt-0.5 shrink-0"/><span>{pace.paceDifference > 0 ? `Gasto ${money(pace.paceDifference)} acima` : `Gasto ${money(Math.abs(pace.paceDifference))} abaixo`} do ritmo linear do limite. Compras concentradas no começo do mês podem distorcer a comparação.</span></div>}
        </>}
      </section>
      <section className={shell}>
        <div className="flex items-center gap-2"><TrendingUp size={18} className="text-violet-500"/><h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Tendência com cautela</h2></div>
        <div className="mt-3 grid grid-cols-2 gap-2">{card('Média diária observada',money(average),'Até hoje, não é projeção')}{card('Estimativa do mês',money(pace.projectedExpense),pace.confidence==='insufficient'?'Amostra insuficiente para estimar':'Extrapolação simples, sujeita a variação')}</div>
        <p className="mt-3 text-[11px] leading-5 text-slate-500 dark:text-slate-400">A extrapolação só aparece com pelo menos 7 dias e 5 gastos. Não antecipa receitas, não prevê saldo e não substitui a Agenda Financeira.</p>
      </section>
      <section className={shell}>
        <div className="mb-2 flex items-center gap-2"><Landmark size={18} className="text-teal-500"/><h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Onde o gasto se concentra</h2></div>
        {pace.topCategories.length===0 ? <p className="py-5 text-center text-[12px] text-slate-500">Sem despesas realizadas neste mês.</p> : <div className="space-y-3">{pace.topCategories.map((item)=> <button key={item.id} type="button" onClick={()=>router.push('/transactions')} className="block w-full rounded-2xl bg-slate-50 p-3 text-left dark:bg-slate-900/50"><div className="mb-2 flex justify-between gap-2"><span className="min-w-0 truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100">{item.name}</span><span className="text-[12px] font-bold tabular-nums text-slate-800 dark:text-slate-100">{money(item.amount)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-teal-500" style={{width:`${Math.min(100,item.share)}%`}} /></div><p className="mt-1.5 text-[10px] text-slate-400">{item.count} lançamentos · {item.share.toLocaleString('pt-BR')}% das despesas</p></button>)}</div>}
      </section>
      <button type="button" onClick={()=>router.push('/planning')} className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-violet-200 bg-violet-50 px-4 text-[12px] font-bold text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/20 dark:text-violet-300"><span>Planejamento: gastos fixos, flexíveis e reservas</span><span>→</span></button>
      <section className={shell}>
        <div className="flex items-start gap-2"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-teal-500"/><div><h2 className="text-[13px] font-bold text-slate-900 dark:text-white">Números com explicação</h2><p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">Compras no cartão entram como gasto na data da compra, e não novamente no pagamento da fatura. Transferências, metas, empréstimos, cobranças e parcelas de financiamento não entram no ritmo de despesas. Valores pendentes comuns não entram até a realização.</p></div></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={()=>router.push('/review')} className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"><CheckCircle2 size={15}/> Revisão</button><button type="button" onClick={()=>router.push('/agenda')} className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"><CalendarDays size={15}/> Agenda</button></div>
      </section>
    </main>
  )
}
