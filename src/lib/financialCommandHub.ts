/** R420 — Comando unificado. Só guarda IDs conhecidos; nunca textos ou valores financeiros. */
export type CommandHubScope = 'home' | 'transactions' | 'analysis' | 'cards' | 'search'
export type CommandHubContext = 'dfl' | 'personal'
export type CommandHubAction = {
  id: string
  title: string
  description: string
  href: string
  scopes: readonly CommandHubScope[]
}

export const COMMAND_HUB_ACTIONS: readonly CommandHubAction[] = [
  { id: 'new-expense', title: 'Nova despesa', description: 'Revisar no formulário completo', href: '/transactions/new?type=expense', scopes: ['home', 'transactions'] },
  { id: 'new-income', title: 'Nova receita', description: 'Revisar no formulário completo', href: '/transactions/new?type=income', scopes: ['home', 'transactions'] },
  { id: 'transactions', title: 'Extrato', description: 'Consultar movimentações', href: '/transactions', scopes: ['home', 'transactions', 'analysis'] },
  { id: 'transfer', title: 'Transferência', description: 'Abrir formulário de transferência', href: '/transactions?action=transfer', scopes: ['transactions', 'home'] },
  { id: 'reconciliation', title: 'Conciliação', description: 'Revisar pendências', href: '/conciliation', scopes: ['home', 'transactions'] },
  { id: 'accounts', title: 'Contas', description: 'Ver contas cadastradas', href: '/accounts', scopes: ['home', 'transactions'] },
  { id: 'cards', title: 'Cartões', description: 'Conferir cartões e faturas', href: '/cards', scopes: ['cards', 'home'] },
  { id: 'analysis', title: 'Análises', description: 'Explorar indicadores', href: '/analysis', scopes: ['analysis', 'home'] },
  { id: 'reports', title: 'Relatórios', description: 'Consultar relatórios financeiros', href: '/reports', scopes: ['analysis'] },
  { id: 'planning', title: 'Planejamento', description: 'Visualizar compromissos', href: '/planning', scopes: ['analysis'] },
  { id: 'projections', title: 'Projeções', description: 'Estudar cenários', href: '/projections', scopes: ['analysis'] },
  { id: 'receipts', title: 'Comprovantes', description: 'Consultar anexos', href: '/receipts', scopes: ['transactions', 'cards'] },
  { id: 'subscriptions', title: 'Assinaturas', description: 'Ver recorrências', href: '/subscriptions', scopes: ['home', 'analysis'] },
  { id: 'goals', title: 'Metas', description: 'Acompanhar objetivos', href: '/goals', scopes: ['analysis'] },
]

const known = new Map(COMMAND_HUB_ACTIONS.map(item => [item.id, item]))
const allowedScopes = new Set<CommandHubScope>(['home', 'transactions', 'analysis', 'cards', 'search'])
const favoritePrefix = 'dfl.finance.hub.favorites.v420'
const recentPrefix = 'dfl.finance.hub.recents.v420'
const scopeKey = 'dfl.finance.hub.scope.v420'
const scopeMaxAge = 45_000
const maxFav = 5
const maxRecent = 5

function userKey(userId: string | null | undefined, context: CommandHubContext, prefix: string): string | null {
  if (!userId || !/^[a-zA-Z0-9-]{8,90}$/.test(userId)) return null
  if (context !== 'dfl' && context !== 'personal') return null
  return `${prefix}:${userId}:${context}`
}
function readIds(storage: Storage | undefined, key: string | null, max: number): string[] {
  if (!storage || !key) return []
  try {
    const value = JSON.parse(storage.getItem(key) || '[]') as unknown
    if (!Array.isArray(value)) return []
    return Array.from(new Set(value.filter((id): id is string => typeof id === 'string' && known.has(id)))).slice(0, max)
  } catch { return [] }
}
function writeIds(storage: Storage | undefined, key: string | null, ids: string[]) {
  if (!storage || !key) return
  try { storage.setItem(key, JSON.stringify(ids)) } catch { /* Storage pode estar indisponível */ }
}
function getStorage(kind: 'local' | 'session'): Storage | undefined {
  if (typeof window === 'undefined') return undefined
  try { return kind === 'local' ? window.localStorage : window.sessionStorage } catch { return undefined }
}
export function hubAction(id: string): CommandHubAction | null {
  return known.get(id) ?? null
}
export function hubFavorites(userId: string | null | undefined, context: CommandHubContext): string[] {
  return readIds(getStorage('local'), userKey(userId, context, favoritePrefix), maxFav)
}
export function hubRecents(userId: string | null | undefined, context: CommandHubContext): string[] {
  return readIds(getStorage('session'), userKey(userId, context, recentPrefix), maxRecent)
}
export function toggleHubFavorite(userId: string | null | undefined, context: CommandHubContext, id: string): string[] {
  if (!known.has(id)) return hubFavorites(userId, context)
  const key = userKey(userId, context, favoritePrefix)
  if (!key) return []
  const old = hubFavorites(userId, context)
  const next = old.includes(id) ? old.filter(item => item !== id) : [id, ...old].slice(0, maxFav)
  writeIds(getStorage('local'), key, next)
  return next
}
export function rememberHubAction(userId: string | null | undefined, context: CommandHubContext, id: string) {
  if (!known.has(id)) return false
  const key = userKey(userId, context, recentPrefix)
  if (!key) return false
  writeIds(getStorage('session'), key, [id, ...hubRecents(userId, context).filter(x => x !== id)].slice(0, maxRecent))
  return true
}
/** Somente rotas de catálogo, nunca query digitada, valores ou rascunhos. */
export function rememberKnownHubRoute(userId: string | null | undefined, context: CommandHubContext, href: string) {
  const item = COMMAND_HUB_ACTIONS.find(x => x.href === href)
  return item ? rememberHubAction(userId, context, item.id) : false
}
export function clearHubRecents(userId: string | null | undefined, context: CommandHubContext) {
  const key = userKey(userId, context, recentPrefix)
  if (key) try { getStorage('session')?.removeItem(key) } catch { /* opcional */ }
}
export function suggestedHubActions(scope: CommandHubScope, favorites: readonly string[], recents: readonly string[]): CommandHubAction[] {
  const selected: CommandHubAction[] = []
  const add = (id: string) => {
    const action = known.get(id)
    if (action && !selected.some(item => item.id === id)) selected.push(action)
  }
  const contextual = COMMAND_HUB_ACTIONS.filter(item => item.scopes.includes(scope))
  const belongsToScope = (id: string) => known.get(id)?.scopes.includes(scope) === true
  // Favoritos pertinentes primeiro; reservar uma vaga para a tela atual.
  // Ate cinco favoritos continuam acessiveis nas seis posicoes disponiveis.
  favorites.filter(belongsToScope).forEach(add)
  contextual.slice(0, 1).forEach(item => add(item.id))
  favorites.forEach(add)
  recents.filter(belongsToScope).forEach(add)
  contextual.forEach(item => add(item.id))
  recents.forEach(add)
  COMMAND_HUB_ACTIONS.forEach(item => add(item.id))
  return selected.slice(0, 6)
}
export function stageCommandHubScope(scope: CommandHubScope, voice = false): boolean {
  if (!allowedScopes.has(scope)) return false
  const storage = getStorage('session')
  if (!storage) return false
  try {
    storage.setItem(scopeKey, JSON.stringify({ scope, voice: voice === true, at: Date.now() }))
    return true
  } catch { return false }
}
export function consumeCommandHubScope(): { scope: CommandHubScope; voice: boolean } | null {
  const storage = getStorage('session')
  if (!storage) return null
  try {
    const raw = storage.getItem(scopeKey)
    storage.removeItem(scopeKey)
    if (!raw) return null
    const data = JSON.parse(raw) as { scope?: CommandHubScope; voice?: boolean; at?: number }
    if (!data || !data.scope || !allowedScopes.has(data.scope) || typeof data.at !== 'number') return null
    const age = Date.now() - data.at
    return age >= 0 && age <= scopeMaxAge ? { scope: data.scope, voice: data.voice === true } : null
  } catch { return null }
}
