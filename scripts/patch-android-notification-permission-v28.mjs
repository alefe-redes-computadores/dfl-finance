import fs from 'node:fs'

const file = 'android/app/src/main/AndroidManifest.xml'

if (!fs.existsSync(file)) {
  throw new Error(
    `AndroidManifest final não encontrado: ${file}`
  )
}

let source = fs.readFileSync(file, 'utf8')

const permission =
  'android.permission.POST_NOTIFICATIONS'

if (!source.includes(permission)) {
  const manifest = source.match(/<manifest\b[^>]*>/)

  if (!manifest) {
    throw new Error(
      'Tag <manifest> não encontrada.'
    )
  }

  source = source.replace(
    manifest[0],
    `${manifest[0]}
    <uses-permission android:name="${permission}" />`
  )

  fs.writeFileSync(file, source)

  console.log(
    'V28: POST_NOTIFICATIONS adicionada ao Manifest final.'
  )
} else {
  console.log(
    'V28: POST_NOTIFICATIONS já estava presente.'
  )
}

const finalSource =
  fs.readFileSync(file, 'utf8')

if (!finalSource.includes(permission)) {
  throw new Error(
    'Falha ao garantir POST_NOTIFICATIONS.'
  )
}
