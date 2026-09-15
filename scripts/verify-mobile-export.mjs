import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs'
import {
  join,
} from 'node:path'

/*
 * O target mobile usa:
 *
 *   output: 'export'
 *   trailingSlash: true
 *
 * Portanto rotas como /home e /login são exportadas como
 * diretórios contendo index.html, e não como home.html/login.html.
 */
const required = [
  'out',
  'out/index.html',
  'out/home/index.html',
  'out/login/index.html',
  'out/offline/index.html',
]

for (const path of required) {
  if (!existsSync(path)) {
    console.error(
      `FALHA: artefato ausente: ${path}`,
    )
    process.exit(1)
  }

  console.log(
    `OK: ${path}`,
  )
}

const forbidden = [
  '/api/assistant/chat',
  '/api/ocr-receipt',
  '/api/extract-invoice',
]

function walk(dir) {
  const result = []

  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)

    if (stat.isDirectory()) {
      result.push(...walk(path))
    } else if (
      /\.(?:html|js)$/.test(path)
    ) {
      result.push(path)
    }
  }

  return result
}

const files = walk('out')

let absoluteBoundaryFound = false

for (const file of files) {
  const text = readFileSync(
    file,
    'utf8',
  )

  if (
    text.includes(
      'https://dfl-finance.vercel.app',
    )
  ) {
    absoluteBoundaryFound = true
  }

  for (const endpoint of forbidden) {
    /*
     * A string do endpoint pode existir como argumento
     * de resolveApiUrl no bundle. O que não queremos é
     * fetch literal relativo.
     */
    const escaped =
      endpoint.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      )

    const relativeFetch =
      new RegExp(
        `fetch\\(["']${escaped}`,
      )

    if (relativeFetch.test(text)) {
      console.error(
        `FALHA: fetch relativo persistiu em ${file}`,
      )
      process.exit(1)
    }
  }
}

if (!absoluteBoundaryFound) {
  console.error(
    'FALHA: origem Vercel não apareceu no bundle mobile.',
  )
  process.exit(1)
}

console.log(
  'OK: fronteira Vercel presente no bundle.',
)

console.log(
  'MOBILE EXPORT VERIFY: OK',
)
