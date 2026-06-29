import { formatCurrency } from '../lib/utils'

describe('formatCurrency', () => {
  it('formata zero corretamente', () => {
    expect(formatCurrency(0)).toBe('R$ 0,00')
  })

  it('formata valores inteiros', () => {
    expect(formatCurrency(1500)).toBe('R$ 1.500,00')
  })

  it('formata valores decimais', () => {
    expect(formatCurrency(1234.56)).toBe('R$ 1.234,56')
  })
})
