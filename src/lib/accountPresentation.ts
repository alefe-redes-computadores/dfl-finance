// src/lib/accountPresentation.ts
export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Conta Corrente',
  savings: 'Poupança',
  digital: 'Conta Digital',
  investment: 'Investimento',
  credit_card: 'Cartão de Crédito',
  wallet: 'Carteira',
  other: 'Outro',
}

export {
  COMMON_BANKS,
  canonicalizeBankName,
  normalizeBankKey,
} from '@/lib/bankRegistry'

import { canonicalizeBankName } from '@/lib/bankRegistry'

export function getAccountTypeLabel(type?: string | null) {
  return ACCOUNT_TYPE_LABELS[type || ''] || type || 'Conta'
}

export function getAccountInstitutionLabel(account: { bank?: string | null; type?: string | null }) {
  const bank = canonicalizeBankName(account.bank)
  if (bank) return bank
  if (account.type === 'wallet') return 'Carteira'
  if (account.type === 'digital') return 'Conta Digital'
  return 'Sem instituição'
}

export function isAccountArchived(account: { is_archived?: boolean | null }) {
  return account.is_archived === true
}

export function sortAccountsByBalance<T extends { balance?: number | null; name?: string | null }>(accounts: T[]) {
  return [...accounts].sort((a, b) => {
    const balanceDiff = Number(b.balance || 0) - Number(a.balance || 0)
    if (balanceDiff !== 0) return balanceDiff
    return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
  })
}

export function sortAccountsAlphabetically<T extends { name?: string | null }>(accounts: T[]) {
  return [...accounts].sort((a, b) =>
    String(a.name || '').localeCompare(
      String(b.name || ''),
      'pt-BR',
      { sensitivity: 'base' }
    )
  )
}

export function groupAccountsByInstitution<T extends { bank?: string | null; type?: string | null; balance?: number | null; name?: string | null }>(
  accounts: T[],
  preserveInputOrder = false
) {
  const groups = new Map<string, T[]>()

  for (const account of accounts) {
    const label = getAccountInstitutionLabel(account)
    const current = groups.get(label) || []
    current.push(account)
    groups.set(label, current)
  }

  const result = Array.from(groups.entries())
    .map(([institution, items]) => ({
      institution,
      accounts: preserveInputOrder
        ? [...items]
        : sortAccountsAlphabetically(items),
      balance: items.reduce(
        (sum, item) => sum + Number(item.balance || 0),
        0
      ),
    }))

  if (preserveInputOrder) return result

  return result.sort((a, b) =>
    a.institution.localeCompare(
      b.institution,
      'pt-BR',
      { sensitivity: 'base' }
    )
  )
}
