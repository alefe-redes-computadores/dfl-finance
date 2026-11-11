/** R465 — apoio administrativo MEI. Não consulta nem substitui a Receita Federal. */
export type TaxRegime = 'unknown' | 'mei' | 'simples' | 'presumido' | 'real' | 'other'
export type CommercialTaxProfile = {
  regime: TaxRegime
  startCompetence: string
  /** A baixa é uma DECLARAÇÃO MANUAL do usuário, não uma certidão de quitação. */
  manuallyConfirmedDas: Record<string, string>
  manuallySubmittedDasn: Record<string, string>
}
export type CommercialTaxProfiles = Record<string, CommercialTaxProfile>

export const OFFICIAL_DAS_URL = 'https://www.gov.br/pt-br/servicos/emitir-das-para-pagamento-de-tributos-do-mei'
export const OFFICIAL_DASN_URL = 'https://www.gov.br/pt-br/servicos/declarar-receita-bruta-anual-para-o-mei'
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO = /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
const REGIMES: TaxRegime[] = ['unknown', 'mei', 'simples', 'presumido', 'real', 'other']
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const pad = (x: number) => String(x).padStart(2, '0')

export function validCompetence(s: unknown): s is string {
  if (typeof s !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(s)) return false
  return Number(s.slice(0, 4)) <= 2099
}

export function defaultTaxProfile(): CommercialTaxProfile {
  return { regime: 'unknown', startCompetence: '', manuallyConfirmedDas: {}, manuallySubmittedDasn: {} }
}

/** Sanitiza o JSON sincronizado para não executar chaves protótipo ou dados arbitrários. */
export function normalizeCommercialTaxProfiles(value: unknown): CommercialTaxProfiles {
  if (!record(value)) return {}
  const result: CommercialTaxProfiles = {}
  for (const [organizationId, data] of Object.entries(value).slice(0, 50)) {
    if (!ID.test(organizationId) || !record(data)) continue
    const regime = REGIMES.includes(data.regime as TaxRegime) ? data.regime as TaxRegime : 'unknown'
    const confirmed: Record<string, string> = {}
    const annual: Record<string, string> = {}
    if (record(data.manuallyConfirmedDas)) {
      for (const [month, stamp] of Object.entries(data.manuallyConfirmedDas).slice(0, 144)) {
        if (validCompetence(month) && typeof stamp === 'string' && ISO.test(stamp) && Number.isFinite(Date.parse(stamp))) confirmed[month] = stamp
      }
    }
    if (record(data.manuallySubmittedDasn)) {
      for (const [year, stamp] of Object.entries(data.manuallySubmittedDasn).slice(0, 30)) {
        if (/^20\d{2}$/.test(year) && typeof stamp === 'string' && ISO.test(stamp) && Number.isFinite(Date.parse(stamp))) annual[year] = stamp
      }
    }
    result[organizationId] = {
      regime,
      startCompetence: validCompetence(data.startCompetence) ? data.startCompetence : '',
      manuallyConfirmedDas: confirmed,
      manuallySubmittedDasn: annual,
    }
  }
  return result
}

export function monthOffset(competence: string, offset: number): string | null {
  if (!validCompetence(competence) || !Number.isSafeInteger(offset) || Math.abs(offset) > 240) return null
  const year = Number(competence.slice(0, 4))
  const month = Number(competence.slice(5, 7)) - 1
  const date = new Date(Date.UTC(year, month + offset, 1))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`
}

/** Competência janeiro: vencimento-base em fevereiro. Apenas fim de semana é ajustado.
 * Feriados bancários municipais/estaduais/nacionais exigem confirmação na guia oficial.
 */
export function estimatedDasDue(competence: string): string | null {
  if (!validCompetence(competence)) return null
  const year = Number(competence.slice(0, 4))
  const month = Number(competence.slice(5, 7))
  const date = new Date(Date.UTC(year, month, 20))
  const weekday = date.getUTCDay()
  if (weekday === 6) date.setUTCDate(date.getUTCDate() + 2)
  if (weekday === 0) date.setUTCDate(date.getUTCDate() + 1)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function civilToday(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
export function currentCompetence(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
}

/** A tela mostra somente uma janela útil, sem pressupor pendências desde a abertura do CNPJ. */
export function visibleDasCompetences(profile: CommercialTaxProfile, now = new Date()): string[] {
  if (profile.regime !== 'mei' || !validCompetence(profile.startCompetence)) return []
  const current = currentCompetence(now)
  const result: string[] = []
  for (let offset = 1; offset >= -11; offset--) {
    const month = monthOffset(current, offset)
    if (month && month >= profile.startCompetence) result.push(month)
  }
  return result
}

/** Motor nativo só agenda a janela próxima; nunca marca guia paga automaticamente. */
export function reminderDasCompetences(profile: CommercialTaxProfile, now = new Date()): string[] {
  if (profile.regime !== 'mei' || !validCompetence(profile.startCompetence)) return []
  const current = currentCompetence(now)
  const result: string[] = []
  for (let offset = -2; offset <= 2; offset++) {
    const month = monthOffset(current, offset)
    if (month && month >= profile.startCompetence && !profile.manuallyConfirmedDas[month]) result.push(month)
  }
  return result
}

export function dasDisplayStatus(profile: CommercialTaxProfile, competence: string, today = civilToday()):
  'confirmed-manually' | 'date-passed-unconfirmed' | 'today' | 'upcoming' | 'unknown' {
  if (!validCompetence(competence)) return 'unknown'
  if (profile.manuallyConfirmedDas[competence]) return 'confirmed-manually'
  const due = estimatedDasDue(competence)
  return due ? due < today ? 'date-passed-unconfirmed' : due === today ? 'today' : 'upcoming' : 'unknown'
}

export function estimatedDasnDue(year: number): string | null {
  return Number.isInteger(year) && year >= 2000 && year <= 2099 ? `${year + 1}-05-31` : null
}
