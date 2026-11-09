/** R461 — notas de produto sem dados pessoais e sem supor versionCode futuro. */
export type FinanceReleaseNote = {
  version: string
  title: string
  changes: readonly string[]
}

export const FINANCE_RELEASE_NOTES: readonly FinanceReleaseNote[] = [
  {
    version: 'R461',
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
