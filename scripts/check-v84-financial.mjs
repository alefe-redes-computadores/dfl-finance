import { spawnSync } from 'node:child_process'

// Behavior gates supersede the old timestamp-wins structural sync contract.
// No build, remote database access, deploy, messages or staging.
const checks = [
  ['TypeScript', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['IndexedDB / fila / concorrência', ['node_modules/jest/bin/jest.js', '--config', 'scripts/jest-financial.cjs', '--runInBand']],
  ['Postgres isolado / RPC / RLS', ['scripts/check-v84-financial-sql.mjs']],
  ['Handlers Edge simulados', ['scripts/check-v84-edge-runtime.mjs']],
  ['Contratos mobile existentes', ['scripts/check-mobile-readiness.mjs']],
  ['ESLint', ['node_modules/eslint/bin/eslint.js', 'src', '--ext', '.js,.jsx,.ts,.tsx', '--report-unused-disable-directives', '--max-warnings=0']],
]
for (const [name, args] of checks) {
  console.log(`\nV84 — ${name}`)
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
const diff = spawnSync('git', ['diff', '--check'], { stdio: 'inherit' })
if (diff.status !== 0) process.exit(diff.status ?? 1)
console.log('\nV84: gates locais aprovados. PWA, backend real e APK exigem aceitação após ativação coordenada.')
