import { cleanCnpj, formatCnpj, isValidCnpj } from '@/lib/commercialIdentity'

describe('R454 identidade comercial CNPJ', () => {
  it('aplica máscara durante a digitação, colagem e letras', () => {
    expect(formatCnpj('')).toBe('')
    expect(formatCnpj('12')).toBe('12')
    expect(formatCnpj('123')).toBe('12.3')
    expect(formatCnpj('04252011000110')).toBe('04.252.011/0001-10')
    expect(formatCnpj('12abc34501de35')).toBe('12.ABC.345/01DE-35')
    expect(cleanCnpj('12.ABC.345/01DE-35')).toBe('12ABC34501DE35')
    expect(cleanCnpj('00.000.000/E08G-12')).toBe('00000000E08G12')
  })

  it('confere os dígitos do modelo antigo e do modelo 2026', () => {
    expect(isValidCnpj('04.252.011/0001-10')).toBe(true)
    expect(isValidCnpj('12.ABC.345/01DE-35')).toBe(true)
    expect(isValidCnpj('00.000.000/E08G-12')).toBe(true)
    expect(isValidCnpj('00.000.000/0000-00')).toBe(false)
    expect(isValidCnpj('12.ABC.345/01DE-34')).toBe(false)
    expect(isValidCnpj('11.222')).toBe(false)
  })

  it('recusa letras na posição dos verificadores', () => {
    expect(isValidCnpj('12.ABC.345/01DE-AA')).toBe(false)
    expect(formatCnpj('12.ABC.345/01DE-AA')).toBe('12.ABC.345/01DE')
  })
})
