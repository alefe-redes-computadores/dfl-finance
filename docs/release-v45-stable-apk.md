# DFL Finance — V45 Stable APK Release Freeze

Estado: código congelado para candidato de APK estável.

## Contratos congelados

- Local-first: Dexie -> safe* -> syncQueue -> Supabase.
- Fila de sync com coalescência, revisão e confirmação/falha condicionada à revisão atual.
- Contas, cartões, transações, dívidas, empréstimos, financiamentos, assinaturas, metas, categorias e comprovantes preservam ownership e histórico.
- Categorias podem ser ocultadas/restauradas sem excluir o histórico.
- Datas financeiras civis usam helpers locais e não dependem de UTC para definir o dia.
- Projeção usa média histórica robusta e suavização estatística sem alterar o ledger.
- Notificações possuem destinos contextuais e replay estrutural de deep link.
- Central de Comprovantes mantém nome amigável, UUID técnico, visualização e limite de 10 MB.
- Android System Bars, launcher e plugins nativos permanecem congelados.

## Native Freeze

Não adicionar ou alterar plugins nativos, launcher, Gradle ou status bar antes do teste do candidato, salvo defeito comprovado em dispositivo.

## Banco

Migrações remotas até V44 aplicadas. Tabelas server-only sem contrato cliente permanecem fechadas para anon/authenticated.

## Próxima etapa

Gerar o candidato no pipeline Linux/GitHub Actions, instalar no aparelho e executar somente testes funcionais e nativos reais. Nova cirurgia somente diante de defeito reproduzível.
