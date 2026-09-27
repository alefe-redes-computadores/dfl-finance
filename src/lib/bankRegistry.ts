export type BankAssetProvenance =
  | 'project-existing'
  | 'official-source'
  | 'verified-brand-source'

export type BankAsset = {
  src: string
  background: string
  imageClassName: string
  provenance: BankAssetProvenance
  sourceHost?: string
}

export type BankRegulatoryIdentity = {
  code?: string
  ispb?: string
  verifiedBy?: 'bcb-str' | 'bcb-sml'
}

export type BankRegistryEntry = {
  id: string
  name: string
  aliases: readonly string[]
  color: string
  foreground?: string
  sigla: string
  kind?: string
  code?: string
  ispb?: string
  regulatory?: BankRegulatoryIdentity
  asset?: BankAsset
  featured?: boolean
}

export function normalizeBankKey(value?: string | null) {
  return (value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[._/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

const asset = (
  src: string,
  background: string,
  imageClassName: string,
  provenance: BankAssetProvenance = 'project-existing',
  sourceHost?: string,
): BankAsset => ({
  src,
  background,
  imageClassName,
  provenance,
  sourceHost,
})

export const BANK_REGISTRY: readonly BankRegistryEntry[] = [
  { id: 'nubank', name: 'Nubank', aliases: ['nu', 'nu pagamentos', 'nu pagamentos s.a.'], color: '#820AD1', foreground: '#FFFFFF', sigla: 'nu', kind: 'nubank', featured: true },
  { id: 'inter', name: 'Inter', aliases: ['banco inter'], color: '#FF7A00', foreground: '#FFFFFF', sigla: 'inter', kind: 'inter', featured: true },
  { id: 'itau', name: 'Itaú', ispb: '60701190', regulatory: { ispb: '60701190', verifiedBy: 'bcb-sml' }, aliases: ['itau', 'itaú unibanco', 'itau unibanco'], color: '#EC7000', foreground: '#FFFFFF', sigla: 'itaú', kind: 'itau', featured: true },
  { id: 'bradesco', name: 'Bradesco', ispb: '60746948', regulatory: { ispb: '60746948', verifiedBy: 'bcb-sml' }, aliases: ['banco bradesco'], color: '#CC092F', foreground: '#FFFFFF', sigla: 'bra', kind: 'bradesco', featured: true },
  { id: 'santander', name: 'Santander', ispb: '90400888', regulatory: { ispb: '90400888', verifiedBy: 'bcb-sml' }, aliases: ['santander brasil', 'banco santander'], color: '#EC0000', foreground: '#FFFFFF', sigla: 'san', kind: 'santander', featured: true },

  { id: 'bb', name: 'Banco do Brasil', aliases: ['bb', 'brasil', 'bco do brasil', 'banco brasil'], color: '#FFED00', foreground: '#003D7C', sigla: 'BB', kind: 'bb', code: '001', ispb: '00000000', regulatory: { code: '001', ispb: '00000000', verifiedBy: 'bcb-str' }, featured: true },
  { id: 'caixa', name: 'Caixa', aliases: ['cef', 'caixa econômica', 'caixa economica', 'caixa econômica federal', 'caixa economica federal'], color: '#005CA9', foreground: '#FFFFFF', sigla: 'CEF', kind: 'caixa', code: '104', ispb: '00360305', regulatory: { code: '104', ispb: '00360305', verifiedBy: 'bcb-str' }, featured: true },

  { id: 'c6', name: 'C6 Bank', aliases: ['c6'], color: '#151515', foreground: '#FFFFFF', sigla: 'C6', kind: 'c6', featured: true },

  {
    id: 'picpay',
    name: 'PicPay',
    aliases: ['pic pay'],
    color: '#21C25E',
    foreground: '#FFFFFF',
    sigla: 'P',
    kind: 'picpay',
    featured: true,
    asset: asset('/banks/picpay.svg', '#FFFFFF', 'h-[68%] w-[72%] object-cover object-left'),
  },

  {
    id: 'pagbank',
    name: 'PagBank',
    aliases: ['pag bank', 'pagseguro', 'pag seguro'],
    color: '#12B886',
    foreground: '#FFFFFF',
    sigla: 'pag',
    kind: 'pagbank',
    featured: true,
    asset: asset('/banks/pagbank.svg', '#FFFFFF', 'h-[72%] w-[72%] object-cover object-left'),
  },

  {
    id: 'mercado-pago',
    name: 'Mercado Pago',
    aliases: ['mercadopago', 'mercado livre pagamentos'],
    color: '#00AEEF',
    foreground: '#FFFFFF',
    sigla: 'MP',
    kind: 'mercadopago',
    featured: true,
    asset: asset('/banks/mercado-pago.svg', '#00AEEF', 'h-[58%] w-[58%] object-contain brightness-0 invert'),
  },

  {
    id: 'stone',
    name: 'Stone',
    aliases: ['stone pagamentos'],
    color: '#00A868',
    foreground: '#FFFFFF',
    sigla: 'stone',
    kind: 'stone',
    featured: true,
    asset: asset('/banks/stone.svg', '#FFFFFF', 'h-[64%] w-[78%] object-cover object-left'),
  },

  { id: 'ifood-pago', name: 'iFood Pago', aliases: ['ifood', 'ifood pagamentos'], color: '#EA1D2C', foreground: '#FFFFFF', sigla: 'iFood', kind: 'ifood', featured: true },
  { id: 'infinitepay', name: 'InfinitePay', aliases: ['cloudwalk', 'infinite pay', 'infinitypay', 'infinitpay'], color: '#101827', foreground: '#FFFFFF', sigla: '∞', kind: 'cloudwalk', featured: true },

  { id: 'safra', name: 'Safra', aliases: ['banco safra'], color: '#0B1836', foreground: '#FFFFFF', sigla: 'SAF', kind: 'wordmark' },
  { id: 'original', name: 'Original', aliases: ['banco original'], color: '#00A651', foreground: '#FFFFFF', sigla: 'ORI', kind: 'wordmark' },
  { id: 'next', name: 'Next', aliases: ['banco next'], color: '#101010', foreground: '#00FF5F', sigla: 'next', kind: 'wordmark' },
  { id: 'will', name: 'Will Bank', aliases: ['will'], color: '#F7DF1E', foreground: '#121212', sigla: 'will', kind: 'wordmark' },
  { id: 'agibank', name: 'Agibank', aliases: ['agi bank'], color: '#003D3B', foreground: '#FFFFFF', sigla: 'agi', kind: 'wordmark' },
  { id: 'digio', name: 'Digio Bank', aliases: ['digio'], color: '#4756FF', foreground: '#FFFFFF', sigla: 'digio', kind: 'wordmark' },
  { id: 'neon', name: 'Neon', aliases: ['banco neon'], color: '#00E4DE', foreground: '#062E35', sigla: 'neon', kind: 'wordmark' },
  { id: 'bs2', name: 'BS2', aliases: ['banco bs2'], color: '#0B2A5B', foreground: '#FFFFFF', sigla: 'BS2', kind: 'wordmark' },
  { id: 'cora', name: 'Cora', aliases: ['banco cora'], color: '#E83E8C', foreground: '#FFFFFF', sigla: 'cora', kind: 'wordmark' },
  { id: 'ton', name: 'Ton', aliases: ['ton stone'], color: '#00D47B', foreground: '#07382B', sigla: 'ton', kind: 'wordmark' },
  { id: 'pan', name: 'Banco PAN', aliases: ['pan', 'banco pan'], color: '#00A3E0', foreground: '#FFFFFF', sigla: 'PAN', kind: 'wordmark' },

  { id: 'banrisul', name: 'Banrisul', aliases: ['banco do estado do rio grande do sul'], color: '#004B87', foreground: '#FFFFFF', sigla: 'BRS', kind: 'wordmark' },
  { id: 'bmg', name: 'BMG', aliases: ['banco bmg'], color: '#FF6900', foreground: '#FFFFFF', sigla: 'BMG', kind: 'wordmark' },
  { id: 'daycoval', name: 'Daycoval', aliases: ['banco daycoval'], color: '#0B3A82', foreground: '#FFFFFF', sigla: 'DAY', kind: 'wordmark' },

  { id: 'brb', name: 'BRB', aliases: ['banco de brasilia', 'banco de brasília', 'brb banco de brasilia'], color: '#005AA9', foreground: '#FFFFFF', sigla: 'BRB', kind: 'wordmark', code: '070', ispb: '00000208', regulatory: { code: '070', ispb: '00000208', verifiedBy: 'bcb-str' } },
  { id: 'bnb', name: 'Banco do Nordeste', aliases: ['bnb', 'banco nordeste'], color: '#00569C', foreground: '#FFFFFF', sigla: 'BNB', kind: 'wordmark' },

  { id: 'sicoob', name: 'Sicoob', aliases: ['bancoob'], color: '#003641', foreground: '#FFFFFF', sigla: 'SCO', kind: 'wordmark' },
  { id: 'sicredi', name: 'Sicredi', ispb: '01181521', regulatory: { ispb: '01181521', verifiedBy: 'bcb-sml' }, aliases: ['banco cooperativo sicredi'], color: '#32A041', foreground: '#FFFFFF', sigla: 'SIC', kind: 'wordmark' },
  { id: 'unicred', name: 'Unicred', aliases: ['sistema unicred'], color: '#185A3B', foreground: '#FFFFFF', sigla: 'UNI', kind: 'wordmark' },

  { id: 'xp', name: 'XP', aliases: ['xp investimentos', 'xp investimentos cctvm'], color: '#111111', foreground: '#FFFFFF', sigla: 'XP', kind: 'wordmark' },
  { id: 'btg', name: 'BTG Pactual', aliases: ['btg', 'banco btg', 'banco btg pactual'], color: '#002B49', foreground: '#FFFFFF', sigla: 'BTG', kind: 'wordmark', code: '208', ispb: '30306294', regulatory: { code: '208', ispb: '30306294', verifiedBy: 'bcb-str' } },
  { id: 'rico', name: 'Rico', aliases: ['rico investimentos'], color: '#FF5C00', foreground: '#FFFFFF', sigla: 'RICO', kind: 'wordmark' },
  { id: 'genial', name: 'Genial', aliases: ['genial investimentos', 'banco genial'], color: '#6CB33F', foreground: '#FFFFFF', sigla: 'GEN', kind: 'wordmark' },

  { id: 'mercantil', name: 'Mercantil', ispb: '17184037', regulatory: { ispb: '17184037', verifiedBy: 'bcb-sml' }, aliases: ['banco mercantil', 'mercantil do brasil', 'banco mercantil do brasil'], color: '#0B3A6D', foreground: '#FFFFFF', sigla: 'MB', kind: 'wordmark' },
  { id: 'sofisa', name: 'Banco Sofisa', aliases: ['sofisa', 'sofisa direto'], color: '#003DA5', foreground: '#FFFFFF', sigla: 'SOF', kind: 'wordmark' },
  { id: 'pine', name: 'Banco Pine', aliases: ['pine'], color: '#00533C', foreground: '#FFFFFF', sigla: 'PINE', kind: 'wordmark' },
  { id: 'abc', name: 'Banco ABC Brasil', aliases: ['abc brasil', 'banco abc'], color: '#0B4EA2', foreground: '#FFFFFF', sigla: 'ABC', kind: 'wordmark' },
  { id: 'fibra', name: 'Banco Fibra', aliases: ['fibra'], color: '#E86A13', foreground: '#FFFFFF', sigla: 'FIB', kind: 'wordmark' },

  { id: 'banese', name: 'Banese', aliases: ['banco do estado de sergipe'], color: '#F58220', foreground: '#FFFFFF', sigla: 'BSE', kind: 'wordmark' },
  { id: 'basa', name: 'Banco da Amazônia', aliases: ['basa', 'banco da amazonia'], color: '#007A4D', foreground: '#FFFFFF', sigla: 'BASA', kind: 'wordmark' },
  { id: 'bdmg', name: 'BDMG', aliases: ['banco de desenvolvimento de minas gerais'], color: '#005CA9', foreground: '#FFFFFF', sigla: 'BDMG', kind: 'wordmark' },

  { id: 'cresol', name: 'Cresol', aliases: ['banco cresol'], color: '#F28C00', foreground: '#FFFFFF', sigla: 'CRE', kind: 'wordmark' },
  { id: 'ailos', name: 'Ailos', aliases: ['sistema ailos'], color: '#005CAB', foreground: '#FFFFFF', sigla: 'AIL', kind: 'wordmark' },
  { id: 'uniprime', name: 'Uniprime', aliases: ['uniprime cooperativa'], color: '#1C5D3A', foreground: '#FFFFFF', sigla: 'UP', kind: 'wordmark' },

  { id: 'clear', name: 'Clear', aliases: ['clear corretora'], color: '#111111', foreground: '#FFFFFF', sigla: 'CLR', kind: 'wordmark' },
  { id: 'modal', name: 'Modal', aliases: ['modal mais', 'banco modal'], color: '#003DA5', foreground: '#FFFFFF', sigla: 'MOD', kind: 'wordmark' },
  { id: 'avenue', name: 'Avenue', aliases: ['avenue securities'], color: '#111111', foreground: '#FFFFFF', sigla: 'AVE', kind: 'wordmark' },
  { id: 'warren', name: 'Warren', aliases: ['warren investimentos'], color: '#E84D8A', foreground: '#FFFFFF', sigla: 'WAR', kind: 'wordmark' },
  { id: 'toro', name: 'Toro', aliases: ['toro investimentos'], color: '#00A86B', foreground: '#FFFFFF', sigla: 'TORO', kind: 'wordmark' },

  { id: 'bari', name: 'Banco Bari', aliases: ['bari'], color: '#1B365D', foreground: '#FFFFFF', sigla: 'BARI', kind: 'wordmark' },
  { id: 'crefisa', name: 'Crefisa', ispb: '61033106', regulatory: { ispb: '61033106', verifiedBy: 'bcb-sml' }, aliases: ['banco crefisa'], color: '#0A4A8A', foreground: '#FFFFFF', sigla: 'CRE', kind: 'wordmark' },
  { id: 'master', name: 'Banco Master', aliases: ['master'], color: '#F58220', foreground: '#FFFFFF', sigla: 'MAS', kind: 'wordmark' },
  { id: 'omni', name: 'Omni', aliases: ['omni banco'], color: '#173E77', foreground: '#FFFFFF', sigla: 'OMNI', kind: 'wordmark' },
  { id: 'topazio', name: 'Banco Topázio', aliases: ['topazio', 'topázio'], color: '#0078BE', foreground: '#FFFFFF', sigla: 'TOP', kind: 'wordmark' },
  { id: 'tribanco', name: 'Tribanco', aliases: ['banco tribanco'], color: '#006BB6', foreground: '#FFFFFF', sigla: 'TRI', kind: 'wordmark' },

  { id: 'carrefour', name: 'Banco Carrefour', aliases: ['carrefour', 'carrefour banco'], color: '#00529B', foreground: '#FFFFFF', sigla: 'CAR', kind: 'wordmark' },
  { id: 'cetelem', name: 'Cetelem', aliases: ['banco cetelem'], color: '#54B948', foreground: '#FFFFFF', sigla: 'CET', kind: 'wordmark' },
  { id: 'porto', name: 'Porto Bank', aliases: ['porto seguro', 'portoseg', 'porto seguro bank'], color: '#00A3E0', foreground: '#FFFFFF', sigla: 'PORTO', kind: 'wordmark' },
  { id: 'superdigital', name: 'Superdigital', aliases: ['super digital'], color: '#101010', foreground: '#FFFFFF', sigla: 'SD', kind: 'wordmark' },
  { id: 'creditas', name: 'Creditas', aliases: ['creditas financeira'], color: '#00BFA5', foreground: '#FFFFFF', sigla: 'CRE', kind: 'wordmark' },

  { id: '99pay', name: '99Pay', aliases: ['99 pay'], color: '#FFD000', foreground: '#111111', sigla: '99', kind: 'wordmark' },
  { id: 'iti', name: 'iti', aliases: ['iti itau', 'iti itaú'], color: '#FF6F00', foreground: '#FFFFFF', sigla: 'iti', kind: 'wordmark' },
  { id: 'z1', name: 'Z1', aliases: ['z1 bank'], color: '#6E42D5', foreground: '#FFFFFF', sigla: 'Z1', kind: 'wordmark' },
  { id: 'jeitto', name: 'Jeitto', aliases: ['jeitto credito'], color: '#00C853', foreground: '#FFFFFF', sigla: 'J', kind: 'wordmark' },
  { id: 'paypal', name: 'PayPal', aliases: ['pay pal'], color: '#003087', foreground: '#FFFFFF', sigla: 'Pay', kind: 'wordmark' },
] as const

const byKey = new Map<string, BankRegistryEntry>()

for (const bank of BANK_REGISTRY) {
  for (const key of [bank.id, bank.name, ...bank.aliases]) {
    const normalized = normalizeBankKey(key)
    if (normalized && !byKey.has(normalized)) {
      byKey.set(normalized, bank)
    }
  }
}

export const COMMON_BANKS = BANK_REGISTRY.map((bank) => bank.name)

export function findBankIdentity(
  value?: string | null,
): BankRegistryEntry | null {
  const key = normalizeBankKey(value)
  if (!key) return null

  const exact = byKey.get(key)
  if (exact) return exact

  const candidates = Array.from(byKey.entries())
    .filter(([candidate]) => candidate.length >= 4)
    .sort((a, b) => b[0].length - a[0].length)

  return candidates.find(
    ([candidate]) =>
      key === candidate ||
      key.startsWith(`${candidate} `) ||
      key.endsWith(` ${candidate}`),
  )?.[1] ?? null
}

export function canonicalizeBankName(value?: string | null) {
  const trimmed = (value || '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return ''
  return findBankIdentity(trimmed)?.name || trimmed
}

export function searchBankRegistry(query: string) {
  const normalized = normalizeBankKey(query)
  if (!normalized) return [...BANK_REGISTRY]

  return BANK_REGISTRY.filter((bank) =>
    [
      bank.name,
      bank.id,
      ...bank.aliases,
      bank.code || '',
      bank.ispb || '',
    ]
      .map(normalizeBankKey)
      .some((item) => item.includes(normalized)),
  )
}


export function getBankAsset(
  value?: string | null,
): BankAsset | null {
  return findBankIdentity(value)?.asset ?? null
}

export function getBankRegulatoryIdentity(
  value?: string | null,
): BankRegulatoryIdentity | null {
  const bank = findBankIdentity(value)

  if (!bank) return null

  return bank.regulatory ?? (
    bank.code || bank.ispb
      ? {
          code: bank.code,
          ispb: bank.ispb,
        }
      : null
  )
}

export const BANK_ASSET_COVERAGE =
  BANK_REGISTRY.reduce(
    (summary, bank) => {
      summary.total += 1

      if (bank.asset) {
        summary.withAsset += 1
      } else {
        summary.withFallback += 1
      }

      return summary
    },
    {
      total: 0,
      withAsset: 0,
      withFallback: 0,
    },
  )
