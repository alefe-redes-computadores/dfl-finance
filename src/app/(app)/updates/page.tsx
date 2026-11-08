'use client'

import { useCallback, useEffect, useState } from 'react'
import { Browser } from '@capacitor/browser'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Download, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import { useApkUpdate } from '@/hooks/useApkUpdate'
import { APK_ACTIONS_URL, formatApkExpiry } from '@/lib/mobileUpdatePolicy'
import { fetchApkWorkflowHealth } from '@/lib/mobileUpdateService'
import type { WorkflowHealth } from '@/lib/apkWorkflowDiagnostics'

export default function AppUpdatesPage() {
  const router = useRouter()
  const { android, installedBuild, latest, state, refresh, updateAvailable } = useApkUpdate(true)
  const [workflow, setWorkflow] = useState<WorkflowHealth | null>(null)
  const [workflowError, setWorkflowError] = useState(false)
  const checkWorkflow = useCallback(async (force = false) => {
    try {
      const result = await fetchApkWorkflowHealth(force)
      setWorkflow(result)
      setWorkflowError(false)
    } catch { setWorkflowError(true) }
  }, [])
  useEffect(() => { void checkWorkflow() }, [checkWorkflow])
  const url = latest?.pageUrl || APK_ACTIONS_URL
  const open = () => {
    if (android) void Browser.open({ url })
    else window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 pb-28 pt-5">
      <header className="flex items-center gap-3">
        <button type="button" onClick={() => router.push('/more')} aria-label="Voltar"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
          <ArrowLeft size={19} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-bold text-slate-900 dark:text-slate-50">Atualizações do Finance</h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">APK Android e versão do PWA</p>
        </div>
      </header>

      <section className="rounded-[25px] border border-teal-500/20 bg-gradient-to-br from-teal-50 to-white p-4 dark:border-teal-500/20 dark:from-teal-950/40 dark:to-slate-800">
        <div className="mb-3 flex items-center gap-2 text-teal-700 dark:text-teal-300">
          <Smartphone size={19}/><h2 className="text-[14px] font-bold">Versão instalada</h2>
        </div>
        <p className="text-[23px] font-black tabular-nums text-slate-900 dark:text-slate-50">
          {android === null ? 'Verificando…' : android ? (installedBuild !== null ? `APK #${installedBuild}` : 'APK não identificado') : 'PWA / navegador'}
        </p>
        <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
          {android ? 'Versão nativa consultada diretamente no Android.' : 'O PWA recebe os arquivos web por atualização do site; ele não possui versionCode de APK.'}
        </p>
      </section>

      <section className="space-y-3 rounded-[25px] border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[14px] font-bold text-slate-900 dark:text-slate-100">
            <Download size={18} className="text-teal-600"/> Último APK certificado
          </h2>
          <button type="button" onClick={() => { void refresh(true); void checkWorkflow(true) }} disabled={state === 'checking'}
            className="flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[11px] font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">
            <RefreshCw size={14} className={state === 'checking' ? 'animate-spin motion-reduce:animate-none' : ''}/> Verificar
          </button>
        </div>

        {state === 'checking' && <p role="status" className="text-[12px] text-slate-500">Consultando a Action e o artefato no GitHub…</p>}
        {state === 'error' && <p role="alert" className="text-[12px] text-amber-600 dark:text-amber-400">Não foi possível consultar o GitHub agora. Confira sua conexão e tente novamente.</p>}
        {state === 'ready' && !latest && <p className="text-[12px] text-slate-500">Nenhum APK válido disponível no momento. Não oferecemos Actions que falharam ou artefatos expirados.</p>}
        {latest && (
          <>
            <p className="text-[21px] font-black tabular-nums text-slate-900 dark:text-white">Build #{latest.build}</p>
            <p className="text-[12px] leading-5 text-slate-500 dark:text-slate-400">
              Download disponível até <strong className="text-slate-700 dark:text-slate-200">{formatApkExpiry(latest.expiresAt)}</strong> (Brasília).
            </p>
            {android && installedBuild !== null && (
              <p className={`flex items-center gap-2 text-[12px] font-semibold ${updateAvailable ? 'text-teal-700 dark:text-teal-300' : 'text-emerald-700 dark:text-emerald-400'}`}>
                <CheckCircle2 size={16}/>{updateAvailable ? 'Há uma versão mais nova para este dispositivo.' : 'Seu APK já tem esta versão ou uma mais recente.'}
              </p>
            )}
          </>
        )}
        <button type="button" onClick={open}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[15px] bg-teal-600 px-3 text-[12px] font-bold text-white active:scale-[0.98]">
          <Download size={17}/> Abrir GitHub Actions
        </button>
      </section>

      <section aria-label="Diagnóstico das Actions" className="space-y-2 rounded-[22px] border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-[13px] font-bold text-slate-900 dark:text-white">Última Action Android</h2>
        {workflowError && <p role="status" className="text-[11px] text-amber-600">Não foi possível consultar o histórico. Nenhuma atualização nova será anunciada por isso.</p>}
        {!workflow && !workflowError && <p className="text-[11px] text-slate-500">Verificando estado do build...</p>}
        {workflow && <>
          {workflow.kind === 'building' && <p className="text-[11px] text-slate-600 dark:text-slate-300">Build #{workflow.build} em andamento. Ainda não há APK novo aprovado.</p>}
          {workflow.kind === 'failed' && <p className="text-[11px] text-amber-700 dark:text-amber-300">O build #{workflow.build} falhou. Ele não é anunciado como atualização disponível.</p>}
          {workflow.kind === 'expired' && <p className="text-[11px] text-amber-700 dark:text-amber-300">O artefato do build #{workflow.build} expirou em {workflow.expiresAt ? formatApkExpiry(workflow.expiresAt) : 'data indisponível'}. Consulte outro APK válido.</p>}
          {workflow.kind === 'ready' && <p className="text-[11px] text-teal-700 dark:text-teal-300">Build #{workflow.build} aprovado, com artefato disponível até {workflow.expiresAt ? formatApkExpiry(workflow.expiresAt) : 'prazo não informado'}.</p>}
          {workflow.kind === 'unavailable' && <p className="text-[11px] text-slate-500">O build #{workflow.build} concluiu, mas não há um artefato APK verificável.</p>}
          {workflow.kind === 'none' && <p className="text-[11px] text-slate-500">Histórico da Action indisponível ou não reconhecido.</p>}
        </>}
        <p className="text-[10px] leading-4 text-slate-500">Falhas e builds em andamento aparecem apenas aqui, sem alertas de versão nova. A disponibilidade do APK é verificada separadamente.</p>
      </section>

      <section className="flex gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-[11px] leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
        <ShieldCheck size={19} className="mt-0.5 shrink-0 text-teal-600"/>
        <p>O Finance só avisa sobre APKs de Actions aprovadas e ainda disponíveis. O download do artefato requer estar conectado ao GitHub. A instalação é manual e depende da confirmação do Android; nenhum dado financeiro é enviado ao GitHub por esta consulta.</p>
      </section>
    </main>
  )
}
