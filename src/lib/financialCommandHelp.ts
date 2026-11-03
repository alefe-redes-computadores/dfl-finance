/** R431 — ajuda local do DFL Comando. Catálogo fechado, sem rede ou escrita. */
export type FinancialHelpAction = { id: string; title: string; detail: string; href: string }
export type FinancialHelpTopic = {
  id: string
  title: string
  detail: string
  examples: readonly string[]
  actions: readonly FinancialHelpAction[]
  geminiHint?: string
}

const fold = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[!?.,;:]+$/g, '').replace(/\s+/g, ' ').trim()

const action = (id: string, title: string, detail: string, href: string): FinancialHelpAction => ({ id, title, detail, href })
const topics: Record<string, FinancialHelpTopic> = {
  overview: {
    id: 'overview', title: 'Como posso ajudar',
    detail: 'Use frases naturais para abrir áreas, preparar lançamentos, consultar números realizados ou localizar registros. Toda movimentação continua exigindo revisão.',
    examples: ['Nova despesa', 'Quanto gastei este mês?', 'Transferir entre contas', 'Ver pendências'],
    actions: [
      action('transactions', 'Lançar e consultar', 'Receitas, despesas e extrato', '/transactions'),
      action('inbox', 'Revisar pendências', 'Inbox financeira e conciliação', '/conciliation'),
      action('planning', 'Planejar', 'Compromissos e próximos passos', '/planning'),
      action('analysis', 'Entender os números', 'Análises e Centro Financeiro', '/analysis'),
    ],
    geminiHint: 'Perguntas abertas, explicações e comparações podem continuar no Gemini após sua confirmação.',
  },
  launch: {
    id: 'launch', title: 'Registrar receitas e despesas',
    detail: 'Diga “nova despesa” ou “nova receita”. O DFL abre o formulário correspondente; escrever a frase nunca salva nem altera saldo sozinho.',
    examples: ['Nova despesa', 'Nova receita', 'Cadastrar despesa recorrente'],
    actions: [action('expense', 'Nova despesa', 'Abrir formulário completo', '/transactions/new?type=expense'), action('income', 'Nova receita', 'Abrir formulário completo', '/transactions/new?type=income')],
  },
  transfer: {
    id: 'transfer', title: 'Transferir entre contas',
    detail: 'A transferência é um movimento único com duas pernas vinculadas. Escolha origem, destino e valor e revise antes de confirmar.',
    examples: ['Transferir entre contas', 'Ver transferências'],
    actions: [action('transfer', 'Preparar transferência', 'Abrir fluxo protegido', '/transactions/new?type=transfer'), action('transactions', 'Ver movimentações', 'Consultar o histórico', '/transactions')],
  },
  inbox: {
    id: 'inbox', title: 'Revisar e conciliar',
    detail: 'WhatsApp, comprovantes, importações e pendências atuais ficam na Inbox para sua decisão. Itens futuros normais continuam no Planejamento.',
    examples: ['Ver pendências', 'Abrir Inbox financeira', 'O que preciso revisar?'],
    actions: [action('inbox', 'Abrir Inbox', 'Revisar antes de efetivar', '/conciliation'), action('planning', 'Ver Planejamento', 'Consultar o que ainda é futuro', '/planning')],
  },
  receipts: {
    id: 'receipts', title: 'Usar comprovantes',
    detail: 'A Central reúne anexos financeiros vinculados. Uma mídia isolada não deve virar comprovante nem movimentar saldo sem contexto e revisão.',
    examples: ['Ver comprovantes', 'Buscar recibo de outubro'],
    actions: [action('receipts', 'Abrir comprovantes', 'Consultar anexos financeiros', '/receipts'), action('inbox', 'Revisar automações', 'Conferir itens recebidos', '/conciliation')],
  },
  cards: {
    id: 'cards', title: 'Cartões e faturas',
    detail: 'Cadastre o cartão, registre compras e acompanhe faturas. Compra e pagamento de fatura têm papéis diferentes para evitar dupla contagem.',
    examples: ['Novo cartão', 'Ver cartões', 'Buscar Nubank'],
    actions: [action('cards', 'Ver cartões', 'Consultar cartões e faturas', '/cards'), action('new-card', 'Cadastrar cartão', 'Abrir formulário completo', '/cards/new')],
  },
  planning: {
    id: 'planning', title: 'Planejamento e projeções',
    detail: 'Use Planejamento para compromissos futuros e Análise para tendências e cenários. Valores conhecidos e estimados continuam identificados separadamente.',
    examples: ['Abrir planejamento', 'Como estão minhas finanças?', 'Criar meta'],
    actions: [action('planning', 'Abrir Planejamento', 'Ver compromissos futuros', '/planning'), action('analysis', 'Abrir Análise', 'Explorar projeções e cenários', '/analysis')],
    geminiHint: 'Use o Gemini para perguntas abertas sobre causas, alternativas e comparações.',
  },
  organize: {
    id: 'organize', title: 'Organizar categorias e recorrências',
    detail: 'Categorias classificam lançamentos; assinaturas e recorrências representam compromissos repetidos. Alterações continuam em telas próprias.',
    examples: ['Nova categoria', 'Nova assinatura', 'Ver assinaturas'],
    actions: [action('categories', 'Ver categorias', 'Organizar classificações', '/categories'), action('subscriptions', 'Ver assinaturas', 'Acompanhar recorrências', '/subscriptions')],
  },
  search: {
    id: 'search', title: 'Encontrar informações',
    detail: 'Busque descrição, valor, conta, categoria, mês ou ano. Você também pode combinar termos, como “mercado outubro” ou “InfinitePay 2026”.',
    examples: ['Mercado outubro', 'InfinitePay novembro de 2026', 'R$ 159,80'],
    actions: [action('transactions', 'Abrir extrato', 'Usar filtros completos', '/transactions'), action('receipts', 'Ver comprovantes', 'Consultar anexos', '/receipts')],
  },
  assistant: {
    id: 'assistant', title: 'Quando usar o Gemini',
    detail: 'O DFL Comando resolve rotas, buscas e cálculos verificáveis localmente. O Gemini entra em perguntas abertas, explicações e comparações, sempre depois do seu toque.',
    examples: ['Por que meus gastos aumentaram?', 'Compare outubro com novembro', 'Como posso economizar?'],
    actions: [action('assistant', 'Abrir Assistente', 'Revisar a pergunta antes de enviar', '/assistant/chat')],
    geminiHint: 'O Gemini não recebe a frase nem executa movimentações sem uma ação explícita sua.',
  },
}

export function resolveFinancialHelp(input: string): FinancialHelpTopic | null {
  if (!input || input.length > 240) return null
  const q = fold(input)
  if (/^(?:oi|ola|bom dia|boa tarde|boa noite|ajuda|me ajuda|preciso de ajuda|como usar|como funciona|o que (?:voce|o dfl) faz|o que posso fazer aqui|quais comandos|comandos disponiveis|mostrar? exemplos?)$/.test(q)) return topics.overview
  if (/^(?:quando|como).*(?:gemini|assistente)/.test(q)) return topics.assistant
  if (/^(?:(?:me )?ajud[ae] (?:a|com)|como|onde|o que e)\s+/.test(q) || /^(?:como|onde)\b/.test(q)) {
    if (/despesa|receita|lancamento|registrar|cadastrar gasto/.test(q)) return topics.launch
    if (/transfer/.test(q)) return topics.transfer
    if (/concili|inbox|pendencia|revis/.test(q)) return topics.inbox
    if (/comprovante|recibo|anexo/.test(q)) return topics.receipts
    if (/cartao|fatura/.test(q)) return topics.cards
    if (/planejamento|projecao|cenario|meta|orcamento/.test(q)) return topics.planning
    if (/categoria|assinatura|recorrencia/.test(q)) return topics.organize
    if (/buscar|pesquisar|encontrar|localizar/.test(q)) return topics.search
    if (/gemini|assistente|inteligencia|pergunta aberta/.test(q)) return topics.assistant
  }
  if (/^(?:falar|conversar|perguntar) (?:com|ao) (?:o )?(?:gemini|assistente)$/.test(q)) return topics.assistant
  return null
}
