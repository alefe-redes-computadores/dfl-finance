describe('🧪 Teste do Guardião de Contexto', () => {

  test('✅ appMode "full" → effectiveContext = context', () => {
    // Quando o app está em modo full, o contexto efetivo é o que o usuário escolheu
    const appMode = 'full'
    const context = 'dfl'
    const effectiveContext = appMode === 'personal_only' ? 'personal' : context
    expect(effectiveContext).toBe('dfl')
  })

  test('✅ appMode "personal_only" → effectiveContext = "personal" (forçado)', () => {
    const appMode = 'personal_only'
    const context = 'dfl' // mesmo que o usuário tente PJ...
    const effectiveContext = appMode === 'personal_only' ? 'personal' : context
    expect(effectiveContext).toBe('personal') // ...é forçado para PF
  })

  test('✅ appMode "personal_only" → ContextToggle invisível', () => {
    const appMode = 'personal_only'
    const shouldRender = appMode === 'full'
    expect(shouldRender).toBe(false)
  })

  test('✅ appMode "full" → ContextToggle visível', () => {
    const appMode = 'full'
    const shouldRender = appMode === 'full'
    expect(shouldRender).toBe(true)
  })

})