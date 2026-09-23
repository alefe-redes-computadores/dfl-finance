import fs from 'node:fs'
import path from 'node:path'

const source = 'assets/android/ic_stat_dfl_finance.xml'
const targetDir = 'android/app/src/main/res/drawable'
const target = path.join(targetDir, 'ic_stat_dfl_finance.xml')

if (!fs.existsSync(source)) {
  throw new Error(`Small icon VectorDrawable ausente: ${source}`)
}

const xml = fs.readFileSync(source, 'utf8')
for (const [ok, message] of [
  [xml.includes('<vector'), 'não é VectorDrawable'],
  [xml.includes('android:fillColor="#FFFFFFFF"'), 'máscara não é branca/monocromática'],
  [xml.includes('android:viewportWidth="24"'), 'viewportWidth inesperado'],
  [xml.includes('android:viewportHeight="24"'), 'viewportHeight inesperado'],
]) {
  if (!ok) throw new Error(`Small icon inválido: ${message}`)
}

fs.mkdirSync(targetDir, { recursive: true })

// Remove legado PNG para impedir resolução ambígua do mesmo resource name.
for (const ext of ['png', 'webp', 'jpg', 'jpeg']) {
  const legacy = path.join(targetDir, `ic_stat_dfl_finance.${ext}`)
  if (fs.existsSync(legacy)) fs.rmSync(legacy)
}

fs.copyFileSync(source, target)

if (!fs.existsSync(target) || fs.statSync(target).size === 0) {
  throw new Error('Falha ao restaurar VectorDrawable no Android')
}

console.log(`Notification small icon restaurado: ${target}`)
