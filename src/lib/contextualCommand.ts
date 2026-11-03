/** R417 — UI contextual deterministica. Sem consultas, saldos inventados ou gravacoes. */
export type ContextualCommandScope = 'home' | 'transactions' | 'analysis' | 'cards'
export type ContextualShortcut = {
  label: string
  kind: 'route' | 'search'
  value: string
}
export type ContextualCommandConfig = {
  eyebrow: string
  examples: readonly string[]
  shortcuts: readonly ContextualShortcut[]
}
export const CONTEXTUAL_COMMAND: Record<ContextualCommandScope, ContextualCommandConfig> = {
  home: {
    eyebrow: 'DFL Comando',
    examples: ['Nova despesa', 'Novo cartão', 'Criar meta', 'Cadastrar conta', 'Nova receita', 'Nova assinatura', 'Novo orçamento', 'Adicionar contato', 'Ver pendências', 'Abrir planejamento', 'Novo empréstimo', 'Ver cartões'],
    shortcuts: [
      { label: 'Nova despesa', kind: 'route', value: '/transactions/new?type=expense' },
      { label: 'Pendências', kind: 'route', value: '/conciliation' },
    ],
  },
  transactions: {
    eyebrow: 'Comando do extrato',
    examples: ['Nova despesa', 'Transferir entre contas', 'Buscar mercado', 'Nova receita', 'Abrir conciliação', 'Ver comprovantes', 'Novo cartão', 'Cadastrar conta', 'Nova assinatura', 'Abrir planejamento', 'Criar meta', 'Ver cartões'],
    shortcuts: [
      { label: 'Buscar mercado', kind: 'search', value: 'mercado' },
      { label: 'Transferir', kind: 'route', value: '/transactions?action=transfer' },
    ],
  },
  analysis: {
    eyebrow: 'Comando de análises',
    examples: ['Abrir planejamento', 'Criar meta', 'Novo orçamento', 'Ver comprovantes', 'Nova assinatura', 'Novo empréstimo', 'Ver cartões', 'Abrir conciliação', 'Nova despesa', 'Nova receita', 'Novo financiamento', 'Cadastrar conta'],
    shortcuts: [
      { label: 'Planejamento', kind: 'route', value: '/projections' },
      { label: 'Relatórios', kind: 'route', value: '/reports' },
    ],
  },
  cards: {
    eyebrow: 'Comando de cartões',
    examples: ['Novo cartão', 'Ver cartões', 'Buscar Nubank', 'Cadastrar conta', 'Ver comprovantes', 'Nova despesa', 'Abrir planejamento', 'Criar meta', 'Nova receita', 'Transferir entre contas', 'Novo orçamento', 'Nova assinatura'],
    shortcuts: [
      { label: 'Buscar Nubank', kind: 'search', value: 'Nubank' },
      { label: 'Comprovantes', kind: 'route', value: '/receipts' },
    ],
  },
}
const ALLOWED = new Set([
  '/transactions/new?type=expense',
  '/transactions?action=transfer',
  '/conciliation',
  '/projections',
  '/reports',
  '/receipts',
])
export function safeContextualRoute(shortcut: ContextualShortcut): string | null {
  return shortcut.kind === 'search' ? '/search' : ALLOWED.has(shortcut.value) ? shortcut.value : null
}
