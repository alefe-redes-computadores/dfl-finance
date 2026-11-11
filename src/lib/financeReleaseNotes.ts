/** R461 — notas de produto sem dados pessoais e sem supor versionCode futuro. */
export type FinanceReleaseNote = {
  version: string
  title: string
  changes: readonly string[]
}

export const FINANCE_RELEASE_NOTES: readonly FinanceReleaseNote[] = [
  {
    version: 'R467',
    title: 'Atualizações 360: avisos e download com controle',
    changes: [
      'Aviso Android opcional de nova versão certificada, uma vez por build e com acesso à Central de Atualizações.',
      'Progresso em MB e porcentagem com cancelamento efetivo do download nativo.',
      'Atualização automática, integridade SHA-256 e confirmação do Android preservadas.',
    ],
  },
  {
    version: 'R466',
    title: 'Atualização do APK com retorno automático',
    changes: [
      'Ao voltar das permissões do Android, o Finance retoma a instalação pendente sem novo download.',
      'Um botão principal por etapa e mensagens de instalação mais claras.',
      'Permanece a verificação nativa do APK e a confirmação obrigatória do Android.',
    ],
  },
  {
    version: 'R465',
    title: 'Obrigações MEI e organização do aplicativo',
    changes: [
      'Mais reorganizado: empresas, planejamento, inteligência e sistema.',
      'Enquadramento tributário e DAS mensal com conferência manual, sem alterar saldos.',
      'Lembretes financeiros separados de fiscais e histórico de avisos com rolagem corrigida.',
      'Próximo APK elegível a testar a atualização nativa inaugurada na R464.',
    ],
  },
  {
    version: 'R464',
    title: 'Atualizações nativas dentro do aplicativo',
    changes: [
      'Download direto e verificado de APK aprovado, com progresso dentro do Finance.',
      'Instalação aberta pelo Android após conferir SHA-256, versão, pacote e assinatura.',
      'Distribuição durável pelo GitHub Releases e alternativa manual preservada.',
    ],
  },
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
