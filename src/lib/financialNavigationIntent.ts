/**
 * R418 — roteador deterministico de navegacao financeira.
 * So sugere rotas conhecidas. Nunca grava, consulta valores ou altera contexto PF/PJ.
 * Perguntas analiticas e entidades ambiguas permanecem na Busca Global.
 */
import { parseDateIntent } from '@/lib/globalSearch'
import { interpretFinancialInput } from '@/lib/smartFinancialInput'

export type FinancialNavigationIntent = {
  kind: 'navigate' | 'filter'
  title: string
  description: string
  href: string
}

const fold = (text: string) => text.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[?!.,:;]+$/g, '')
  .replace(/\s+/g, ' ')
  .trim()

// Uma ordem explicita e obrigatoria; consultas como "quanto gastei?" nao sao atalhos.
const ACTION = /^(?:(?:por favor[, ]*)?(?:abra|abre|abrir|acesse|acessa|acessar|entre|entrar|ir|vai|va|me leva|me mostre|me mostra|mostre|mostra|mostrar|quero ver|ver|visualizar|exibir|exiba|listar|lista|filtrar|filtra|consulte|consultar))\b/
const MONTH = /^20\d{2}-(?:0[1-9]|1[0-2])$/
export function isAllowedFinancialMonth(month: string | null): month is string {
  return !!month && MONTH.test(month)
}

const MENU: ReadonlyArray<{ label: string; href: string; words: RegExp }> = [
  { label: 'Cartões', href: '/cards', words: /\b(cartoes|cartao|faturas?)\b/ },
  { label: 'Contas', href: '/accounts', words: /\b(contas|conta bancaria|contas bancarias)\b/ },
  { label: 'Análises', href: '/analysis', words: /\b(analise|analises|dashboard|indicadores)\b/ },
  { label: 'Conciliação', href: '/conciliation', words: /\b(conciliacao|inbox|revisao financeira|pendencias?)\b/ },
  { label: 'Planejamento', href: '/planning', words: /\b(planejamento|planejar|plano financeiro)\b/ },
  { label: 'Projeções', href: '/projections', words: /\b(projecoes|projecao|previsao financeira)\b/ },
  { label: 'Relatórios', href: '/reports', words: /\b(relatorios?|relatorio financeiro)\b/ },
  { label: 'Assinaturas', href: '/subscriptions', words: /\b(assinaturas?|recorrencias?)\b/ },
  { label: 'Metas', href: '/goals', words: /\b(metas?|objetivos financeiros)\b/ },
  { label: 'Categorias', href: '/categories', words: /\b(categorias?)\b/ },
  { label: 'Dívidas', href: '/debts', words: /\b(dividas?|devedores?)\b/ },
  { label: 'Empréstimos', href: '/loans', words: /\b(emprestimos?)\b/ },
  { label: 'Comprovantes', href: '/receipts', words: /\b(comprovantes?|recibos?|anexos?)\b/ },
  { label: 'Agenda financeira', href: '/agenda', words: /\b(agenda|calendario financeiro)\b/ },
  { label: 'Notificações', href: '/notifications', words: /\b(notificacoes?|alertas?)\b/ },
  { label: 'Configurações', href: '/settings', words: /\b(configuracoes?|preferencias?)\b/ },
]

/** Caso o pedido cite uma entidade especifica, nao fingir ter selecionado a conta/cartao. */
function remainingTokens(value: string): string {
  return value
    .replace(ACTION, ' ')
    .replace(/\b(extrato|transacoes?|movimentacoes?|despesas?|gastos?|saidas?|receitas?|entradas?|recebimentos?|pagamentos?|transferencias?|pendentes?)\b/g, ' ')
    .replace(/\b(hoje|ontem|anteontem|amanha|este mes|esse mes|mes atual|deste mes|nesse mes)\b/g, ' ')
    .replace(/\b(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|0?[1-9]|1[0-2])\/(?:20\d{2}|\d{2})\b/g, ' ')
    .replace(/\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/g, ' ')
    .replace(/\b(20\d{2})\b/g, ' ')
    .replace(/\b(?:de|do|da|no|na|em|nos|nas|para|pra|pro|ao|aos|o|a|os|as|meu|minha|meus|minhas|pelo|pela|por|mes|ano)\b/g, ' ')
    .replace(/[\s/-]+/g, ' ')
    .trim()
}

export function resolveFinancialNavigationIntent(input: string, reference = new Date()): FinancialNavigationIntent | null {
  const raw = input.trim().slice(0, 240)
  const q = fold(raw)
  if (!q || !ACTION.test(q)) return null
  // Lancamentos continuam no motor R411 e sempre exigem confirmacao.
  if (interpretFinancialInput(raw, reference)) return null
  if (/\b(transferir|transferencia entre|fazer transferencia|nova transferencia)\b/.test(q) &&
      !/\b(extrato|transacoes|movimentacoes)\b/.test(q)) return null

  const transactionSubject = /\b(extrato|transacoes?|movimentacoes?|despesas?|gastos?|saidas?|receitas?|entradas?|recebimentos?|pagamentos?|transferencias?)\b/.test(q)
  if (transactionSubject) {
    // Nao eliminar silenciosamente um filtro de conta, categoria ou contato.
    if (remainingTokens(q)) return null
    // R418-R2: 'abrir' nao e 'abril'.
    // Mes exige mencao explicita.
    const periodText = q.replace(ACTION, '').trim()
    const hasExplicitMonth = /\b(?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/.test(periodText)
      || /\b(?:0?[1-9]|1[0-2])\/(?:20\d{2}|\d{2})\b/.test(periodText)
    const date = hasExplicitMonth
      ? parseDateIntent(periodText, reference)
      : null
    if (hasExplicitMonth && !date) return null
    let month: string | null = null
    if (date) {
      const candidate = date.start.slice(0, 7)
      if (!isAllowedFinancialMonth(candidate) || date.end.slice(0, 7) !== candidate ||
          date.start !== `${candidate}-01` ||
          date.end !== `${candidate}-${String(new Date(Number(candidate.slice(0, 4)), Number(candidate.slice(5, 7)), 0).getDate()).padStart(2, '0')}`) return null
      month = candidate
    } else if (/\b20\d{2}\b|\b(?:ontem|hoje|anteontem|amanha)\b/.test(q)) return null

    const filter = /\b(despesas?|gastos?|saidas?|pagamentos?)\b/.test(q) ? 'expense'
      : /\b(receitas?|entradas?|recebimentos?)\b/.test(q) ? 'income'
      : /\b(transferencias?)\b/.test(q) ? 'transfer' : 'all'
    const label = filter === 'expense' ? 'Despesas' : filter === 'income' ? 'Receitas'
      : filter === 'transfer' ? 'Transferências' : 'Transações'
    const params = new URLSearchParams()
    params.set('filter', filter)
    if (month) params.set('month', month)
    const description = month
      ? `Extrato filtrado por ${new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 15, 12).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}. Contexto Empresa/Pessoal preservado.`
      : 'Abrir o extrato com o filtro selecionado, sem alterar movimentações.'
    return { kind: 'filter', title: `Ver ${label.toLowerCase()}${month ? ' do período' : ''}`, description, href: `/transactions?${params.toString()}` }
  }

  const matches = MENU.filter(item => item.words.test(q))
  if (matches.length !== 1) return null
  const matched = matches[0]
  // Permitir frases simples de navegacao, mas nunca inserir texto arbitrario em URLs.
  if (/\b(?:excluir|apagar|pagar|transferir|alterar|editar|baixar|criar|registrar|deletar)\b/.test(q)) return null
  return { kind: 'navigate', title: `Abrir ${matched.label}`, description: 'Ir para a área correspondente. Nenhum dado financeiro será alterado.', href: matched.href }
}
