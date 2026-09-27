import fs from 'node:fs'

const registry =
  fs.readFileSync(
    'src/lib/bankRegistry.ts',
    'utf8',
  )

const logo =
  fs.readFileSync(
    'src/components/BankLogo.tsx',
    'utf8',
  )

const ok = (condition, message) => {
  if (!condition) {
    throw new Error(`V52.1: ${message}`)
  }

  console.log(`OK: ${message}`)
}

ok(
  registry.includes('BankAssetProvenance'),
  'proveniência tipada',
)

ok(
  registry.includes('BankRegulatoryIdentity'),
  'identidade regulatória tipada',
)

for (
  const value of [
    '60701190',
    '60746948',
    '90400888',
    '01181521',
    '17184037',
    '61033106',
  ]
) {
  ok(
    registry.includes(`ispb: '${value}'`),
    `ISPB ${value}`,
  )
}

for (
  const [code, ispb] of [
    ['001', '00000000'],
    ['104', '00360305'],
    ['070', '00000208'],
    ['208', '30306294'],
  ]
) {
  ok(
    registry.includes(`code: '${code}'`) &&
      registry.includes(`ispb: '${ispb}'`),
    `${code}/${ispb}`,
  )
}

for (
  const file of [
    'pagbank.svg',
    'picpay.svg',
    'mercado-pago.svg',
    'stone.svg',
  ]
) {
  ok(
    fs.existsSync(`public/banks/${file}`),
    `asset ${file}`,
  )
}

ok(
  registry.includes('getBankAsset'),
  'helper central de asset',
)

ok(
  registry.includes('BANK_ASSET_COVERAGE'),
  'cobertura mensurável',
)

ok(
  logo.includes('findBankIdentity(canonicalName)'),
  'BankLogo resolve identidade pelo registry',
)

ok(
  !registry.includes('https://') &&
    !registry.includes('http://'),
  'offline-first',
)

console.log(
  'DFL FINANCE V52.1: OK',
)
