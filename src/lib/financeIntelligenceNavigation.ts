// V179 — Catálogo estático das ferramentas financeiras.
// Não importa motores financeiros nem acessa dados do usuário.

export type IntelligenceGroupId =
  | 'understand'
  | 'review'
  | 'anticipate'
  | 'plan'

export type IntelligenceLink = {
  id: string
  title: string
  description: string
  href: string
  tag: string
}

export type IntelligenceGroup = {
  id: IntelligenceGroupId
  title: string
  description: string
  links: IntelligenceLink[]
}

export const intelligenceGroups: IntelligenceGroup[] = [
  {
    id: 'understand',
    title: 'Entender meu dinheiro',
    description: 'Comportamento, estabilidade e histórico.',
    links: [
      {
        id: 'health',
        title: 'Saúde Financeira',
        description: 'O que merece atenção, com critérios explicáveis.',
        href: '/financial-health',
        tag: 'V176'
      },
      {
        id: 'trends',
        title: 'Tendências Financeiras',
        description: 'Receitas, despesas e histórico de seis meses.',
        href: '/financial-trends',
        tag: 'V177'
      },
      {
        id: 'reports',
        title: 'Relatórios',
        description: 'Investigar os números com mais detalhes.',
        href: '/reports',
        tag: 'Análise'
      }
    ]
  },
  {
    id: 'review',
    title: 'Conferir e fechar',
    description: 'Revisar lançamentos antes de confiar nos resultados.',
    links: [
      {
        id: 'monthly',
        title: 'Revisão Mensal',
        description: 'Recebido, gasto, cartão e comparação mensal.',
        href: '/monthly-review',
        tag: 'V175'
      },
      {
        id: 'review',
        title: 'Central de Revisão',
        description: 'Possíveis duplicações e dados incompletos.',
        href: '/review',
        tag: 'V169'
      },
      {
        id: 'conciliation',
        title: 'Conciliação',
        description: 'Conferir importações e pendências.',
        href: '/conciliation',
        tag: 'Inbox'
      }
    ]
  },
  {
    id: 'anticipate',
    title: 'Antecipar compromissos',
    description: 'O que pode afetar o caixa nos próximos dias.',
    links: [
      {
        id: 'commitments',
        title: 'Compromissos e Caixa',
        description: 'Obrigações, recebíveis e prioridades.',
        href: '/commitment-center',
        tag: 'V178'
      },
      {
        id: 'agenda',
        title: 'Agenda Financeira 360',
        description: 'Vencimentos conhecidos e planejamento separado.',
        href: '/agenda',
        tag: 'V170'
      },
      {
        id: 'pressure',
        title: 'Radar de Fôlego',
        description: 'Cenários conservadores para 7, 30 e 90 dias.',
        href: '/cash-pressure',
        tag: 'V174'
      }
    ]
  },
  {
    id: 'plan',
    title: 'Planejar melhor',
    description: 'Limites, reservas e organização financeira.',
    links: [
      {
        id: 'planning',
        title: 'Planejamento Inteligente',
        description: 'Gastos fixos, flexíveis e reservas.',
        href: '/planning',
        tag: 'V173'
      },
      {
        id: 'pace',
        title: 'Ritmo Financeiro',
        description: 'Acompanhar o limite mensal de despesas.',
        href: '/spending-pulse',
        tag: 'V172'
      }
    ]
  }
]

export const getIntelligenceLink = (id: string) => {
  for (const group of intelligenceGroups) {
    const found = group.links.find(link => link.id === id)
    if (found) return found
  }
  return null
}

export const intelligenceRouteSet = () =>
  Array.from(new Set(
    intelligenceGroups.reduce<string[]>(
      (all, group) => all.concat(group.links.map(link => link.href)),
      []
    )
  ))
