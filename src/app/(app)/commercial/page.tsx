'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Building2, Store, Layers3, Plus,
  RefreshCw, ShieldCheck, Save, LockKeyhole,
  CheckCircle2, ImageIcon
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

type Organization = {
  id: string
  name: string
  legal_name: string | null
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
            .select('id,name,legal_name')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false }),
          supabase.from('dfl_commercial_stores')
            .select('id,organization_id,name,acronym,logo_url,active')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false }),
          supabase.from('dfl_commercial_platforms')
            .select('id,store_id,display_name,provider_key,mode')
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

      const result = await supabase
        .from('dfl_commercial_organizations')
        .insert({
          owner_id: user.id,
          name: organizationName.trim(),
          legal_name: legalName.trim() || null
        })

      if (result.error) throw result.error

      setOrganizationName('')
      setLegalName('')
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
      showToast('Plataforma cadastrada em modo OFF.', 'success')
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

      <button
        type="button"
        onClick={() => router.push('/commercial/overview')}
        className="flex w-full items-center justify-between rounded-3xl border border-teal-500/20 bg-teal-500/10 p-4 text-left transition active:scale-[.99]"
      >
        <div>
          <p className="text-sm font-bold">Central Comercial 360</p>
          <p className="mt-1 text-xs text-slate-500">
            Indicadores, filtros, segurança e exportação
          </p>
        </div>
        <Layers3 size={21} className="text-teal-500" />
      </button>

      <button
        type="button"
        onClick={() => router.push('/commercial/simulation')}
        className="flex w-full items-center justify-between rounded-3xl border border-teal-500/20 bg-teal-500/10 p-4 text-left transition active:scale-[.99]"
      >
        <div>
          <p className="text-sm font-bold">Simulador de repasses</p>
          <p className="mt-1 text-xs text-slate-500">Taxas, retenções e comparação de cenários · sem gravação</p>
        </div>
        <Layers3 size={21} className="text-teal-500" />
      </button>

      <button type="button" onClick={() => router.push('/commercial/ledger')}
        className="flex w-full items-center justify-between rounded-3xl border border-teal-500/20 bg-teal-500/5 p-4 text-left transition active:scale-[.99]">
        <div><p className="text-sm font-bold">Ledger comercial supervisionado</p>
          <p className="mt-1 text-xs text-slate-500">Registros e conciliação parcial · requer migração R443</p></div>
        <Layers3 size={21} className="text-teal-500" />
      </button>

      <button type="button" onClick={() => router.push('/commercial/operation')}
        className="flex w-full items-center justify-between rounded-3xl border border-teal-500/20 bg-teal-500/10 p-4 text-left transition active:scale-[.99]">
        <div><p className="text-sm font-bold">Operação comercial · laboratório</p>
          <p className="mt-1 text-xs text-slate-500">CSV, taxas, repasses e conciliação manual · OFF</p></div>
        <Layers3 size={21} className="text-teal-500" />
      </button>

      <section className="rounded-3xl border border-teal-500/20 bg-teal-500/5 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck size={22} className="shrink-0 text-teal-600" />
          <div>
            <p className="text-sm font-bold">Fundação comercial segura</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Cadastros administrativos disponíveis. Integração,
              importações, repasses e lançamentos automáticos
              permanecem desligados.
            </p>
          </div>
        </div>
      </section>

      <section className={panelClass}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold">
            <Building2 size={19} /> Organizações
          </h2>
          <span className="text-xs text-slate-500">
            {organizations.length}
          </span>
        </div>

        {organizations.map(organization => (
          <div
            key={organization.id}
            className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"
          >
            <p className="text-sm font-semibold">
              {organization.name}
            </p>
            {organization.legal_name && (
              <p className="mt-1 text-xs text-slate-500">
                {organization.legal_name}
              </p>
            )}
          </div>
        ))}

        {!loading && organizations.length === 0 && (
          <p className="text-sm text-slate-500">
            Nenhuma organização cadastrada.
          </p>
        )}

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

        <button
          type="button"
          className={buttonClass}
          disabled={busy || !user || authLoading}
          onClick={createOrganization}
        >
          <Plus size={17} /> Cadastrar organização
        </button>
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
          <h2 className="flex items-center gap-2 font-bold">
            <Store size={19} /> Minhas lojas
          </h2>

          {stores.map(store => (
            <div
              key={store.id}
              className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"
            >
              <StoreIdentity store={store} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {store.name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {organizations.find(item =>
                    item.id === store.organization_id
                  )?.name || 'Organização'}
                </p>
              </div>

              <CheckCircle2
                size={17}
                className={store.active
                  ? 'text-teal-500'
                  : 'text-slate-400'}
              />
            </div>
          ))}

          <h3 className="font-semibold">Adicionar loja</h3>

          <select
            className={inputClass}
            value={organizationId}
            onChange={event => setOrganizationId(event.target.value)}
          >
            <option value="">Selecione a organização</option>
            {organizations.map(organization => (
              <option
                key={organization.id}
                value={organization.id}
              >
                {organization.name}
              </option>
            ))}
          </select>

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
            onChange={event => setStoreAcronym(event.target.value)}
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
        </section>
      ) : (
        <section className={panelClass}>
          <h2 className="flex items-center gap-2 font-bold">
            <Layers3 size={19} /> Plataformas
          </h2>

          {platforms.map(platform => (
            <div
              key={platform.id}
              className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200 text-xs font-black dark:bg-slate-800">
                {platform.provider_key === 'ifood'
                  ? 'iF'
                  : platform.provider_key === '99food'
                    ? '99'
                    : <Layers3 size={18} />}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {platform.display_name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {stores.find(item =>
                    item.id === platform.store_id
                  )?.name || 'Loja'}
                  {' · OFF'}
                </p>
              </div>

              <LockKeyhole size={17} className="text-slate-400" />
            </div>
          ))}

          <h3 className="font-semibold">Adicionar plataforma</h3>

          <select
            className={inputClass}
            value={storeId}
            onChange={event => setStoreId(event.target.value)}
          >
            <option value="">Selecione a loja</option>
            {stores.map(store => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>

          <select
            className={inputClass}
            value={provider}
            onChange={event => setProvider(event.target.value)}
          >
            <option value="ifood">iFood</option>
            <option value="99food">99Food</option>
            <option value="other">Outra plataforma</option>
          </select>

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
        </section>
      )}
    </main>
  )
}
