/**
 * R428 — comandos totalmente reconhecidos, sem necessidade de varrer o IndexedDB.
 * Apenas frases exatas e IDs de ações já reconhecidos pelo motor existente.
 * Nenhuma transação é criada ou modificada por esta política.
 */
const COMMAND_ONLY: Readonly<Record<string, string>> = {
  'nova despesa': 'new-expense',
  'criar despesa': 'new-expense',
  'adicionar despesa': 'new-expense',
  'registrar despesa': 'new-expense',
  'nova receita': 'new-income',
  'criar receita': 'new-income',
  'adicionar receita': 'new-income',
  'registrar receita': 'new-income',
  'transferir entre contas': 'transfer',
  'abrir conciliação': 'inbox',
  'abrir conciliacao': 'inbox',
  'abrir planejamento': 'planning',
  'ver comprovantes': 'receipts',
}

export function isFinancialCommandOnlyQuery(
  input: string,
  resolvedCommandIds: readonly string[]
): boolean {
  const text = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()
  const commandId = COMMAND_ONLY[text]
  return typeof commandId === 'string' && resolvedCommandIds.includes(commandId)
}
