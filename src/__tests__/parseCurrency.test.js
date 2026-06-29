function parseCurrencyInput(formatted) {
  // Converte "1.234,56" para 1234.56
  const digits = formatted.replace(/\D/g, '')
  if (!digits) return 0
  return parseFloat(digits) / 100
}

function formatCurrencyInput(value) {
  // Converte 1234.56 para "1.234,56"
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

describe('parseCurrencyInput', () => {
  it('converte string formatada para número', () => {
    expect(parseCurrencyInput('1.234,56')).toBe(1234.56)
  })

  it('retorna 0 para string vazia', () => {
    expect(parseCurrencyInput('')).toBe(0)
  })
})

describe('formatCurrencyInput', () => {
  it('formata número para exibição', () => {
    expect(formatCurrencyInput(1234.56)).toBe('1.234,56')
  })
})
