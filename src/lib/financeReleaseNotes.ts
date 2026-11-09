/** R461 — notas de produto sem dados pessoais e sem supor versionCode futuro. */
export type FinanceReleaseNote = {
  version: string
  title: string
  changes: readonly string[]
}

export const FINANCE_RELEASE_NOTES: readonly FinanceReleaseNote[] = [
  {
    version: 'R463',
    title: 'Acabamento premium e rolagem das transações',
    changes: [
      'Transações: cabeçalho, comando, busca e filtros rolam junto da lista, sem esconder lançamentos.',
      'Home: card de saldo mais compacto e alinhado, mantendo privacidade e estado offline.',
      'Nova transação e Mais: espaçamento otimizado para operação em celular.',
      'Análises: comparação sem gráfico vazio artificial e projeções com eixo legível.',
    ],
  },
  {
    version: 'R462',
    title: 'Integridade comercial e comprovantes',
    changes: [
      'Conciliação comercial com identidade durável e repetição segura após falha de rede.',
      'Resumo comercial com paginação integral, bloqueio de totais incompletos e histórico progressivo.',
      'Compatibilidade de imagens JPEG/JFIF com OCR e proteção de links privados preservada.',
    ],
  },
  {
    version: 'R461 · APK #1048',
    title: 'Fechamento de segurança e transparência',
    changes: [
      'Leitura de comprovantes privados: link assinado, proprietário e origem validados.',
      'Compatibilidade de importação e OCR com o aplicativo Android.',
      'Proteções da publicação e histórico das atualizações documentados.',
    ],
  },
  {
    version: 'R460 · APK #1047',
    title: 'DFL Comando Turbo',
    changes: [
      'Busca financeira mais eficiente, com 13 fontes preservadas.',
      'Autocompletar melhorado e comparação de nomes com acentos.',
    ],
  },
  {
    version: 'R459 · APK #1046',
    title: 'Resumo inteligente e diagnósticos do APK',
    changes: [
      'Avisos locais inteligentes opcionais, sem ativação automática.',
      'Status de Action, falha e expiração de APK separados.',
    ],
  },
  {
    version: 'R458 · APK #1045',
    title: 'Observações financeiras explicáveis',
    changes: [
      'Observações com evidências, histórico, adiamento e frequência.',
    ],
  },
  {
    version: 'R457 · APK #1044',
    title: 'Central de Notificações 360',
    changes: [
      'Preferências, privacidade e lembretes nativos de vencimentos.',
    ],
  },
  {
    version: 'R456 · APK #1043',
    title: 'Atualizações do aplicativo',
    changes: [
      'Comparação com a versão Android instalada e disponibilidade do artefato.',
    ],
  },
]
