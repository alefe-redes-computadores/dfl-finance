'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Building2, Store, Layers3, Plus,
  RefreshCw, ShieldCheck, Save,
  ImageIcon, BarChart3, Calculator, BookOpen, FlaskConical, ChevronRight, Pencil, X
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import SelectField from '@/components/SelectField'
import { cleanCnpj, formatCnpj, isValidCnpj } from '@/lib/commercialIdentity'
import { prepareOrganizationEdit, prepareStoreEdit, preparePlatformReference } from '@/lib/commercialEditPolicy'

type Organization = {
  id: string
  name: string
  legal_name: string | null
  tax_id: string | null
}

type CommercialStore = {
  id: string
  organization_id: string
  name: string
  acronym: string
  logo_url: string | null
  active: boolean
}

type CommercialPlatform = {
  id: string
  store_id: string
  display_name: string
  provider_key: string
  mode: string
  external_merchant_ref: string | null
}

const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white'

const buttonClass =
  'flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition active:scale-[.98] disabled:opacity-50'

const panelClass =
  'space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900'

function getAcronym(name: string): string {
  const normalized = name.trim().toLocaleLowerCase('pt-BR')

  if (normalized === 'da família lanches' ||
      normalized === 'da familia lanches') return 'DFL'

  if (normalized === 'da família lanches premium' ||
      normalized === 'da familia lanches premium') return 'DFLP'

  return name.trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 12) || 'LOJA'
}

function validLogo(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' &&
      !parsed.username && !parsed.password &&
      url.length <= 500
  } catch {
    return false
  }
}

function StoreIdentity({ store }: { store: CommercialStore }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-teal-500/10 text-xs font-black text-teal-600 dark:text-teal-300">
      {store.logo_url && validLogo(store.logo_url) && !failed ? (
                <img
          src={store.logo_url}
          alt={`Logotipo ${store.name}`}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{store.acronym || getAcronym(store.name)}</span>
      )}
    </div>
  )
}

export default function CommercialPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const haptic = useHapticFeedback()

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [stores, setStores] = useState<CommercialStore[]>([])
  const [platforms, setPlatforms] = useState<CommercialPlatform[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'stores' | 'platforms'>('stores')

  const [organizationName, setOrganizationName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [showOrganizationForm, setShowOrganizationForm] = useState(false)
  const [showStoreForm, setShowStoreForm] = useState(false)
  const [showPlatformForm, setShowPlatformForm] = useState(false)
  const [editingOrganizationId, setEditingOrganizationId] = useState('')
  const [editOrganizationName, setEditOrganizationName] = useState('')
  const [editLegalName, setEditLegalName] = useState('')
  const [editTaxId, setEditTaxId] = useState('')
  const [editingStoreId, setEditingStoreId] = useState('')
  const [editStoreName, setEditStoreName] = useState('')
  const [editStoreAcronym, setEditStoreAcronym] = useState('')
  const [editStoreLogo, setEditStoreLogo] = useState('')
  const [editingPlatformId, setEditingPlatformId] = useState('')
  const [editMerchantReference, setEditMerchantReference] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [storeName, setStoreName] = useState('')
  const [storeAcronym, setStoreAcronym] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [storeId, setStoreId] = useState('')
  const [provider, setProvider] = useState('ifood')
  const [customProvider, setCustomProvider] = useState('')
  const [merchantReference, setMerchantReference] = useState('')

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const [orgResult, storeResult, platformResult] =
        await Promise.all([
          supabase.from('dfl_commercial_organizations')
            .select('id,name,legal_name,tax_id')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false }),
          supabase.from('dfl_commercial_stores')
            .select('id,organization_id,name,acronym,logo_url,active')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false }),
          supabase.from('dfl_commercial_platforms')
            .select('id,store_id,display_name,provider_key,mode,external_merchant_ref')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false })
        ])

      const problem = orgResult.error ||
        storeResult.error ||
        platformResult.error

      if (problem) throw problem

      setOrganizations((orgResult.data || []) as Organization[])
      setStores((storeResult.data || []) as CommercialStore[])
      setPlatforms((platformResult.data || []) as CommercialPlatform[])
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Falha ao carregar dados',
        'error'
      )
    } finally {
      setLoading(false)
    }
  }, [user?.id, showToast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function save(operation: () => Promise<void>) {
    if (busy) return

    setBusy(true)

    try {
      await operation()
      haptic.success()
      await refresh()
    } catch (error) {
      haptic.error()
      showToast(
        error instanceof Error ? error.message : 'Não foi possível salvar',
        'error'
      )
    } finally {
      setBusy(false)
    }
  }

  function createOrganization() {
    void save(async () => {
      if (!user?.id || organizationName.trim().length < 2) {
        throw new Error('Informe o nome da organização.')
      }

      if (taxId.trim() && !isValidCnpj(taxId)) {
        throw new Error('CNPJ inválido. Confira os 14 caracteres e os dígitos verificadores.')
      }

      const result = await supabase
        .from('dfl_commercial_organizations')
        .insert({
          owner_id: user.id,
          name: organizationName.trim(),
          legal_name: legalName.trim() || null,
          tax_id: cleanCnpj(taxId) || null
        })

      if (result.error) throw result.error

      setOrganizationName('')
      setLegalName('')
      setTaxId('')
      setShowOrganizationForm(false)
      showToast('Organização cadastrada.', 'success')
    })
  }

  function createStore() {
    void save(async () => {
      if (!user?.id || !organizationId || storeName.trim().length < 2) {
        throw new Error('Selecione a organização e informe o nome da loja.')
      }

      if (!organizations.some(item => item.id === organizationId)) {
        throw new Error('Organização inválida.')
      }

      const acronym = (
        storeAcronym.trim() || getAcronym(storeName)
      ).toUpperCase()

      if (acronym.length > 12) {
        throw new Error('A sigla pode ter até 12 caracteres.')
      }

      if (logoUrl.trim() && !validLogo(logoUrl.trim())) {
        throw new Error('O logotipo precisa de uma URL HTTPS válida.')
      }

      const result = await supabase
        .from('dfl_commercial_stores')
        .insert({
          owner_id: user.id,
          organization_id: organizationId,
          name: storeName.trim(),
          acronym,
          logo_url: logoUrl.trim() || null
        })

      if (result.error) throw result.error

      setStoreName('')
      setStoreAcronym('')
      setLogoUrl('')
      setShowStoreForm(false)
      showToast('Loja cadastrada.', 'success')
    })
  }

  function createPlatform() {
    void save(async () => {
      if (!user?.id || !storeId) {
        throw new Error('Selecione uma loja.')
      }

      const store = stores.find(item => item.id === storeId)

      if (!store) throw new Error('Loja não encontrada.')

      const providerKey = provider === 'other'
        ? customProvider.trim().toLowerCase()
          .replace(/[^a-z0-9_-]/g, '-')
        : provider

      if (!/^[a-z0-9_-]{2,48}$/.test(providerKey)) {
        throw new Error('Identificador de plataforma inválido.')
      }

      const displayName = provider === 'ifood'
        ? 'iFood'
        : provider === '99food'
          ? '99Food'
          : customProvider.trim()

      const result = await supabase
        .from('dfl_commercial_platforms')
        .insert({
          owner_id: user.id,
          organization_id: store.organization_id,
          store_id: store.id,
          provider_key: providerKey,
          display_name: displayName,
          external_merchant_ref: merchantReference.trim() || null,
          mode: 'off',
          active: false
        })

      if (result.error) throw result.error

      setMerchantReference('')
      setCustomProvider('')
      setShowPlatformForm(false)
      showToast('Plataforma cadastrada em modo OFF.', 'success')
    })
  }

  function beginOrganizationEdit(item: Organization) {
    if (busy) return
    setShowOrganizationForm(false)
    setEditingOrganizationId(item.id)
    setEditOrganizationName(item.name)
    setEditLegalName(item.legal_name || '')
    setEditTaxId(formatCnpj(item.tax_id || ''))
    haptic.light()
  }

  function updateOrganization() {
    void save(async () => {
      if (!user?.id || !editingOrganizationId ||
          !organizations.some(item => item.id === editingOrganizationId)) {
        throw new Error('Organização indisponível para edição.')
      }
      const changes = prepareOrganizationEdit({ name: editOrganizationName, legalName: editLegalName, taxId: editTaxId })
      const { error } = await supabase.from('dfl_commercial_organizations')
        .update(changes)
        .eq('id', editingOrganizationId)
        .eq('owner_id', user.id)
        .select('id').single()
      if (error) throw error
      setEditingOrganizationId('')
      showToast('Organização atualizada no banco.', 'success')
    })
  }

  function beginStoreEdit(item: CommercialStore) {
    if (busy) return
    setShowStoreForm(false)
    setEditingStoreId(item.id)
    setEditStoreName(item.name)
    setEditStoreAcronym(item.acronym)
    setEditStoreLogo(item.logo_url || '')
    haptic.light()
  }

  function updateStore() {
    void save(async () => {
      if (!user?.id || !editingStoreId || !stores.some(item => item.id === editingStoreId)) {
        throw new Error('Loja indisponível para edição.')
      }
      const changes = prepareStoreEdit({ name: editStoreName, acronym: editStoreAcronym, logoUrl: editStoreLogo })
      const { error } = await supabase.from('dfl_commercial_stores')
        .update(changes)
        .eq('id', editingStoreId)
        .eq('owner_id', user.id)
        .select('id').single()
      if (error) throw error
      setEditingStoreId('')
      showToast('Loja atualizada no banco.', 'success')
    })
  }

  function beginPlatformEdit(item: CommercialPlatform) {
    if (busy) return
    setShowPlatformForm(false)
    setEditingPlatformId(item.id)
    setEditMerchantReference(item.external_merchant_ref || '')
    haptic.light()
  }

  function updatePlatformReference() {
    void save(async () => {
      if (!user?.id || !editingPlatformId || !platforms.some(item => item.id === editingPlatformId)) {
        throw new Error('Plataforma indisponível para edição.')
      }
      const changes = preparePlatformReference(editMerchantReference)
      // Não altera provider_key, store_id, organization_id, mode nem active.
      const { error } = await supabase.from('dfl_commercial_platforms')
        .update(changes)
        .eq('id', editingPlatformId)
        .eq('owner_id', user.id)
        .select('id').single()
      if (error) throw error
      setEditingPlatformId('')
      showToast('Identificador comercial salvo no banco.', 'success')
    })
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-5 px-4 pb-28 pt-5 text-slate-900 dark:text-slate-100">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => router.push('/more')}
          className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">Gestão comercial</h1>
          <p className="text-xs text-slate-500">
            Organizações, lojas e plataformas
          </p>
        </div>

        <button
          type="button"
          aria-label="Atualizar"
          onClick={() => void refresh()}
          className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800"
        >
          <RefreshCw size={19} />
        </button>
      </header>

      <section aria-label="Ferramentas comerciais" className="grid grid-cols-2 gap-2.5">
        {[
          { label: 'Central 360', hint: 'Indicadores e filtros', href: '/commercial/overview', icon: BarChart3 },
          { label: 'Simular repasses', hint: 'Taxas e cenários', href: '/commercial/simulation', icon: Calculator },
          { label: 'Ledger', hint: 'Conciliação supervisionada', href: '/commercial/ledger', icon: BookOpen },
          { label: 'Laboratório', hint: 'CSV e simulações · OFF', href: '/commercial/operation', icon: FlaskConical },
        ].map(item => (
          <button key={item.href} type="button" onClick={() => { haptic.light(); router.push(item.href) }}
            className="group min-h-28 rounded-[22px] border border-teal-500/15 bg-white p-3.5 text-left shadow-sm transition active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800/90">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <item.icon size={18} aria-hidden="true" />
              </span>
              <ChevronRight size={15} className="text-slate-400 transition-transform group-hover:translate-x-0.5" />
            </div>
            <span className="block text-[12px] font-bold text-slate-900 dark:text-white">{item.label}</span>
            <span className="mt-0.5 block text-[10px] leading-4 text-slate-500 dark:text-slate-400">{item.hint}</span>
          </button>
        ))}
      </section>

      <details className="group rounded-[20px] border border-teal-500/20 bg-teal-500/5">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
          <ShieldCheck size={19} className="shrink-0 text-teal-500" />
          <span className="min-w-0 flex-1 text-[12px] font-bold">Cadastros seguros · integrações OFF</span>
          <ChevronRight size={15} className="shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
        </summary>
        <p className="px-3.5 pb-3 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
          Cadastros administrativos disponíveis. Importações, repasses, integrações e lançamentos automáticos continuam desligados.
        </p>
      </details>

      <section className={panelClass}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold">
            <Building2 size={19} /> Organizações
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-slate-500">{organizations.length}</span>
            {organizations.length > 0 && (
              <button type="button" aria-expanded={showOrganizationForm}
                onClick={() => setShowOrganizationForm(current => !current)}
                className="flex min-h-10 items-center gap-1.5 rounded-xl bg-teal-500/10 px-3 text-[11px] font-bold text-teal-700 dark:text-teal-300">
                <Plus size={14} /> {showOrganizationForm ? 'Fechar' : 'Nova'}
              </button>
            )}
          </div>
        </div>

        {organizations.map(organization => (
          <article key={organization.id} className="overflow-hidden rounded-[20px] border border-slate-200/70 bg-gradient-to-br from-slate-50 to-teal-50/50 p-3.5 dark:border-slate-700 dark:from-slate-800 dark:to-teal-950/20">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Building2 size={20} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="break-words text-[14px] font-bold leading-5 text-slate-900 dark:text-white">{organization.name}</h3>
                {organization.legal_name && (
                  <p className="mt-0.5 break-words text-[11px] leading-4 text-slate-500 dark:text-slate-400">{organization.legal_name}</p>
                )}
                {organization.tax_id && (
                  <p className="mt-2 font-mono text-[11px] font-semibold tracking-wide text-teal-700 dark:text-teal-300">
                    CNPJ · {formatCnpj(organization.tax_id)}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700">
              <span>{stores.filter(item => item.organization_id === organization.id).length} loja(s) vinculada(s)</span>
              <button type="button" disabled={busy} onClick={() => beginOrganizationEdit(organization)}
                aria-label={`Editar organização ${organization.name}`}
                className="flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-[11px] font-bold text-teal-700 transition-colors hover:bg-teal-500/10 dark:text-teal-300">
                <Pencil size={14} /> Editar
              </button>
            </div>
            {editingOrganizationId === organization.id && (
              <div className="mt-3 space-y-3 rounded-2xl border border-teal-500/20 bg-white/80 p-3 dark:bg-slate-900/75">
                <p className="text-[12px] font-bold text-teal-700 dark:text-teal-300">Editar organização</p>
                <label className="block space-y-1"><span className="text-[11px] font-semibold">Nome de exibição</span>
                  <input aria-label="Editar nome da organização" className={inputClass} value={editOrganizationName}
                    onChange={event => setEditOrganizationName(event.target.value)} maxLength={160} /></label>
                <label className="block space-y-1"><span className="text-[11px] font-semibold">Razão social</span>
                  <input aria-label="Editar razão social" className={inputClass} value={editLegalName}
                    onChange={event => setEditLegalName(event.target.value)} maxLength={160} /></label>
                <label className="block space-y-1"><span className="text-[11px] font-semibold">CNPJ (opcional)</span>
                  <input aria-label="Editar CNPJ" className={`${inputClass} font-mono`} value={editTaxId}
                    onChange={event => setEditTaxId(formatCnpj(event.target.value))} maxLength={18}
                    inputMode="text" autoCapitalize="characters" autoComplete="off" /></label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className={buttonClass} disabled={busy || !user || authLoading}
                    onClick={updateOrganization}><Save size={15} /> Salvar</button>
                  <button type="button" disabled={busy} onClick={() => setEditingOrganizationId('')}
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 text-xs font-bold dark:border-slate-700"><X size={15} /> Cancelar</button>
                </div>
              </div>
            )}
          </article>
        ))}

        {!loading && organizations.length === 0 && (
          <p className="text-sm text-slate-500">
            Nenhuma organização cadastrada.
          </p>
        )}

        {((!loading && organizations.length === 0) || showOrganizationForm) && (
        <div className="space-y-3 border-t border-slate-200/70 pt-4 dark:border-slate-700">
          <p className="text-[11px] font-bold uppercase tracking-wide text-teal-600 dark:text-teal-400">{organizations.length === 0 ? 'Cadastrar primeira organização' : 'Nova organização'}</p>
        <input
          className={inputClass}
          value={organizationName}
          onChange={event => setOrganizationName(event.target.value)}
          placeholder="Nome da organização"
          maxLength={160}
        />

        <input
          className={inputClass}
          value={legalName}
          onChange={event => setLegalName(event.target.value)}
          placeholder="Razão social (opcional)"
          maxLength={160}
        />

        <label className="block space-y-1.5">
          <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">CNPJ <span className="font-normal">(opcional)</span></span>
          <input
            aria-label="CNPJ da organização"
            className={`${inputClass} font-mono tracking-wide`}
            value={taxId}
            onChange={event => setTaxId(formatCnpj(event.target.value))}
            placeholder="00.000.000/0000-00"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={18}
          />
          <span className="block text-[10px] leading-4 text-slate-400">Pontuação automática. Aceita o CNPJ numérico e o alfanumérico de 2026.</span>
        </label>

        <button
          type="button"
          className={buttonClass}
          disabled={busy || !user || authLoading}
          onClick={createOrganization}
        >
          <Plus size={17} /> Cadastrar organização
        </button>
        </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTab('stores')}
          className={`rounded-2xl p-3 text-sm font-bold ${
            tab === 'stores'
              ? 'bg-teal-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800'
          }`}
        >
          <Store size={16} className="mr-1 inline" /> Lojas
        </button>

        <button
          type="button"
          onClick={() => setTab('platforms')}
          className={`rounded-2xl p-3 text-sm font-bold ${
            tab === 'platforms'
              ? 'bg-teal-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800'
          }`}
        >
          <Layers3 size={16} className="mr-1 inline" /> Plataformas
        </button>
      </div>

      {tab === 'stores' ? (
        <section className={panelClass}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-bold"><Store size={19} /> Minhas lojas</h2>
            {stores.length > 0 && (
              <button type="button" onClick={() => setShowStoreForm(value => !value)}
                aria-expanded={showStoreForm} className="min-h-10 rounded-xl bg-teal-500/10 px-3 text-[11px] font-bold text-teal-700 dark:text-teal-300">
                {showStoreForm ? 'Fechar' : '+ Nova loja'}
              </button>
            )}
          </div>

          {stores.map(store => (
            <article key={store.id} className="space-y-2 rounded-[20px] border border-slate-200/70 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <StoreIdentity store={store} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{store.name}</p>
                  <p className="truncate text-[11px] text-slate-500">{organizations.find(item => item.id === store.organization_id)?.name || 'Organização'}</p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-400">{store.active ? 'Ativa' : 'Inativa'} · {store.acronym}</p>
                </div>
                <button type="button" disabled={busy} onClick={() => beginStoreEdit(store)}
                  aria-label={`Editar loja ${store.name}`} className="flex min-h-10 items-center gap-1 rounded-xl px-2.5 text-[11px] font-bold text-teal-700 dark:text-teal-300">
                  <Pencil size={14} /> Editar
                </button>
              </div>
              {editingStoreId === store.id && (
                <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                  <p className="text-[12px] font-bold text-teal-700 dark:text-teal-300">Editar identidade da loja</p>
                  <label className="block space-y-1"><span className="text-[11px] font-semibold">Nome</span>
                    <input aria-label="Editar nome da loja" className={inputClass} value={editStoreName}
                      onChange={event => setEditStoreName(event.target.value)} maxLength={160} /></label>
                  <label className="block space-y-1"><span className="text-[11px] font-semibold">Sigla</span>
                    <input aria-label="Editar sigla da loja" className={inputClass} value={editStoreAcronym}
                      onChange={event => setEditStoreAcronym(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} maxLength={12} /></label>
                  <label className="block space-y-1"><span className="text-[11px] font-semibold">URL HTTPS do logotipo (opcional)</span>
                    <input aria-label="Editar logotipo da loja" className={inputClass} value={editStoreLogo}
                      onChange={event => setEditStoreLogo(event.target.value)} maxLength={500} /></label>
                  <p className="text-[10px] leading-4 text-slate-400">A organização vinculada e o status da loja são preservados.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className={buttonClass} disabled={busy || !user || authLoading}
                      onClick={updateStore}><Save size={15} /> Salvar</button>
                    <button type="button" disabled={busy} onClick={() => setEditingStoreId('')}
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 text-xs font-bold dark:border-slate-700"><X size={15} /> Cancelar</button>
                  </div>
                </div>
              )}
            </article>
          ))}

          {!loading && stores.length === 0 && (
            <p className="rounded-xl bg-slate-50 p-3 text-[12px] text-slate-500 dark:bg-slate-950">Nenhuma loja cadastrada. Comece vinculando uma loja à organização.</p>
          )}

          {((!loading && stores.length === 0) || showStoreForm) && (
          <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
            <h3 className="text-[12px] font-bold text-teal-700 dark:text-teal-300">Adicionar loja</h3>

          <SelectField
            title="Organização da loja"
            placeholder="Selecione uma organização"
            value={organizationId}
            onChange={setOrganizationId}
            disabled={busy || loading || organizations.length === 0}
            options={organizations.map(organization => ({
              value: organization.id,
              label: organization.name,
              description: organization.tax_id ? formatCnpj(organization.tax_id) : organization.legal_name || undefined,
            }))}
          />

          <input
            className={inputClass}
            value={storeName}
            onChange={event => setStoreName(event.target.value)}
            placeholder="Nome da loja"
            maxLength={160}
          />

          <input
            className={inputClass}
            value={storeAcronym}
            onChange={event => setStoreAcronym(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder={`Sigla: ${
              getAcronym(storeName || 'Da Família Lanches')
            }`}
            maxLength={12}
          />

          <div className="relative">
            <ImageIcon
              size={17}
              className="absolute left-4 top-3.5 text-slate-400"
            />
            <input
              className={`${inputClass} pl-11`}
              value={logoUrl}
              onChange={event => setLogoUrl(event.target.value)}
              placeholder="URL HTTPS do logo (opcional)"
              maxLength={500}
            />
          </div>

          <button
            type="button"
            className={buttonClass}
            disabled={busy || !user || authLoading}
            onClick={createStore}
          >
            <Save size={17} /> Salvar loja
          </button>
          </div>
          )}
        </section>
      ) : (
        <section className={panelClass}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-bold"><Layers3 size={19} /> Plataformas</h2>
            {platforms.length > 0 && (
              <button type="button" onClick={() => setShowPlatformForm(value => !value)}
                aria-expanded={showPlatformForm} className="min-h-10 rounded-xl bg-teal-500/10 px-3 text-[11px] font-bold text-teal-700 dark:text-teal-300">
                {showPlatformForm ? 'Fechar' : '+ Nova plataforma'}
              </button>
            )}
          </div>

          {platforms.map(platform => (
            <article key={platform.id} className="space-y-2 rounded-[20px] border border-slate-200/70 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 font-black text-teal-600 dark:text-teal-400">
                  {platform.provider_key === 'ifood' ? 'iF' : platform.provider_key === '99food' ? '99' : <Layers3 size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{platform.display_name}</p>
                  <p className="truncate text-[11px] text-slate-500">{stores.find(item => item.id === platform.store_id)?.name || 'Loja'}</p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-400">Modo OFF · sem integração automática</p>
                  {platform.external_merchant_ref && <p className="mt-1 break-all text-[10px] text-slate-400">Identificador: {platform.external_merchant_ref}</p>}
                </div>
                <button type="button" disabled={busy} onClick={() => beginPlatformEdit(platform)}
                  aria-label={`Editar plataforma ${platform.display_name}`} className="flex min-h-10 items-center gap-1 rounded-xl px-2.5 text-[11px] font-bold text-teal-700 dark:text-teal-300">
                  <Pencil size={14} /> Editar
                </button>
              </div>
              {editingPlatformId === platform.id && (
                <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                  <p className="text-[12px] font-bold text-teal-700 dark:text-teal-300">Editar identificador comercial</p>
                  <input aria-label="Editar identificador da plataforma" className={inputClass}
                    value={editMerchantReference} onChange={event => setEditMerchantReference(event.target.value)}
                    placeholder="Identificador na plataforma (opcional)" maxLength={160} />
                  <p className="text-[10px] leading-4 text-slate-400">Para proteger históricos, o fornecedor, a loja vinculada e o modo OFF não podem ser alterados aqui.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className={buttonClass} disabled={busy || !user || authLoading}
                      onClick={updatePlatformReference}><Save size={15} /> Salvar</button>
                    <button type="button" disabled={busy} onClick={() => setEditingPlatformId('')}
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 text-xs font-bold dark:border-slate-700"><X size={15} /> Cancelar</button>
                  </div>
                </div>
              )}
            </article>
          ))}

          {!loading && platforms.length === 0 && (
            <p className="rounded-xl bg-slate-50 p-3 text-[12px] text-slate-500 dark:bg-slate-950">Nenhuma plataforma cadastrada. Adicione uma vinculação em modo OFF.</p>
          )}

          {((!loading && platforms.length === 0) || showPlatformForm) && (
          <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
            <h3 className="text-[12px] font-bold text-teal-700 dark:text-teal-300">Adicionar plataforma</h3>

          <SelectField
            title="Loja da plataforma"
            placeholder="Selecione uma loja"
            value={storeId}
            onChange={setStoreId}
            disabled={busy || loading || stores.length === 0}
            options={stores.map(store => ({
              value: store.id,
              label: store.name,
              description: organizations.find(org => org.id === store.organization_id)?.name,
            }))}
          />

          <SelectField
            title="Plataforma parceira"
            placeholder="Escolha uma plataforma"
            value={provider}
            onChange={setProvider}
            disabled={busy}
            options={[
              { value: 'ifood', label: 'iFood', description: 'Cadastro administrativo · OFF' },
              { value: '99food', label: '99Food', description: 'Cadastro administrativo · OFF' },
              { value: 'other', label: 'Outra plataforma', description: 'Identificador personalizado · OFF' },
            ]}
          />

          {provider === 'other' && (
            <input
              className={inputClass}
              value={customProvider}
              onChange={event => setCustomProvider(event.target.value)}
              placeholder="Nome da plataforma"
              maxLength={48}
            />
          )}

          <input
            className={inputClass}
            value={merchantReference}
            onChange={event => setMerchantReference(event.target.value)}
            placeholder="Identificador da loja na plataforma"
            maxLength={160}
          />

          <button
            type="button"
            className={buttonClass}
            disabled={busy || !user || authLoading}
            onClick={createPlatform}
          >
            <Plus size={17} /> Cadastrar em modo OFF
          </button>
          </div>
          )}
        </section>
      )}
    </main>
  )
}
