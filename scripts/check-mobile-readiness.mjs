import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

const checks = []

function check(label, condition) {
  checks.push([label, Boolean(condition)])
}

const capacitor = read('capacitor.config.ts')
const packageJson = JSON.parse(
  read('package.json'),
)
const rootLayout = read('src/app/layout.tsx')
const login = read('src/app/login/page.tsx')
const deepLink = read(
  'src/lib/hooks/useAuthDeepLink.ts',
)
const apiUrl = read(
  'src/lib/runtime/apiUrl.ts',
)

check(
  'appId nativo definitivo',
  capacitor.includes(
    "appId: 'com.dflfinance.app'",
  ),
)

check(
  'cleartext Android desativado',
  capacitor.includes('cleartext: false'),
)

check(
  'GoogleAuth legado ausente',
  !capacitor.includes('GoogleAuth:'),
)

check(
  'NativeAuthProvider montado no root',
  rootLayout.includes(
    '<NativeAuthProvider>',
  ),
)

check(
  'Login usa contexto global de auth',
  login.includes('useNativeAuth()') &&
    !login.includes(
      "from '@/lib/hooks/useAuthDeepLink'",
    ),
)

check(
  'Cold-start OAuth coberto',
  deepLink.includes('App.getLaunchUrl()'),
)

check(
  'Callback nativo restrito ao contrato',
  deepLink.includes(
    "NATIVE_CALLBACK_PROTOCOL = 'dfl:'",
  ) &&
    deepLink.includes(
      "NATIVE_CALLBACK_HOST = 'callback'",
    ),
)

check(
  'Fronteira server-side existe',
  apiUrl.includes(
    'NEXT_PUBLIC_DFL_SERVER_ORIGIN',
  ) &&
    apiUrl.includes(
      'resolveApiUrl',
    ),
)

check(
  'Build mobile usa target exportável',
  packageJson.scripts?.[
    'build:mobile'
  ]?.includes(
    'scripts/build-mobile.mjs',
  ),
)

/*
 * Um WebView Capacitor possui origem própria.
 * Fetch relativo /api não pode sobreviver na camada client
 * destinada ao runtime nativo.
 */
const roots = ['src']
const forbidden = []

function walk(dir) {
  for (const entry of fs.readdirSync(
    dir,
    { withFileTypes: true },
  )) {
    const path = `${dir}/${entry.name}`

    if (entry.isDirectory()) {
      walk(path)
      continue
    }

    if (
      !/\.(?:js|jsx|ts|tsx)$/.test(
        entry.name,
      )
    ) {
      continue
    }

    const text = read(path)

    const relativeFetch =
      /fetch\s*\(\s*['"]\/(?:api|_api)\//g

    if (relativeFetch.test(text)) {
      forbidden.push(path)
    }
  }
}

for (const root of roots) {
  walk(root)
}

check(
  'Nenhum fetch client literal preso a /api',
  forbidden.length === 0,
)

for (const [label, ok] of checks) {
  console.log(
    `${ok ? 'OK' : 'FALHA'}: ${label}`,
  )
}

if (forbidden.length > 0) {
  console.error(
    '\nFetches relativos encontrados:',
  )

  for (const file of forbidden) {
    console.error(` - ${file}`)
  }
}

const failed = checks.filter(
  ([, ok]) => !ok,
)

if (failed.length > 0) {
  console.error(
    `\nMOBILE READINESS: FALHOU (${failed.length})`,
  )
  process.exit(1)
}

console.log(
  `\nMOBILE READINESS: OK (${checks.length})`,
)


const nextConfig =
  read('next.config.js')

const rootEntry =
  read('src/app/page.tsx')

check(
  'Next possui target mobile explícito',
  nextConfig.includes(
    "process.env.DFL_BUILD_TARGET === 'mobile'",
  ) &&
    nextConfig.includes(
      "output: 'export'",
    ),
)

check(
  'Root entry exportável',
  rootEntry.includes(
    "'use client'",
  ) &&
    !rootEntry.includes(
      "import { redirect }",
    ),
)

check(
  'Backend mobile canônico',
  packageJson.scripts?.[
    'build:mobile'
  ]?.includes(
    'https://dfl-finance.vercel.app',
  ),
)


// V10D_DUAL_TARGET_CHECKS
const v10dNextConfig =
  read('next.config.js')

const v10dRootEntry =
  read('src/app/page.tsx')

check(
  'Next possui target mobile explícito',
  v10dNextConfig.includes(
    "process.env.DFL_BUILD_TARGET === 'mobile'",
  ) &&
    v10dNextConfig.includes(
      "output: 'export'",
    ),
)

check(
  'Root entry é client-side e exportável',
  v10dRootEntry.includes(
    "'use client'",
  ) &&
    !v10dRootEntry.includes(
      "import { redirect }",
    ),
)

check(
  'Backend mobile canônico',
  packageJson.scripts?.[
    'build:mobile'
  ]?.includes(
    'https://dfl-finance.vercel.app',
  ),
)
