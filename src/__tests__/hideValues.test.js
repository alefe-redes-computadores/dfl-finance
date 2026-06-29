function formatHiddenValue(value, hidden) {
  if (hidden) return '••••'
  return `R$ ${value.toFixed(2)}`
}

describe('formatHiddenValue', () => {
  it('exibe valor normalmente quando não escondido', () => {
    expect(formatHiddenValue(150.0, false)).toBe('R$ 150.00')
  })

  it('exibe máscara quando escondido', () => {
    expect(formatHiddenValue(150.0, true)).toBe('••••')
  })
})
