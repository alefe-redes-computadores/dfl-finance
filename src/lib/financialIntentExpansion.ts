/**
 * R429 — intencoes de cadastro seguras, sugestoes de recuperacao e descoberta.
 * Catalogo fechado: nunca executa escrita, rede ou interpreta dados sensiveis.
 */
import type { FinancialSearchCommand } from '@/lib/globalSearch'

type Scope = 'home' | 'transactions' | 'analysis' | 'cards' | 'search'
export type RecoveryAction = { id: string; title: string; detail: string; href: string }

const fold = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[!?.,;:]+$/g, '').replace(/\s+/g, ' ').trim()

type CatalogEntry = {
  id: string; title: string; subject: RegExp; href: string; detail: string
}

const CREATE_CATALOG: readonly CatalogEntry[] = [
  { id: 'new-card', title: 'Cadastrar cartão', subject: /^(?:cartao(?: de (?:credito|debito))?|cartao bancario)$/, href: '/cards/new', detail: 'Abrir cadastro de cartão e revisar os dados' },
  { id: 'new-account', title: 'Cadastrar conta', subject: /^(?:conta(?: bancaria| corrente| digital| poupanca)?|conta de banco)$/, href: '/accounts/new', detail: 'Abrir cadastro de conta e revisar os dados' },
  { id: 'new-goal', title: 'Criar meta', subject: /^(?:meta(?: financeira| de economia)?|objetivo(?: financeiro| de economia)?)$/, href: '/goals/new', detail: 'Definir uma meta no formulário completo' },
  { id: 'new-budget', title: 'Criar orçamento', subject: /^(?:orcamento(?: mensal| financeiro)?|limite de gastos|planejamento de gastos)$/, href: '/budgets/new', detail: 'Montar um orçamento e revisar seus limites' },
  { id: 'new-contact', title: 'Cadastrar contato', subject: /^(?:contato|cliente|fornecedor)$/, href: '/contacts/new', detail: 'Abrir cadastro de contato, cliente ou fornecedor' },
  { id: 'new-subscription', title: 'Cadastrar assinatura', subject: /^(?:assinatura|recorrencia|despesa recorrente)$/, href: '/subscriptions/new', detail: 'Configurar uma assinatura ou recorrência' },
  { id: 'new-loan', title: 'Cadastrar empréstimo', subject: /^(?:emprestimo)$/, href: '/loans/new', detail: 'Revisar os dados de um empréstimo' },
  { id: 'new-financing', title: 'Cadastrar financiamento', subject: /^(?:financiamento)$/, href: '/financings/new', detail: 'Revisar os dados de um financiamento' },
  { id: 'new-receivable', title: 'Cadastrar valor a receber', subject: /^(?:valor a receber|conta a receber|devedor|divida a receber)$/, href: '/debts/new', detail: 'Conferir o cadastro de um valor a receber' },
  { id: 'manage-category', title: 'Adicionar categoria', subject: /^(?:categoria(?: de (?:receita|despesa))?)$/, href: '/categories', detail: 'Abrir categorias e tocar em Nova categoria para finalizar' },
]

/** Somente estruturas completas reconhecidas; qualificadores desconhecidos seguem para busca. */
export function resolveExtendedFinancialCommands(input: string): FinancialSearchCommand[] {
  const q = fold(input)
  if (!q || q.length > 180) return []
  const match = q.match(/^(?:(?:por favor|eu|quero|preciso|gostaria de|pode|poderia|me ajuda a)\s+){0,3}(?:criar|crie|cadastrar|cadastre|adicionar|adicione|incluir|registrar|registre|montar|fazer|abrir cadastro de|novo|nova)\s+(.+)$/)
  if (!match) return []
  const subject = match[1].replace(/^(?:(?:um|uma|o|a|meu|minha|mais um|mais uma|novo|nova)\s+){0,3}/, '').trim()
  const entry = CREATE_CATALOG.find(item => item.subject.test(subject))
  if (!entry) return []
  return [{ id: entry.id, title: entry.title, description: entry.detail, href: entry.href, intent: 'create' }]
}

const recoveryCatalog: readonly RecoveryAction[] = [
  { id: 'view-cards', title: 'Ver cartões', detail: 'Conferir cartões e faturas', href: '/cards' },
  { id: 'new-card', title: 'Cadastrar cartão', detail: 'Abrir cadastro completo', href: '/cards/new' },
  { id: 'view-accounts', title: 'Ver contas', detail: 'Consultar contas bancárias', href: '/accounts' },
  { id: 'new-account', title: 'Cadastrar conta', detail: 'Abrir cadastro completo', href: '/accounts/new' },
  { id: 'view-transactions', title: 'Ver extrato', detail: 'Pesquisar lançamentos', href: '/transactions' },
  { id: 'new-expense', title: 'Nova despesa', detail: 'Lançamento com revisão', href: '/transactions/new?type=expense' },
  { id: 'new-income', title: 'Nova receita', detail: 'Lançamento com revisão', href: '/transactions/new?type=income' },
  { id: 'view-goals', title: 'Ver metas', detail: 'Acompanhar objetivos', href: '/goals' },
  { id: 'new-goal', title: 'Criar meta', detail: 'Definir objetivo', href: '/goals/new' },
  { id: 'view-budgets', title: 'Ver orçamentos', detail: 'Acompanhar limites', href: '/budgets' },
  { id: 'new-budget', title: 'Criar orçamento', detail: 'Planejar gastos', href: '/budgets/new' },
  { id: 'view-subscriptions', title: 'Ver assinaturas', detail: 'Conferir recorrências', href: '/subscriptions' },
  { id: 'new-subscription', title: 'Nova assinatura', detail: 'Configurar recorrência', href: '/subscriptions/new' },
  { id: 'view-loans', title: 'Ver empréstimos', detail: 'Conferir contratos', href: '/loans' },
  { id: 'new-loan', title: 'Novo empréstimo', detail: 'Abrir cadastro completo', href: '/loans/new' },
  { id: 'view-financings', title: 'Ver financiamentos', detail: 'Conferir parcelas', href: '/financings' },
  { id: 'new-financing', title: 'Novo financiamento', detail: 'Abrir cadastro completo', href: '/financings/new' },
  { id: 'view-contacts', title: 'Ver contatos', detail: 'Clientes e fornecedores', href: '/contacts' },
  { id: 'new-contact', title: 'Cadastrar contato', detail: 'Abrir cadastro completo', href: '/contacts/new' },
  { id: 'view-debts', title: 'Valores a receber', detail: 'Consultar pendências', href: '/debts' },
  { id: 'view-receipts', title: 'Ver comprovantes', detail: 'Consultar anexos', href: '/receipts' },
  { id: 'view-planning', title: 'Ver planejamento', detail: 'Acompanhar compromissos', href: '/planning' },
  { id: 'view-analysis', title: 'Ver análises', detail: 'Explorar indicadores', href: '/analysis' },
  { id: 'view-categories', title: 'Ver categorias', detail: 'Organizar classificações', href: '/categories' },
]
const byId = new Map(recoveryCatalog.map(action => [action.id, action]))
function actions(ids: readonly string[]): RecoveryAction[] {
  return ids.map(id => byId.get(id)).filter((item): item is RecoveryAction => !!item)
}

/** Sugere apenas rotas verificadas. Nunca diz que houve correspondência de dados. */
export function suggestFinancialRecovery(query: string, scope: Scope = 'search'): RecoveryAction[] {
  const q = fold(query)
  if (/cart[aã]o|cartoes|fatura/.test(q)) return actions(['view-cards', 'new-card', 'view-receipts'])
  if (/conta|banco|saldo/.test(q)) return actions(['view-accounts', 'new-account', 'view-transactions'])
  if (/meta|objetivo/.test(q)) return actions(['view-goals', 'new-goal', 'view-planning'])
  if (/orcamento|limite de gasto/.test(q)) return actions(['view-budgets', 'new-budget', 'view-analysis'])
  if (/assinatura|recorrencia/.test(q)) return actions(['view-subscriptions', 'new-subscription', 'view-transactions'])
  if (/emprestimo/.test(q)) return actions(['view-loans', 'new-loan', 'view-planning'])
  if (/financiamento/.test(q)) return actions(['view-financings', 'new-financing', 'view-planning'])
  if (/cliente|contato|fornecedor/.test(q)) return actions(['view-contacts', 'new-contact', 'view-transactions'])
  if (/divida|devedor|a receber/.test(q)) return actions(['view-debts', 'view-contacts', 'view-transactions'])
  if (/comprovante|recibo|anexo/.test(q)) return actions(['view-receipts', 'view-transactions', 'view-cards'])
  if (/despesa|gasto|pagamento|compra/.test(q)) return actions(['view-transactions', 'new-expense', 'view-categories'])
  if (/receita|entrada|recebimento/.test(q)) return actions(['view-transactions', 'new-income', 'view-accounts'])
  if (/planejamento|projecao|analise|relatorio/.test(q)) return actions(['view-planning', 'view-analysis', 'view-budgets'])
  if (scope === 'cards') return actions(['view-cards', 'new-card', 'view-receipts'])
  if (scope === 'analysis') return actions(['view-analysis', 'view-planning', 'view-budgets'])
  if (scope === 'transactions') return actions(['view-transactions', 'new-expense', 'view-accounts'])
  return actions(['view-transactions', 'new-expense', 'view-cards'])
}

const STARTERS: Record<Scope, readonly string[]> = {
  home: ['Novo cartão', 'Criar meta', 'Nova despesa', 'Cadastrar conta', 'Nova assinatura', 'Abrir planejamento', 'Nova receita', 'Novo orçamento', 'Adicionar contato', 'Ver pendências', 'Novo empréstimo', 'Ver cartões'],
  transactions: ['Nova despesa', 'Transferir entre contas', 'Nova receita', 'Buscar mercado', 'Abrir conciliação', 'Ver comprovantes', 'Novo cartão', 'Cadastrar conta', 'Nova assinatura', 'Abrir planejamento', 'Ver cartões', 'Criar meta'],
  analysis: ['Abrir planejamento', 'Criar meta', 'Novo orçamento', 'Ver comprovantes', 'Nova assinatura', 'Novo empréstimo', 'Ver cartões', 'Abrir conciliação', 'Nova despesa', 'Nova receita', 'Novo financiamento', 'Cadastrar conta'],
  cards: ['Novo cartão', 'Ver cartões', 'Buscar Nubank', 'Cadastrar conta', 'Ver comprovantes', 'Nova despesa', 'Abrir planejamento', 'Criar meta', 'Nova receita', 'Transferir entre contas', 'Novo orçamento', 'Nova assinatura'],
  search: ['Novo cartão', 'Nova despesa', 'Criar meta', 'Cadastrar conta', 'Nova receita', 'Abrir planejamento', 'Nova assinatura', 'Novo orçamento', 'Ver cartões', 'Transferir entre contas', 'Ver comprovantes', 'Novo contato'],
}
export function financialStarterExamples(scope: Scope, offset: number): string[] {
  const pool = STARTERS[scope] ?? STARTERS.search
  const index = Number.isFinite(offset) ? Math.abs(Math.trunc(offset)) % pool.length : 0
  return [0, 1, 2].map(step => pool[(index + step) % pool.length])
}
