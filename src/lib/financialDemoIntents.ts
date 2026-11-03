/** R434 — Fallback conservador para pedidos de cadastro em linguagem natural.
 * Nao consulta dados, nao preenche campos, nao executa gravacoes.
 * So libera rotas de formularios reais depois de um pedido de criacao explicito.
 */
import type { FinancialSearchCommand } from '@/lib/globalSearch'

const fold = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[!?.,:;]+$/g, '').replace(/\s+/g, ' ').trim()

type Destination = {
  id: string
  title: string
  href: string
  subject: RegExp
}

/** Ordem: especificidades antes de familias genericas. */
const DESTINATIONS: readonly Destination[] = [
  { id: 'new-receivable', title: 'Cadastrar valor a receber', href: '/debts/new', subject: /^(?:valor a receber|conta a receber|divida a receber|devedor)(?:\s+(.+))?$/ },
  { id: 'new-card', title: 'Cadastrar cartão', href: '/cards/new', subject: /^(?:cartao(?: de credito| de debito| bancario)?)(?:\s+(.+))?$/ },
  { id: 'new-account', title: 'Cadastrar conta', href: '/accounts/new', subject: /^(?:conta(?: bancaria| corrente| digital| poupanca)?|conta de banco)(?:\s+(.+))?$/ },
  { id: 'new-goal', title: 'Criar meta', href: '/goals/new', subject: /^(?:meta(?: financeira| de economia)?|objetivo(?: financeiro| de economia)?)(?:\s+(.+))?$/ },
  { id: 'new-budget', title: 'Criar orçamento', href: '/budgets/new', subject: /^(?:orcamento(?: mensal| financeiro)?|limite de gastos)(?:\s+(.+))?$/ },
  { id: 'new-contact', title: 'Cadastrar contato', href: '/contacts/new', subject: /^(?:contato|cliente|fornecedor)(?:\s+(.+))?$/ },
  { id: 'new-subscription', title: 'Cadastrar assinatura', href: '/subscriptions/new', subject: /^(?:assinatura|recorrencia|despesa recorrente)(?:\s+(.+))?$/ },
  { id: 'new-loan', title: 'Cadastrar empréstimo', href: '/loans/new', subject: /^(?:emprestimo)(?:\s+(.+))?$/ },
  { id: 'new-financing', title: 'Cadastrar financiamento', href: '/financings/new', subject: /^(?:financiamento)(?:\s+(.+))?$/ },
  { id: 'manage-category', title: 'Abrir categorias', href: '/categories', subject: /^(?:categoria(?: de despesa| de receita)?)(?:\s+(.+))?$/ },
]

const VERB = /^(?:(?:por favor|eu|quero|preciso|gostaria de|pode|poderia|voce pode|me ajuda a|tem como)\s+){0,3}(?:criar|crie|cadastrar|cadastre|adicionar|adicione|registrar|registre|abrir cadastro de|fazer|montar|novo|nova)\s+(.+)$/
const FORBIDDEN = /\b(?:excluir|exclua|apagar|apague|deletar|delete|editar|edite|alterar|altere|cancelar|cancele|pagar|pague|transferir|transferencia|enviar|exibir|buscar|pesquisar|listar|comparar|historico|extrato|quanto|saldo|fatura|comprovante|movimentacao)\b/
const MULTIPLE = /\b(?:e|ou|tambem|varios|varias|duas|dois)\b/

/** Qualificadores sao apenas descricao do pedido; o cadastro nunca eh preenchido com eles. */
function safeQualifier(text: string | undefined): boolean {
  if (!text) return true
  if (text === 'novo' || text === 'nova') return true
  if (text.length > 55 || FORBIDDEN.test(text) || MULTIPLE.test(text)) return false
  if (!/^[a-z0-9][a-z0-9\- /]*$/.test(text)) return false
  return text.replace(/^(?:de|do|da|no|na|para|chamado|chamada)\s+/, '').trim().length >= 2
}

export function resolveFinancialDemoIntent(input: string): FinancialSearchCommand | null {
  const q = fold(input)
  if (!q || q.length > 180 || FORBIDDEN.test(q) || MULTIPLE.test(q)) return null
  const match = q.match(VERB)
  if (!match) return null
  const subject = match[1].replace(/^(?:(?:um|uma|o|a|meu|minha|novo|nova)\s+){0,3}/, '').trim()
  const available = DESTINATIONS.filter(item => {
    if (item.id === 'new-account' && /^conta a receber\b/.test(subject)) return false
    const result = subject.match(item.subject)
    return Boolean(result && safeQualifier(result[1]))
  })
  // Nunca escolher entre entidades diferentes quando ha ambiguidade.
  if (available.length !== 1) return null
  const action = available[0]
  return {
    id: action.id, title: action.title, href: action.href, intent: 'create',
    description: 'Abrir o formulário e preencher os dados manualmente. Nenhum cadastro é salvo agora.',
  }
}

/** Casos reais para homologacao, sem depender de dados financeiros cadastrados. */
export const FINANCIAL_DEMO_SAMPLES = [
  'Novo cartão',
  'Cadastrar uma conta',
  'Nova despesa',
  'Ver cartões',
  'Quanto gastei hoje?',
  'Faturas em aberto',
  'Quanto tenho para receber?',
  'Comparar despesas de outubro com novembro',
] as const
