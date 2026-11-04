'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Building2, Store, Layers3,
  Download, RefreshCw, ShieldCheck,
  LockKeyhole, Search, AlertCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import {
  downloadCommercialCsv,
  type CommercialExportRow
} from '@/lib/commercialExport'

type Organization = {
  id: string
  name: string
  legal_name: string | null
}

type Shop = {
  id: string
  organization_id: string
  name: string
  acronym: string
  active: boolean
}

type Platform = {
  id: string
  organization_id: string
  store_id: string
  provider_key: string
  display_name: string
  mode: string
  active: boolean
}

type ModuleSettings = {
  stores_mode: string
  platforms_mode: string
  imports_mode: string
  reconciliation_mode: string
}

const panel =
  'rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900'

export default function CommercialOverviewPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const haptic = useHapticFeedback()

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [settings, setSettings] = useState<ModuleSettings[]>([])
  const [organizationId, setOrganizationId] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(false)

    try {
      const [a, b, c, d] = await Promise.all([
        supabase.from('dfl_commercial_organizations')
          .select('id,name,legal_name')
          .eq('owner_id', user.id),
        supabase.from('dfl_commercial_stores')
          .select('id,organization_id,name,acronym,active')
          .eq('owner_id', user.id),
        supabase.from('dfl_commercial_platforms')
          .select('id,organization_id,store_id,provider_key,display_name,mode,active')
          .eq('owner_id', user.id),
        supabase.from('dfl_commercial_module_settings')
          .select('stores_mode,platforms_mode,imports_mode,reconciliation_mode')
          .eq('owner_id', user.id)
      ])

      const problem = a.error || b.error || c.error || d.error
      if (problem) throw problem

      setOrganizations((a.data || []) as Organization[])
      setShops((b.data || []) as Shop[])
      setPlatforms((c.data || []) as Platform[])
      setSettings((d.data || []) as ModuleSettings[])
    } catch (error) {
      setLoadError(true)
      showToast(
        error instanceof Error
          ? error.message
          : 'Falha ao consultar a central comercial.',
        'error'
      )
    } finally {
      setLoading(false)
    }
  }, [user?.id, showToast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const visibleOrganizations = useMemo(
    () => organizations.filter(item =>
      organizationId === 'all' || item.id === organizationId
    ),
    [organizations, organizationId]
  )

  const visibleShops = useMemo(
    () => shops.filter(item =>
      organizationId === 'all' ||
      item.organization_id === organizationId
    ),
    [shops, organizationId]
  )

  const visiblePlatforms = useMemo(
    () => platforms.filter(item =>
      organizationId === 'all' ||
      item.organization_id === organizationId
    ),
    [platforms, organizationId]
  )

  const searchText = search.trim().toLocaleLowerCase('pt-BR')

  const matchedShops = visibleShops.filter(item =>
    !searchText ||
    item.name.toLocaleLowerCase('pt-BR').includes(searchText) ||
    item.acronym.toLocaleLowerCase('pt-BR').includes(searchText)
  )

  const matchedPlatforms = visiblePlatforms.filter(item =>
    !searchText ||
    item.display_name.toLocaleLowerCase('pt-BR').includes(searchText) ||
    visibleShops.some(shop =>
      shop.id === item.store_id &&
      shop.name.toLocaleLowerCase('pt-BR').includes(searchText)
    )
  )

  const modulesOff = settings.every(item =>
    item.stores_mode === 'off' &&
    item.platforms_mode === 'off' &&
    item.imports_mode === 'off' &&
    item.reconciliation_mode === 'off'
  )

  const platformsOff = platforms.every(item =>
    item.mode === 'off' && !item.active
  )

  const safeToExport =
    Boolean(user?.id) &&
    !authLoading &&
    !loading &&
    !loadError

  function exportData() {
    if (!safeToExport) {
      showToast('Aguarde a leitura completa dos dados.', 'warning')
      return
    }

    const rows: CommercialExportRow[] = [
      ...visibleOrganizations.map(item => ({
        type: 'organization' as const,
        id: item.id,
        parentId: '',
        name: item.name,
        detail: item.legal_name || '',
        status: 'cadastro'
      })),
      ...matchedShops.map(item => ({
        type: 'store' as const,
        id: item.id,
        parentId: item.organization_id,
        name: item.name,
        detail: item.acronym,
        status: item.active ? 'ativa' : 'inativa'
      })),
      ...matchedPlatforms.map(item => ({
        type: 'platform' as const,
        id: item.id,
        parentId: item.store_id,
        name: item.display_name,
        detail: item.provider_key,
        status: item.mode
      }))
    ]

    try {
      downloadCommercialCsv(rows)
      haptic.success()
      showToast('Exportação comercial preparada.', 'success')
    } catch {
      haptic.error()
      showToast('Falha ao exportar os cadastros.', 'error')
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-5 px-4 pb-28 pt-5 text-slate-900 dark:text-slate-100">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => router.push('/commercial')}
          className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">Central Comercial 360</h1>
          <p className="text-xs text-slate-500">
            Estrutura e segurança operacional
          </p>
        </div>
        <button
          type="button"
          aria-label="Atualizar dados"
          onClick={() => void refresh()}
          className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800"
        >
          <RefreshCw size={19} />
        </button>
      </header>

      <section className="grid grid-cols-3 gap-2">
        {[
          { label: 'Empresas', value: visibleOrganizations.length, icon: Building2 },
          { label: 'Lojas', value: visibleShops.length, icon: Store },
          { label: 'Plataformas', value: visiblePlatforms.length, icon: Layers3 }
        ].map(item => (
          <div key={item.label} className={panel}>
            <item.icon size={17} className="text-teal-500" />
            <p className="mt-3 text-2xl font-bold tabular-nums">
              {loading ? '—' : item.value}
            </p>
            <p className="text-xs text-slate-500">{item.label}</p>
          </div>
        ))}
      </section>

      <section className={`${panel} space-y-3`}>
        <h2 className="text-sm font-bold">Explorar estrutura</h2>
        <select
          aria-label="Filtrar organização"
          value={organizationId}
          onChange={event => setOrganizationId(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-transparent p-3 text-sm dark:border-slate-700"
        >
          <option value="all">Todas as organizações</option>
          {organizations.map(item => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>

        <div className="relative">
          <Search
            size={17}
            className="absolute left-3 top-3.5 text-slate-400"
          />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar loja ou plataforma"
            className="w-full rounded-2xl border border-slate-200 bg-transparent py-3 pl-10 pr-3 text-sm dark:border-slate-700"
          />
        </div>
      </section>

      <section className={`${panel} space-y-3`}>
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Store size={17} /> Lojas
        </h2>

        {matchedShops.map(item => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{item.name}</p>
              <p className="text-xs text-slate-500">{item.acronym}</p>
            </div>
            <span className="text-xs text-slate-500">
              {item.active ? 'Ativa' : 'Inativa'}
            </span>
          </div>
        ))}

        {!loading && matchedShops.length === 0 && (
          <p className="text-sm text-slate-500">Nenhuma loja encontrada.</p>
        )}
      </section>

      <section className={`${panel} space-y-3`}>
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Layers3 size={17} /> Plataformas
        </h2>

        {matchedPlatforms.map(item => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {item.display_name}
              </p>
              <p className="text-xs text-slate-500">
                {visibleShops.find(shop =>
                  shop.id === item.store_id
                )?.name || 'Loja'}
              </p>
            </div>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <LockKeyhole size={13} /> {item.mode.toUpperCase()}
            </span>
          </div>
        ))}

        {!loading && matchedPlatforms.length === 0 && (
          <p className="text-sm text-slate-500">
            Nenhuma plataforma encontrada.
          </p>
        )}
      </section>

      <section className={`${panel} space-y-3`}>
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <ShieldCheck size={18} /> Diagnóstico de segurança
        </h2>

        <div className="flex items-center justify-between text-sm">
          <span>Módulos comerciais</span>
          <span className={modulesOff ? 'text-teal-500' : 'text-amber-500'}>
            {loading ? 'Verificando' : modulesOff ? 'OFF' : 'Revisar'}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span>Plataformas automáticas</span>
          <span className={platformsOff ? 'text-teal-500' : 'text-amber-500'}>
            {loading ? 'Verificando' : platformsOff ? 'OFF' : 'Revisar'}
          </span>
        </div>

        <p className="text-xs leading-relaxed text-slate-500">
          Este diagnóstico mostra apenas configurações e cadastros.
          Não certifica integrações externas, saldos ou conciliação.
        </p>

        {loadError && (
          <p className="flex items-center gap-2 text-xs text-rose-500">
            <AlertCircle size={15} />
            Não foi possível confirmar o estado completo.
          </p>
        )}
      </section>

      <button
        type="button"
        onClick={exportData}
        disabled={!safeToExport}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 p-4 text-sm font-bold text-white active:scale-[.98] disabled:opacity-50"
      >
        <Download size={18} /> Exportar cadastros filtrados (CSV)
      </button>
    </main>
  )
}
