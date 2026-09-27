import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')

function ok(condition, message) {
  if (!condition) throw new Error(`V52: ${message}`)
  console.log(`OK: ${message}`)
}

const registry = read('src/lib/bankRegistry.ts')
const accounts = read('src/lib/accountPresentation.ts')
const icons = read('src/lib/BankIcons.tsx')
const logo = read('src/components/BankLogo.tsx')
const picker = read('src/components/BankPickerField.tsx')

ok(registry.includes('export const BANK_REGISTRY'), 'registry central existe')
ok(registry.includes('findBankIdentity'), 'resolver central existe')
ok(registry.includes('canonicalizeBankName'), 'canonicalização central existe')
ok(registry.includes('searchBankRegistry'), 'busca central existe')
ok(registry.includes('normalizeBankKey'), 'normalização central existe')

const ids = [...registry.matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1])
ok(ids.length >= 50, `catálogo amplo possui ${ids.length} instituições`)
ok(new Set(ids).size === ids.length, 'IDs do registry são únicos')

const entryBlock =
  registry.slice(
    registry.indexOf('export const BANK_REGISTRY'),
    registry.indexOf('const byKey'),
  )

const names = [...entryBlock.matchAll(/\bname:\s*'([^']+)'/g)].map((m) => m[1])
ok(names.length === ids.length, 'cada instituição possui nome canônico')

const normalized = (value) =>
  value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[._/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')

const normalizedNames = names.map(normalized)
ok(
  new Set(normalizedNames).size === normalizedNames.length,
  'nomes canônicos não colidem após normalização',
)

for (const asset of [
  'pagbank.svg',
  'picpay.svg',
  'mercado-pago.svg',
  'stone.svg',
]) {
  ok(fs.existsSync(`public/banks/${asset}`), `asset local preservado: ${asset}`)
}

for (const assetPath of [
  '/banks/pagbank.svg',
  '/banks/picpay.svg',
  '/banks/mercado-pago.svg',
  '/banks/stone.svg',
]) {
  ok(registry.includes(assetPath), `registry declara ${assetPath}`)
}

ok(
  registry.includes("code: '001'") &&
    registry.includes("ispb: '00000000'"),
  'contrato Banco do Brasil preservado',
)

ok(
  registry.includes("code: '104'") &&
    registry.includes("ispb: '00360305'"),
  'contrato Caixa preservado',
)

ok(
  registry.includes("code: '070'") &&
    registry.includes("ispb: '00000208'"),
  'contrato BRB preservado',
)

ok(
  registry.includes("code: '208'") &&
    registry.includes("ispb: '30306294'"),
  'contrato BTG preservado',
)

ok(
  accounts.includes("from '@/lib/bankRegistry'"),
  'accountPresentation usa registry',
)

ok(
  !accounts.includes('export const BANK_ALIASES') &&
    !accounts.includes('const BANK_ALIASES'),
  'aliases paralelos removidos de accountPresentation',
)

ok(
  !accounts.includes('export const COMMON_BANKS = ['),
  'lista manual de bancos removida de accountPresentation',
)

ok(
  icons.includes("from '@/lib/bankRegistry'"),
  'BankIcons usa registry',
)

ok(
  !icons.includes('const BANK_MAP'),
  'BankIcons não mantém BANK_MAP paralelo',
)

ok(
  logo.includes('findBankIdentity'),
  'BankLogo resolve identidade pelo registry',
)

ok(
  !logo.includes('const BRAND_ASSETS'),
  'BankLogo não mantém catálogo local paralelo de assets',
)

ok(
  picker.includes('searchBankRegistry'),
  'BankPicker usa busca central',
)

ok(
  picker.includes('findBankIdentity'),
  'BankPicker usa resolução central',
)

ok(
  !picker.includes('COMMON_BANKS'),
  'BankPicker não depende de lista manual',
)

ok(
  picker.includes('customCandidate'),
  'instituição customizada continua suportada',
)

for (const nativePath of [
  'android/app/src/main/java',
  'capacitor.config',
  'MainActivity',
]) {
  ok(
    !registry.includes(nativePath),
    `registry não introduz dependência nativa: ${nativePath}`,
  )
}

console.log(`DFL FINANCE V52 BANK IDENTITY V3: OK (${ids.length} instituições)`)
