import fs from 'node:fs'

const read = (p) => fs.readFileSync(p, 'utf8')
const more = read('src/app/(app)/more/page.tsx')
const migration = read('supabase/migrations/20260927125351_v51_storage_privacy_hardening.sql')

const checks = [
  [!fs.existsSync('src/app/_api'), 'rotas /_api legadas removidas'],
  [more.includes("`${user.id}/avatar.jpg`"), 'avatar em pasta própria do usuário'],
  [more.includes("upsert: true"), 'avatar substitui arquivo estável'],
  [more.includes("15 * 1024 * 1024"), 'limite de entrada do avatar'],
  [more.includes("image/jpeg") && more.includes("image/png") && more.includes("image/webp"), 'tipos de avatar validados'],
  [more.includes("?v=${Date.now()}"), 'cache-busting do avatar'],
  [migration.includes('drop policy if exists "Comprovantes são públicos"'), 'policy pública de comprovantes removida'],
  [migration.includes('Usuários podem visualizar seus comprovantes'), 'leitura owner-only de comprovantes'],
  [migration.includes("bucket_id = 'receipts'") && migration.includes('to authenticated'), 'receipts autenticados'],
  [migration.includes("bucket_id = 'avatars'") && migration.includes('for update'), 'avatar update owner-only'],
]

const failed = checks.filter(([ok]) => !ok)
for (const [ok, label] of checks) console.log(`${ok ? 'OK' : 'FAIL'}: ${label}`)
if (failed.length) process.exit(1)
console.log('DFL FINANCE V51 FINAL GLOBAL HARDENING: OK')
