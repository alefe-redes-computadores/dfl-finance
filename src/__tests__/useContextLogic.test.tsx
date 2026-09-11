type AppMode = 'full' | 'personal_only'
type FinanceContext = 'dfl' | 'personal'

function getEffectiveContext(
  appMode: AppMode,
  context: FinanceContext
): FinanceContext {
  return appMode === 'personal_only' ? 'personal' : context
}

function shouldRenderContextToggle(appMode: AppMode): boolean {
  return appMode === 'full'
}

describe('🧪 Teste do Guardião de Contexto', () => {
  test('✅ appMode "full" → effectiveContext = context', () => {
    expect(getEffectiveContext('full', 'dfl')).toBe('dfl')
  })

  test('✅ appMode "personal_only" → effectiveContext = "personal" (forçado)', () => {
    expect(getEffectiveContext('personal_only', 'dfl')).toBe('personal')
  })

  test('✅ appMode "personal_only" → ContextToggle invisível', () => {
    expect(shouldRenderContextToggle('personal_only')).toBe(false)
  })

  test('✅ appMode "full" → ContextToggle visível', () => {
    expect(shouldRenderContextToggle('full')).toBe(true)
  })
})
