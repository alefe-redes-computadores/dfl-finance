import { planProactiveDigest } from '@/lib/proactiveDigestPolicy'
import { classifyLatestWorkflow, classifyLatestArtifact } from '@/lib/apkWorkflowDiagnostics'
import type { ProactiveObservation } from '@/lib/proactiveObservations'

const insight: ProactiveObservation = {
  key: 'dfl:engine:2026-11:expense-month-spike',
  source: 'intelligence', title: 'Despesas aceleraram', message: 'Dados...',
  why: 'Motivo', period: 'Novembro/26', severity: 'warning', confidence: 'high',
  priority: 85, evidence: 'Amostra', route: '/analysis', actionLabel: 'Conferir',
}
const config = { enabled: true, frequency: 'daily' as const, privacy: 'private' as const, hour: 9 }
const now = new Date(2026, 10, 8, 15, 0, 0)

describe('R459 — observações Android opt-in', () => {
  test('OFF e pausa nunca planejam', () => {
    expect(planProactiveDigest('user', 'dfl', [insight], { ...config, enabled: false }, now)).toBeNull()
    expect(planProactiveDigest('user', 'dfl', [insight], { ...config, frequency: 'off' }, now)).toBeNull()
  })
  test('sem sinal confiável não notifica', () => {
    expect(planProactiveDigest('user', 'personal', [insight], config, now)).toBeNull()
    expect(planProactiveDigest('user', 'dfl', [{ ...insight, confidence: 'low' }], config, now)).toBeNull()
    expect(planProactiveDigest('user', 'dfl', [{ ...insight, severity: 'info' }], config, now)).toBeNull()
  })
  test('avisos futuros não guardam valores e abrem Observações', () => {
    const result = planProactiveDigest('user', 'dfl', [insight], config, now)!
    expect(result.route).toBe('/intelligence-center/observations')
    expect(result.title).toBe('Observações do Finance')
    expect(result.body).not.toMatch(/R\$|valor|39%/)
    expect(result.at.getDate()).toBe(9)
    expect(result.at.getHours()).toBe(9)
    expect(result.id).toBeGreaterThanOrEqual(2050000000)
    expect(result.id).toBeLessThan(2090000000)
  })
  test('semana, privacidade e conta isoladas', () => {
    const company = planProactiveDigest('user', 'dfl', [insight], { ...config, frequency: 'weekly', privacy: 'full' }, now)!
    expect(company.at.getDate()).toBe(15)
    expect(company.title).toBe(insight.title)
    const personalInsight = { ...insight, key: 'personal:engine:2026-11:expense-month-spike' }
    const personal = planProactiveDigest('user', 'personal', [personalInsight], config, now)!
    expect(personal.id).not.toEqual(company.id)
    expect(personal.signature).toContain('personal:')
  })
  test('assinatura determinística evita reagendamento sem mudanças', () => {
    expect(planProactiveDigest('user', 'dfl', [insight], config, now)?.signature)
      .toEqual(planProactiveDigest('user', 'dfl', [insight], config, now)?.signature)
  })
})

describe('R459 — diagnóstico GitHub não oferece APK falho', () => {
  const run = (status: string, conclusion: string | null) => ({
    workflow_runs: [{ id: 123, run_number: 1045, head_branch: 'main',
      path: '.github/workflows/android-build.yml', status, conclusion }],
  })
  test('falha não vira atualização', () => {
    expect(classifyLatestWorkflow(run('completed', 'failure')).kind).toBe('failed')
    expect(classifyLatestWorkflow(run('in_progress', null)).kind).toBe('building')
  })
  test('artefato expirado é rotulado como expirado', () => {
    const health = classifyLatestWorkflow(run('completed', 'success'))
    const expired = classifyLatestArtifact(health, { artifacts: [{ name: 'DFL-Finance-App',
      expired: true, expires_at: '2026-11-09T03:00:00Z' }] }, Date.parse('2026-11-20T00:00:00Z'))
    expect(expired.kind).toBe('expired')
  })
  test('artefato válido e ausência distinguíveis', () => {
    const health = classifyLatestWorkflow(run('completed', 'success'))
    expect(classifyLatestArtifact(health, { artifacts: [] }).kind).toBe('unavailable')
    expect(classifyLatestArtifact(health, { artifacts: [{ name: 'DFL-Finance-App',
      expired: false, expires_at: '2026-11-24T03:00:00Z' }] }, Date.parse('2026-11-20T00:00:00Z')).kind).toBe('ready')
  })
})
