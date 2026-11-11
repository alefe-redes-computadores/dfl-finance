'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import {
  ArrowLeft, ArrowUpRight, BellRing, Building2, CalendarClock, Check,
  ChevronRight, CircleAlert, ClipboardCheck, FileText, Landmark, RefreshCw,
  Save, ShieldCheck, Wallet,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { formatCnpj } from '@/lib/commercialIdentity'
import {
  defaultTaxProfile, dasDisplayStatus, estimatedDasDue,
  estimatedDasnDue, normalizeCommercialTaxProfiles, OFFICIAL_DAS_URL,
  OFFICIAL_DASN_URL, validCompetence, visibleDasCompetences,
  type TaxRegime, type CommercialTaxProfile,
} from '@/lib/meiObligations'

type Organization = { id: string; name: string; legal_name: string | null; tax_id: string | null }
const regimes: { key: TaxRegime; title: string; hint: string }[] = [
  { key: 'mei', title: 'MEI', hint: 'Microempreendedor Individual' },
  { key: 'simples', title: 'Simples Nacional', hint: 'Não MEI' },
  { key: 'presumido', title: 'Lucro Presumido', hint: 'Empresa comum' },
  { key: 'real', title: 'Lucro Real', hint: 'Empresa comum' },
  { key: 'other', title: 'Outro', hint: 'Outro enquadramento' },
  { key: 'unknown', title: 'Não informado', hint: 'Nenhum prazo fiscal gerado' },
]
const panel = 'rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-800'
const formatMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
const formatDate = (value: string) => {
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

export default function CommercialMeiPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { settings, loading: settingsLoading, updateSettings } = useUserSettings()
  const { showToast } = useToast()
  const haptic = useHapticFeedback()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [regimeDraft, setRegimeDraft] = useState<TaxRegime>('unknown')
  const [startDraft, setStartDraft] = useState('')

  const refresh = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    setLoading(true)
    setLoadError('')
    try {
      const { data, error } = await supabase.from('dfl_commercial_organizations')
        .select('id,name,legal_name,tax_id').eq('owner_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data || []) as Organization[]
      setOrganizations(rows)
      setSelectedId(current => rows.some(item => item.id === current) ? current : rows[0]?.id || '')
    } catch {
      setLoadError('Não foi possível consultar organizações. Verifique a conexão.')
    } finally { setLoading(false) }
  }, [user?.id])
  useEffect(() => { void refresh() }, [refresh])

  const profiles = useMemo(() => normalizeCommercialTaxProfiles(settings?.preferences.commercial_tax_profiles),
    [settings?.preferences.commercial_tax_profiles])
  const selected = organizations.find(item => item.id === selectedId)
  const profile: CommercialTaxProfile = profiles[selectedId] || defaultTaxProfile()
  useEffect(() => {
    setRegimeDraft(profile.regime)
    setStartDraft(profile.startCompetence)
  }, [selectedId, profile.regime, profile.startCompetence])

  const saveProfiles = async (next: CommercialTaxProfile, message: string) => {
    if (!selectedId || !settings || busy) return
    setBusy(true)
    try {
      const result = await updateSettings({ preferences: {
        commercial_tax_profiles: { ...profiles, [selectedId]: next },
      } })
      haptic.success()
      showToast(result.synced ? message : `${message} Sincronização pendente neste aparelho.`, result.synced ? 'success' : 'info')
    } catch {
      haptic.error()
      showToast('Não foi possível salvar seu controle fiscal.', 'error')
    } finally { setBusy(false) }
  }
  const saveClassification = () => {
    if (regimeDraft === 'mei' && !validCompetence(startDraft)) {
      showToast('Informe a primeira competência MEI no formato AAAA-MM.', 'warning'); return
    }
    void saveProfiles({
      ...profile, regime: regimeDraft,
      startCompetence: regimeDraft === 'mei' ? startDraft : profile.startCompetence,
    }, 'Enquadramento registrado no Finance.')
  }
  const toggleDas = (month: string) => {
    const paid = { ...profile.manuallyConfirmedDas }
    if (paid[month]) delete paid[month]
    else paid[month] = new Date().toISOString()
    void saveProfiles({ ...profile, manuallyConfirmedDas: paid },
      paid[month] ? 'Pagamento informado por você.' : 'Confirmação manual desfeita.')
  }
  const toggleAnnual = (year: string) => {
    const sent = { ...profile.manuallySubmittedDasn }
    if (sent[year]) delete sent[year]
    else sent[year] = new Date().toISOString()
    void saveProfiles({ ...profile, manuallySubmittedDasn: sent },
      sent[year] ? 'Entrega da declaração registrada manualmente.' : 'Registro da declaração desfeito.')
  }
  const openOfficial = async (url: string) => {
    haptic.light()
    try {
      if (Capacitor.isNativePlatform()) await Browser.open({ url })
      else window.open(url, '_blank', 'noopener,noreferrer')
    } catch { showToast('Não foi possível abrir o portal oficial.', 'error') }
  }
  const months = visibleDasCompetences(profile)
  const currentYear = new Date().getFullYear()
  const declarationYear = currentYear - 1
  const showAnnual = profile.regime === 'mei' && validCompetence(profile.startCompetence) &&
    Number(profile.startCompetence.slice(0, 4)) <= declarationYear
  const alertEnabled = settings?.preferences.push_notifications === true &&
    settings?.preferences.notification_categories?.taxes === true

  return (
    <main className="mx-auto max-w-2xl space-y-3.5 px-4 pb-32 pt-4 text-slate-900 dark:text-slate-100">
      <header className="flex items-center gap-3 pb-1">
        <button type="button" onClick={() => router.push('/commercial')} aria-label="Voltar à gestão comercial"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800"><ArrowLeft size={19}/></button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-300">DFL Finance · Gestão comercial</p>
          <h1 className="text-[19px] font-black tracking-tight">Obrigações do negócio</h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Enquadramento e controle assistido de DAS MEI</p>
        </div>
        <Landmark size={23} className="text-teal-600" />
      </header>

      <section className={`${panel} space-y-2`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[14px] font-bold"><Building2 size={17} className="text-teal-600"/> Organização</h2>
          <button onClick={() => void refresh()} type="button" aria-label="Atualizar organizações" className="rounded-xl p-2 text-slate-500"><RefreshCw size={17}/></button>
        </div>
        {loading && <p className="text-xs text-slate-500">Conferindo empresas cadastradas…</p>}
        {loadError && <p role="alert" className="text-xs text-rose-600">{loadError}</p>}
        {!loading && !loadError && organizations.length === 0 && <div className="space-y-2">
          <p className="text-xs text-slate-500">Cadastre primeiro uma organização com CNPJ na Gestão Comercial.</p>
          <button type="button" onClick={() => router.push('/commercial')} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-xs font-bold text-white">Cadastrar organização <ChevronRight size={15}/></button>
        </div>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {organizations.map(organization => <button key={organization.id} type="button"
            aria-pressed={organization.id === selectedId} onClick={() => setSelectedId(organization.id)}
            className={`min-h-14 rounded-[16px] border p-3 text-left transition active:scale-[0.99] ${organization.id === selectedId
              ? 'border-teal-500 bg-teal-500/10' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60'}`}>
            <span className="block truncate text-[12px] font-bold">{organization.name}</span>
            <span className="block font-mono text-[10px] text-slate-500">{organization.tax_id ? formatCnpj(organization.tax_id) : 'Sem CNPJ cadastrado'}</span>
          </button>)}
        </div>
      </section>

      {selected && <>
        <section className={`${panel} space-y-3`}>
          <div>
            <h2 className="text-[14px] font-bold">Tipo de enquadramento</h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">Informe o regime que você conhece. O CNPJ não revela automaticamente se a empresa é MEI; confirme no portal oficial.</p>
          </div>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Enquadramento tributário">
            {regimes.map(item => <button type="button" key={item.key} aria-pressed={regimeDraft === item.key}
              disabled={busy || settingsLoading} onClick={() => { haptic.light(); setRegimeDraft(item.key) }}
              className={`min-h-16 rounded-[15px] border p-2.5 text-left transition active:scale-[0.98] ${regimeDraft === item.key
                ? 'border-teal-500 bg-teal-500/10 text-teal-800 dark:text-teal-300'
                : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60'}`}>
              <span className="flex items-center justify-between gap-1 text-[12px] font-bold">{item.title}{regimeDraft === item.key && <Check size={14}/>}</span>
              <span className="mt-1 block text-[10px] leading-4 text-slate-500 dark:text-slate-400">{item.hint}</span>
            </button>)}
          </div>
          {regimeDraft === 'mei' && <label className="block space-y-1.5">
            <span className="block text-[11px] font-bold">Primeira competência como MEI</span>
            <input type="text" inputMode="numeric" maxLength={7} value={startDraft}
              placeholder="2026-11" aria-label="Competência inicial no formato AAAA-MM"
              onChange={e => setStartDraft(e.target.value.replace(/[^0-9-]/g, '').slice(0, 7))}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900" />
            <span className="block text-[10px] leading-4 text-slate-500">Não vamos presumir dívidas antes dessa competência. Confirme a data em seu cadastro oficial.</span>
          </label>}
          <button type="button" disabled={!settings || busy || settingsLoading} onClick={saveClassification}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[15px] bg-teal-600 text-[12px] font-bold text-white disabled:opacity-50"><Save size={16}/>{busy ? 'Salvando…' : 'Salvar enquadramento'}</button>
        </section>

        {profile.regime === 'mei' && <>
          <section className="flex gap-3 rounded-[20px] border border-amber-400/25 bg-amber-500/5 p-3.5 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
            <CircleAlert size={19} className="mt-0.5 shrink-0 text-amber-600"/>
            <p>Este painel é um <strong>controle particular</strong>, não uma consulta à Receita. “Sem confirmação” não significa dívida oficial. A data é estimada: feriados bancários podem alterar o vencimento. Confira sempre a guia emitida no PGMEI.</p>
          </section>
          <section className={`${panel} space-y-3`}>
            <div className="flex items-center justify-between gap-2">
              <div><h2 className="flex items-center gap-2 text-[14px] font-bold"><Wallet size={17} className="text-teal-600"/> DAS mensal</h2>
                <p className="mt-1 text-[11px] text-slate-500">Competência do mês → vencimento no mês seguinte.</p></div>
              <button type="button" onClick={() => void openOfficial(OFFICIAL_DAS_URL)}
                className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-teal-600 px-3 text-[11px] font-bold text-white">Emitir no PGMEI <ArrowUpRight size={13}/></button>
            </div>
            {months.length === 0 && <p className="text-xs text-slate-500">Salve uma competência inicial válida para começar o acompanhamento.</p>}
            <div className="space-y-2">
              {months.map(month => {
                const due = estimatedDasDue(month)
                const status = dasDisplayStatus(profile, month)
                const confirmed = status === 'confirmed-manually'
                return <article key={month} className="flex min-h-18 items-center gap-3 rounded-[16px] border border-slate-200 p-3 dark:border-slate-700">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${confirmed ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                    {confirmed ? <ClipboardCheck size={18}/> : <CalendarClock size={18}/>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold capitalize">{formatMonth(month)}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Previsão: {due ? formatDate(due) : '—'}</p>
                    <p className={`mt-0.5 text-[10px] font-semibold ${confirmed ? 'text-emerald-600' : status === 'date-passed-unconfirmed' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500'}`}>
                      {confirmed ? 'Pagamento informado por você' : status === 'date-passed-unconfirmed' ? 'Data passou · pagamento não confirmado aqui' : status === 'today' ? 'Previsão para hoje' : 'Aguardando confirmação no Finance'}
                    </p>
                  </div>
                  <button type="button" disabled={busy || settingsLoading} onClick={() => toggleDas(month)}
                    className={`min-h-10 shrink-0 rounded-xl border px-2.5 text-[10px] font-bold disabled:opacity-40 ${confirmed ? 'border-emerald-500/30 text-emerald-600' : 'border-teal-500/40 text-teal-700 dark:text-teal-300'}`}>{confirmed ? 'Desfazer' : 'Paguei'}</button>
                </article>
              })}
            </div>
          </section>
          {showAnnual && <section className={`${panel} space-y-2`}>
            <h2 className="flex items-center gap-2 text-[14px] font-bold"><FileText size={17} className="text-teal-600"/> Declaração anual DASN-SIMEI</h2>
            <p className="text-[11px] leading-5 text-slate-500">Ano-calendário {declarationYear} · prazo de referência: {formatDate(estimatedDasnDue(declarationYear) || '')}. Consulte regras e exceções no site oficial.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void openOfficial(OFFICIAL_DASN_URL)}
                className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-teal-600 px-2 text-[11px] font-bold text-white">Declarar no portal <ArrowUpRight size={13}/></button>
              <button type="button" disabled={busy} onClick={() => toggleAnnual(String(declarationYear))}
                className="min-h-11 rounded-xl border border-teal-500/30 px-2 text-[11px] font-bold text-teal-700 dark:text-teal-300">{profile.manuallySubmittedDasn[String(declarationYear)] ? 'Desfazer registro' : 'Já enviei'}</button>
            </div>
            {profile.manuallySubmittedDasn[String(declarationYear)] && <p className="text-[10px] text-emerald-600">Entrega declarada manualmente no Finance; não verificada na Receita.</p>}
          </section>}
          <section className={`${panel} space-y-2`}>
            <h2 className="flex items-center gap-2 text-[14px] font-bold"><BellRing size={17} className="text-teal-600"/> Lembretes fiscais</h2>
            <p className="text-[11px] leading-5 text-slate-500">{alertEnabled ? 'Avisos fiscais ativados nas suas preferências.' : 'Avisos fiscais desligados ou sem autorização geral. Ative conscientemente quando desejar.'}</p>
            <button type="button" onClick={() => router.push('/notification-center')}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-teal-500/30 text-[12px] font-bold text-teal-700 dark:text-teal-300">Configurar meus lembretes <ChevronRight size={15}/></button>
          </section>
        </>}
        <section className="flex gap-3 rounded-[20px] border border-teal-500/20 bg-teal-500/5 p-3.5 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
          <ShieldCheck size={18} className="shrink-0 text-teal-600"/>
          <p>Nenhuma guia é paga ou emitida automaticamente pelo Finance. A baixa manual não modifica o saldo, não gera transação e não altera sua situação na Receita Federal.</p>
        </section>
      </>}
    </main>
  )
}
