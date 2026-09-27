import fs from 'node:fs'

const presentation =
  fs.readFileSync(
    'src/lib/bankIdentityPresentation.ts',
    'utf8',
  )

const logo =
  fs.readFileSync(
    'src/components/BankLogo.tsx',
    'utf8',
  )

const registry =
  fs.readFileSync(
    'src/lib/bankRegistry.ts',
    'utf8',
  )

const ok = (
  condition,
  message,
) => {
  if (!condition) {
    throw new Error(
      `V52.2: ${message}`,
    )
  }

  console.log(
    `OK: ${message}`,
  )
}

ok(
  presentation.includes(
    'BankOpticalProfile',
  ),
  'perfil óptico tipado',
)

ok(
  presentation.includes(
    'getBankOpticalProfile',
  ),
  'resolver óptico existe',
)

ok(
  presentation.includes(
    'BANK_LOGO_SIZE_CLASSES',
  ),
  'tamanhos centralizados',
)

ok(
  presentation.includes(
    'BANK_LOGO_CONTAINER_CLASS',
  ),
  'container centralizado',
)

for (
  const bank of [
    'nubank',
    'inter',
    'itau',
    'bradesco',
    'santander',
    'bb',
    'caixa',
    'c6',
    'picpay',
    'pagbank',
    'mercado-pago',
    'stone',
    'sicoob',
    'sicredi',
    'btg',
    'xp',
  ]
) {
  ok(
    presentation.includes(
      `${bank}:`,
    ) ||
      presentation.includes(
        `'${bank}':`,
      ),
    `perfil óptico ${bank}`,
  )
}

ok(
  logo.includes(
    'getBankOpticalProfile',
  ),
  'BankLogo usa perfil óptico',
)

ok(
  logo.includes(
    'identity?.id',
  ),
  'perfil resolve por ID canônico',
)

ok(
  logo.includes(
    'BANK_LOGO_SIZE_CLASSES',
  ),
  'BankLogo usa tamanhos compartilhados',
)

ok(
  logo.includes(
    'BANK_LOGO_CONTAINER_CLASS',
  ),
  'BankLogo usa container compartilhado',
)

ok(
  logo.includes(
    'findBankIdentity(canonicalName)',
  ),
  'contrato V52 preservado',
)

ok(
  registry.includes(
    'BANK_ASSET_COVERAGE',
  ),
  'contrato V52.1 preservado',
)

ok(
  !presentation.includes(
    'http://',
  ) &&
    !presentation.includes(
      'https://',
    ),
  'presentation offline',
)

ok(
  !logo.includes(
    'http://',
  ) &&
    !logo.includes(
      'https://',
    ),
  'BankLogo offline',
)

for (
  const file of [
    'pagbank.svg',
    'picpay.svg',
    'mercado-pago.svg',
    'stone.svg',
  ]
) {
  ok(
    fs.existsSync(
      `public/banks/${file}`,
    ),
    `asset preservado ${file}`,
  )
}

console.log(
  'DFL FINANCE V52.2 OPTICAL: OK',
)
