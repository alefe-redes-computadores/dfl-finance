'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Download, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import { useApkUpdate } from '@/hooks/useApkUpdate'
import { APK_ACTIONS_URL, formatApkExpiry } from '@/lib/mobileUpdatePolicy'
import { FINANCE_RELEASE_NOTES } from '@/lib/financeReleaseNotes'
import { getNativeApkUpdater } from '@/lib/nativeApkUpdater'
import type { ApkRelease } from '@/lib/mobileUpdatePolicy'
import { fetchApkWorkflowHealth } from '@/lib/mobileUpdateService'
import type { WorkflowHealth } from '@/lib/apkWorkflowDiagnostics'

export default function AppUpdatesPage() {
  const router = useRouter()
  const { android, installedBuild, latest, state, refresh, updateAvailable } = useApkUpdate(true)
  const [workflow, setWorkflow] = useState<WorkflowHealth | null>(null)
  const [workflowError, setWorkflowError] = useState(false)
  const [nativePhase, setNativePhase] = useState<'idle' | 'downloading' | 'verified' | 'installing' | 'permission' | 'error'>('idle')
  const [downloadPercent, setDownloadPercent] = useState(0)
  const [nativeError, setNativeError] = useState('')
  // Somente a volta da tela de autorizacao pode retomar a instalacao.
  const permissionReturnRef = useRef<ApkRelease | null>(null)
  const installBusyRef = useRef(false)
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

  const installNow = useCallback(async (release: ApkRelease) => {
    const native = getNativeApkUpdater()
    if (!native || !release.direct || installBusyRef.current) return
    installBusyRef.current = true
    permissionReturnRef.current = null
    setNativeError('')
    setNativePhase('installing')
    try {
      // A ponte nativa revalida SHA-256, versao, pacote e assinatura em TODA tentativa.
      const result = await native.installVerified({ build: release.build, sha256: release.direct.sha256 })
      if (result.permissionRequired) { setNativePhase('permission'); return }
      if (!result.opened) throw new Error('O Android não abriu a instalação.')
      setNativePhase('verified') // O sistema ainda pede confirmacao; nao instala silenciosamente.
    } catch (error) {
      setNativePhase('error')
      setNativeError(error instanceof Error ? error.message : 'Não foi possível abrir a instalação.')
    } finally {
      installBusyRef.current = false
    }
  }, [])

  const downloadAndInstall = async () => {
    const release = latest
    const native = getNativeApkUpdater()
    if (!android || !native || !release?.direct || !updateAvailable || !['idle', 'error'].includes(nativePhase)) return
    setNativePhase('downloading')
    setNativeError('')
    setDownloadPercent(0)
    let handler: Awaited<ReturnType<typeof native.addListener>> | null = null
    try {
      handler = await native.addListener('downloadProgress', value => {
        if (value.build === release.build) setDownloadPercent(Math.min(100, Math.max(0, value.percent)))
      })
      const result = await native.downloadVerified({ build: release.build, sha256: release.direct.sha256, bytes: release.direct.bytes })
      if (!result.verified || result.build !== release.build) throw new Error('Arquivo não verificado pelo Android.')
      setDownloadPercent(100)
      setNativePhase('verified')
      await installNow(release)
    } catch (error) {
      setNativePhase('error')
      setNativeError(error instanceof Error ? error.message : 'Download não concluído.')
    } finally { if (handler) await handler.remove().catch(() => undefined) }
  }

  const openInstallSettings = async () => {
    const native = getNativeApkUpdater()
    if (!native || !latest?.direct || nativePhase !== 'permission') return
    // Guardar a release verificada antes que o Android suspenda a Activity.
    permissionReturnRef.current = latest
    try { await native.openInstallSettings() }
    catch {
      permissionReturnRef.current = null
      setNativeError('Não foi possível abrir as configurações do Android.')
      setNativePhase('error')
    }
  }

  useEffect(() => {
    if (android !== true) return
    let cancelled = false
    let subscription: { remove: () => Promise<void> } | undefined
    const resumeFromAndroid = () => {
      if (document.visibilityState !== 'visible') return
      const pending = permissionReturnRef.current
      if (!pending) return
      // Consumir o retorno ANTES da chamada assíncrona evita dois instaladores.
      permissionReturnRef.current = null
      void installNow(pending)
    }
    const onVisible = () => { if (document.visibilityState === 'visible') resumeFromAndroid() }
    // Alguns Androids emitem appStateChange antes de visibilitychange: ouvir os dois.
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) resumeFromAndroid()
    }).then(handle => {
      if (cancelled) void handle.remove()
      else subscription = handle
    }).catch(() => { /* visibilitychange continua como fallback */ })
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      permissionReturnRef.current = null
      document.removeEventListener('visibilitychange', onVisible)
      if (subscription) void subscription.remove()
    }
  }, [android, installNow])

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
              {latest.expiresAt ? <>Download disponível até <strong className="text-slate-700 dark:text-slate-200">{formatApkExpiry(latest.expiresAt)}</strong> (Brasília).</> : 'APK direto publicado no canal de versões, sem expiração de artefato temporário.'}
            </p>
            {android && installedBuild !== null && (
              <p className={`flex items-center gap-2 text-[12px] font-semibold ${updateAvailable ? 'text-teal-700 dark:text-teal-300' : 'text-emerald-700 dark:text-emerald-400'}`}>
                <CheckCircle2 size={16}/>{updateAvailable ? 'Há uma versão mais nova para este dispositivo.' : 'Seu APK já tem esta versão ou uma mais recente.'}
              </p>
            )}
          </>
        )}
        {android && latest?.direct && updateAvailable && <div className="space-y-2">
          {nativePhase === 'downloading' && <div role="status" aria-live="polite" className="space-y-1.5">
            <p className="text-[12px] font-semibold text-teal-700 dark:text-teal-300">Baixando APK com segurança… {downloadPercent}%</p>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full rounded-full bg-teal-600 transition-[width]" style={{ width: `${downloadPercent}%` }} />
            </div>
          </div>}
          {nativePhase === 'installing' && <p role="status" aria-live="polite" className="rounded-xl bg-teal-500/10 p-3 text-[12px] font-semibold text-teal-800 dark:text-teal-200">Conferindo o APK e abrindo o instalador do Android…</p>}
          {nativePhase === 'permission' && <div role="status" className="space-y-2 rounded-2xl bg-amber-50 p-3 text-[12px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold">O APK está pronto e verificado.</p>
            <p>Autorize o Finance nas configurações do Android. Ao voltar, continuaremos a instalação automaticamente.</p>
            <button type="button" onClick={() => void openInstallSettings()} className="min-h-12 w-full rounded-xl bg-amber-600 px-3 font-bold text-white active:scale-[0.98]">Abrir permissões do Android</button>
            <button type="button" onClick={() => void installNow(latest)} className="min-h-10 w-full text-[11px] font-semibold underline underline-offset-4">Já autorizei, mas não continuou? Tentar instalar</button>
          </div>}
          {nativePhase === 'verified' && <div role="status" className="space-y-2 rounded-2xl bg-emerald-500/10 p-3 text-[12px] text-emerald-800 dark:text-emerald-200">
            <p className="font-semibold">Instalador do Android solicitado.</p>
            <p>Confirme a atualização na tela do sistema. Se não apareceu, use a opção abaixo.</p>
            <button type="button" onClick={() => void installNow(latest)} className="min-h-11 w-full rounded-xl border border-emerald-600/40 font-bold">Abrir instalador novamente</button>
          </div>}
          {nativePhase === 'error' && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-[12px] text-rose-600 dark:text-rose-300">{nativeError || 'Falha ao preparar a atualização.'} A página da versão continua disponível como alternativa.</p>}
          {nativePhase === 'error' && downloadPercent === 100 && <button type="button" onClick={() => void installNow(latest)} className="min-h-11 w-full rounded-xl border border-teal-600/40 text-[12px] font-bold text-teal-700 dark:text-teal-300">Tentar abrir o instalador novamente</button>}
          {(nativePhase === 'idle' || (nativePhase === 'error' && downloadPercent < 100)) && <button type="button" onClick={() => void downloadAndInstall()}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[15px] bg-teal-600 px-3 text-[12px] font-bold text-white active:scale-[0.98]">
            <Download size={17}/>{nativePhase === 'error' ? 'Tentar baixar novamente' : 'Baixar e atualizar no aplicativo'}
          </button>}
        </div>}
        {!android && latest?.direct && <button type="button" onClick={open}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[15px] bg-teal-600 px-3 text-[12px] font-bold text-white">Ver APK no GitHub Releases</button>}
        {android && !latest?.direct && <p className="text-[11px] leading-4 text-slate-500">Esta versão utiliza o download legado. O atualizador nativo funcionará após instalar o primeiro APK compatível com a R464.</p>}
        <button type="button" onClick={() => { if (android) void Browser.open({ url: APK_ACTIONS_URL }); else window.open(APK_ACTIONS_URL, '_blank', 'noopener,noreferrer') }}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[15px] border border-slate-200 px-3 text-[12px] font-bold text-slate-600 active:scale-[0.98] dark:border-slate-700 dark:text-slate-300">
          Abrir GitHub Actions
        </button>
        {latest?.direct && <button type="button" onClick={open} className="w-full py-1 text-[11px] font-semibold text-slate-500 underline dark:text-slate-400">Alternativa: página de download da versão</button>}
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

      <section aria-label="Novidades recentes do Finance" className="space-y-3 rounded-[23px] border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div>
          <h2 className="text-[14px] font-black text-slate-900 dark:text-white">O que mudou no Finance</h2>
          <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">Histórico das melhorias recentes. O build instalado e o último APK disponível são exibidos acima.</p>
        </div>
        {FINANCE_RELEASE_NOTES.map((entry, index) => (
          <details key={entry.version} open={index === 0} className="rounded-[16px] border border-slate-200/80 bg-slate-50/60 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/60">
            <summary className="cursor-pointer list-none text-[12px] font-bold text-slate-900 dark:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500">
              <span className="font-black text-teal-700 dark:text-teal-300">{entry.version}</span> · {entry.title}
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
              {entry.changes.map(change => <li key={change}>{change}</li>)}
            </ul>
          </details>
        ))}
      </section>

      <section className="flex gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-[11px] leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
        <ShieldCheck size={19} className="mt-0.5 shrink-0 text-teal-600"/>
        <p>O Finance só oferece APK da Action aprovada e de release com SHA-256 correspondente. O download nativo usa a pasta privada do aplicativo e o instalador oficial do Android, que sempre exige sua confirmação. A versão atual precisa possuir a ponte R464; nenhuma informação financeira é enviada ao GitHub.</p>
      </section>
    </main>
  )
}
