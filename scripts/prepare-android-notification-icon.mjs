import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const source = path.join(
  root,
  'assets',
  'branding',
  'ic_stat_dfl_finance.png'
)

const androidRoot = path.join(root, 'android')

if (!fs.existsSync(source)) {
  console.error(
    'ERRO: assets/branding/ic_stat_dfl_finance.png não encontrado.'
  )
  process.exit(1)
}

if (!fs.existsSync(androidRoot)) {
  console.log(
    'android/ ainda não existe. Fonte do ícone nativo está pronta; nenhuma escrita necessária.'
  )
  process.exit(0)
}

const drawable = path.join(
  androidRoot,
  'app',
  'src',
  'main',
  'res',
  'drawable'
)

fs.mkdirSync(drawable, { recursive: true })

const destination = path.join(
  drawable,
  'ic_stat_dfl_finance.png'
)

fs.copyFileSync(source, destination)

console.log(
  `Ícone nativo de notificação preparado: ${destination}`
)
