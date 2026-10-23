'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, BrainCircuit, Check, CircleHelp, Landmark, Settings2, ShieldCheck, Sparkles } from 'lucide-react'
import BankLogo from '@/components/BankLogo'
import NotificationPreferencesCard from '@/components/NotificationPreferencesCard'
import { useContext_ } from '@/components/ContextToggle'
import { useAccountsList } from '@/hooks/useAccountsList'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useToast } from '@/contexts/ToastContext'
import { defaultAccountPatch, validDefaultAccountId, type AccountContext } from '@/lib/defaultAccount'

const surface = 'rounded-[22px] border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-800/90'

export default function FinanceSettingsPage() {
  const router = useRouter()
  const { appMode } = useContext_()
  const { settings, loading, updateSettings } = useUserSettings()
  const { data: companyAccounts } = useAccountsList('dfl')
  const { data: personalAccounts } = useAccountsList('personal')
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const defaults = settings?.preferences.default_accounts

  const chooseAccount = async (context: AccountContext, id: string) => {
    if (!settings || saving) return
    setSaving(true)
    try {
      const result = await updateSettings({ preferences: defaultAccountPatch(settings, context, id) })
      showToast(result.synced ? 'Conta padrão atualizada.' : 'Preferência salva neste aparelho; aguardando sincronização.', result.synced ? 'success' : 'info')
    } catch {
      showToast('Não foi possível salvar essa preferência.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleOption = async (key: 'ai_enabled' | 'auto_categorize') => {
    if (!settings || saving) return
    setSaving(true)
    try {
      const result = await updateSettings({ preferences: { [key]: settings.preferences[key] !== true } })
      showToast(result.synced ? 'Preferência atualizada.' : 'Salvo no aparelho; aguardando internet.', result.synced ? 'success' : 'info')
    } catch {
      showToast('Não foi possível salvar a configuração.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const accountGroup = (context: AccountContext, title: string, list: any[]) => {
    const items = list.filter((a) => a && !a.is_archived && (a.context || context) === context)
    const valid = validDefaultAccountId(settings, context, items)
    return (
      <section key={context} className={surface}>
        <div className="mb-3 flex items-center gap-2"><Landmark size={17} className="text-teal-600 dark:text-teal-400" /><h2 className="text-[15px] font-bold text-gray-900 dark:text-white">Conta padrão · {title}</h2></div>
        <p className="mb-3 text-[11px] leading-5 text-gray-500 dark:text-gray-400">Sugestão inicial para receita e despesa. Nunca substitui a escolha manual nem movimenta saldo.</p>
        {items.length === 0 ? <button type="button" onClick={() => router.push('/accounts/new')} className="w-full rounded-[16px] border border-dashed border-gray-300 p-3 text-left text-[12px] font-semibold text-teal-600 dark:border-slate-600">Cadastrar uma conta de {title}</button> : (
          <div className="space-y-2">
            {items.map((a) => <button key={a.id} type="button" disabled={saving} onClick={() => chooseAccount(context, valid === a.id ? '' : a.id)} className={`flex min-h-12 w-full items-center gap-3 rounded-[16px] border px-3 py-2 text-left transition active:scale-[0.99] disabled:opacity-60 ${a.id === valid ? 'border-teal-500/40 bg-teal-50 dark:bg-teal-500/10' : 'border-gray-100 bg-gray-50 dark:border-slate-700 dark:bg-slate-900'}`}>
              <BankLogo name={a.bank || a.name} color={a.color} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-gray-800 dark:text-gray-100">{a.name}</span>
              {a.id === valid && <><span className="text-[10px] font-bold text-teal-700 dark:text-teal-300">Padrão</span><Check size={16} className="text-teal-600" /></>}
            </button>)}
          </div>
        )}
        {Boolean(defaults?.[context]) && !valid && <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">A conta configurada não está ativa neste contexto. Escolha uma conta disponível.</p>}
      </section>
    )
  }

  return (
    <main className="mx-auto min-h-[100dvh] max-w-2xl bg-gray-50 px-4 pb-32 pt-3 dark:bg-slate-900">
      <header className="sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-3 border-b border-gray-200/70 bg-gray-50/95 px-4 py-3 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95">
        <button type="button" onClick={() => router.push('/more')} className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white text-gray-600 dark:bg-slate-800 dark:text-gray-200" aria-label="Voltar"><ArrowLeft size={19}/></button>
        <div><p className="text-[11px] font-medium text-gray-400">Seu Finance, seu jeito</p><h1 className="text-[18px] font-bold text-gray-900 dark:text-white">Central de Configurações</h1></div>
      </header>
      {loading && <p role="status" className="mb-3 text-[12px] text-gray-400">Carregando suas preferências…</p>}
      <div className="space-y-4">
        <section className={surface}>
          <div className="mb-2 flex items-center gap-2"><Settings2 size={18} className="text-teal-500" /><h2 className="text-[15px] font-bold text-gray-900 dark:text-white">Preferências financeiras</h2></div>
          <p className="text-[12px] leading-5 text-gray-500 dark:text-gray-400">Uma conta padrão por contexto. O cadastro, a edição e os detalhes da conta também permitem definir a preferência.</p>
        </section>
        {appMode !== 'personal_only' && accountGroup('dfl', 'Empresa', companyAccounts || [])}
        {accountGroup('personal', 'Pessoal', personalAccounts || [])}
        <section className={surface}>
          <div className="mb-3 flex items-center gap-2"><BrainCircuit size={18} className="text-violet-500" /><h2 className="text-[15px] font-bold text-gray-900 dark:text-white">Inteligência financeira</h2></div>
          {([
            { key: 'ai_enabled' as const, title: 'Chat inteligente', detail: 'Permite consultar o Gemini com os dados financeiros estruturados.' },
            { key: 'auto_categorize' as const, title: 'Sugestões automáticas', detail: 'Ativa sugestões de organização quando o fluxo oferecer suporte.' },
          ]).map((item) => <div key={item.key} className="flex items-center justify-between gap-3 border-t border-gray-100 py-3 first:border-0 dark:border-slate-700/70">
            <div className="min-w-0"><p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{item.title}</p><p className="mt-1 text-[11px] leading-4 text-gray-500 dark:text-gray-400">{item.detail}</p></div>
            <button type="button" role="switch" aria-checked={settings?.preferences[item.key] === true} aria-label={item.title} disabled={!settings || saving} onClick={() => toggleOption(item.key)} className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${settings?.preferences[item.key] ? 'bg-teal-600' : 'bg-gray-300 dark:bg-slate-600'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${settings?.preferences[item.key] ? 'left-6' : 'left-1'}`}/></button>
          </div>)}
          <button type="button" onClick={() => router.push('/assistant/settings')} className="mt-2 flex w-full items-center justify-between rounded-[14px] bg-violet-50 px-3 py-3 text-[12px] font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"><span className="flex items-center gap-2"><Sparkles size={15}/> Mais opções de inteligência</span><CircleHelp size={16}/></button>
        </section>
        <section className={surface}>
          <div className="mb-2 flex items-center gap-2"><Bell size={18} className="text-amber-500" /><h2 className="text-[15px] font-bold text-gray-900 dark:text-white">Notificações personalizadas</h2></div>
          <p className="text-[12px] leading-5 text-gray-500 dark:text-gray-400">Ative os tipos de alerta, ajuste dias de antecedência e horário. O sistema respeita a permissão do Android.</p>
        </section>
        <NotificationPreferencesCard />
        <section className={surface}>
          <div className="flex items-start gap-3"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-teal-600" /><div><h2 className="text-[13px] font-semibold text-gray-900 dark:text-white">Dados preservados</h2><p className="mt-1 text-[11px] leading-5 text-gray-500 dark:text-gray-400">Preferências não alteram saldos, contratos ou transações existentes. Alterações são salvas localmente e sincronizadas quando possível.</p></div></div>
        </section>
      </div>
    </main>
  )
}
