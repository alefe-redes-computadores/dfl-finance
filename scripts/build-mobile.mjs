import {
  spawnSync,
} from 'node:child_process'
import {
  existsSync,
  rmSync,
} from 'node:fs'

const SERVER_ORIGIN =
  process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN

if (!SERVER_ORIGIN) {
  console.error(
    'NEXT_PUBLIC_DFL_SERVER_ORIGIN não configurada.',
  )
  process.exit(1)
}

let parsed

try {
  parsed = new URL(SERVER_ORIGIN)
} catch {
  console.error(
    'NEXT_PUBLIC_DFL_SERVER_ORIGIN inválida.',
  )
  process.exit(1)
}

if (
  parsed.protocol !== 'https:' ||
  parsed.pathname !== '/' ||
  parsed.search ||
  parsed.hash
) {
  console.error(
    'NEXT_PUBLIC_DFL_SERVER_ORIGIN deve ser uma origem HTTPS sem caminho/query/hash.',
  )
  process.exit(1)
}

if (existsSync('out')) {
  rmSync('out', {
    recursive: true,
    force: true,
  })
}

const result = spawnSync(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'build',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      DFL_BUILD_TARGET: 'mobile',
      NEXT_PUBLIC_DFL_SERVER_ORIGIN:
        parsed.origin,
    },
  },
)

process.exit(result.status ?? 1)
