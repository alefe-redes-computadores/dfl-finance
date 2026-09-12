// src/lib/accountPresentation.ts
export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Conta Corrente',
  savings: 'Poupança',
  investment: 'Investimento',
  credit_card: 'Cartão de Crédito',
  wallet: 'Carteira',
  other: 'Outro',
}

export const COMMON_BANKS = [
  'Nubank',
  'Inter',
  'Itaú',
  'Bradesco',
  'Santander',
  'Banco do Brasil',
  'Caixa',
  'C6 Bank',
  'PicPay',
  'PagBank',
  'Mercado Pago',
  'Stone',
  'iFood Pago',
  'InfinitePay',
  'Safra',
  'Original',
  'Next',
  'Will Bank',
  'Agibank',
  'Digio Bank',
  'Neon',
  'BS2',
  'Cora',
  'Ton',
  'Banco PAN',
  'Banrisul',
  'BMG',
  'Daycoval',
  'BRB',
  'Banco do Nordeste',
  'Sicoob',
  'Sicredi',
  'Unicred',
  'XP',
  'BTG Pactual',
  'Rico',
  'Genial',
  'Mercantil',
  'Banco Sofisa',
] as const

const BANK_ALIASES: Record<string, string> = {
  nubank: 'Nubank',
  nu: 'Nubank',
  inter: 'Inter',
  'banco inter': 'Inter',
  itau: 'Itaú',
  'itaú': 'Itaú',
  bradesco: 'Bradesco',
  santander: 'Santander',
  'banco do brasil': 'Banco do Brasil',
  bb: 'Banco do Brasil',
  caixa: 'Caixa',
  'caixa economica federal': 'Caixa',
  'caixa econômica federal': 'Caixa',
  c6: 'C6 Bank',
  'c6 bank': 'C6 Bank',
  picpay: 'PicPay',
  pagbank: 'PagBank',
  'pag bank': 'PagBank',
  pagseguro: 'PagBank',
  'mercado pago': 'Mercado Pago',
  mercadopago: 'Mercado Pago',
  stone: 'Stone',
  ifood: 'iFood Pago',
  'ifood pago': 'iFood Pago',
  cloudwalk: 'InfinitePay',
  infinitepay: 'InfinitePay',
  infinitypay: 'InfinitePay',
  infinitpay: 'InfinitePay',
  'infinite pay': 'InfinitePay',
  safra: 'Safra',
  original: 'Original',
  next: 'Next',
  will: 'Will Bank',
  'will bank': 'Will Bank',
  agibank: 'Agibank',
  digio: 'Digio Bank',
  'digio bank': 'Digio Bank',
  neon: 'Neon',
  bs2: 'BS2',
  cora: 'Cora',
  ton: 'Ton',
  pan: 'Banco PAN',
  'banco pan': 'Banco PAN',
  banrisul: 'Banrisul',
  bmg: 'BMG',
  daycoval: 'Daycoval',
  brb: 'BRB',
  bnb: 'Banco do Nordeste',
  'banco do nordeste': 'Banco do Nordeste',
  sicoob: 'Sicoob',
  sicredi: 'Sicredi',
  unicred: 'Unicred',
  xp: 'XP',
  'xp investimentos': 'XP',
  btg: 'BTG Pactual',
  'btg pactual': 'BTG Pactual',
  rico: 'Rico',
  genial: 'Genial',
  'genial investimentos': 'Genial',
  mercantil: 'Mercantil',
  'banco mercantil': 'Mercantil',
  'mercantil do brasil': 'Mercantil',
  sofisa: 'Banco Sofisa',
  'sofisa direto': 'Banco Sofisa',
  'banco sofisa': 'Banco Sofisa',
}

export function normalizeBankKey(value?: string | null) {
  return (value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
}

export function canonicalizeBankName(value?: string | null) {
  const trimmed = (value || '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return ''
  return BANK_ALIASES[normalizeBankKey(trimmed)] || trimmed
}

export function getAccountTypeLabel(type?: string | null) {
  return ACCOUNT_TYPE_LABELS[type || ''] || type || 'Conta'
}

export function getAccountInstitutionLabel(account: { bank?: string | null; type?: string | null }) {
  const bank = canonicalizeBankName(account.bank)
  if (bank) return bank
  if (account.type === 'wallet') return 'Carteira'
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

export function groupAccountsByInstitution<T extends { bank?: string | null; type?: string | null; balance?: number | null; name?: string | null }>(accounts: T[]) {
  const groups = new Map<string, T[]>()

  for (const account of accounts) {
    const label = getAccountInstitutionLabel(account)
    const current = groups.get(label) || []
    current.push(account)
    groups.set(label, current)
  }

  return Array.from(groups.entries())
    .map(([institution, items]) => ({
      institution,
      accounts: sortAccountsAlphabetically(items),
      balance: items.reduce((sum, item) => sum + Number(item.balance || 0), 0),
    }))
    .sort((a, b) =>
      a.institution.localeCompare(
        b.institution,
        'pt-BR',
        { sensitivity: 'base' }
      )
    )
}
