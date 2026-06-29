function generateInstallments(baseDate, totalAmount, installments, frequency = 'monthly') {
  if (installments <= 1) {
    return [{ date: baseDate, amount: totalAmount }]
  }

  const result = []
  const installmentAmount = totalAmount / installments

  for (let i = 0; i < installments; i++) {
    const date = new Date(baseDate)
    if (frequency === 'monthly') {
      date.setMonth(date.getMonth() + i)
    } else if (frequency === 'weekly') {
      date.setDate(date.getDate() + i * 7)
    }
    result.push({
      date: date.toISOString().split('T')[0],
      amount: installmentAmount,
      index: i + 1,
      total: installments,
    })
  }

  return result
}

describe('generateInstallments', () => {
  it('retorna uma única parcela se installments = 1', () => {
    const result = generateInstallments('2026-01-15', 500, 1)
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(500)
  })

  it('gera 3 parcelas com valor dividido corretamente', () => {
    const result = generateInstallments('2026-01-15', 900, 3)
    expect(result).toHaveLength(3)
    expect(result[0].amount).toBe(300)
    expect(result[1].amount).toBe(300)
    expect(result[2].amount).toBe(300)
  })

  it('gera datas mensais consecutivas', () => {
    const result = generateInstallments('2026-01-15', 600, 3)
    expect(result[0].date).toBe('2026-01-15')
    expect(result[1].date).toBe('2026-02-15')
    expect(result[2].date).toBe('2026-03-15')
  })

  it('gera datas semanais quando frequency = weekly', () => {
    const result = generateInstallments('2026-01-05', 400, 4, 'weekly')
    expect(result[0].date).toBe('2026-01-05')
    expect(result[1].date).toBe('2026-01-12')
    expect(result[2].date).toBe('2026-01-19')
    expect(result[3].date).toBe('2026-01-26')
  })

  it('preenche index e total corretamente', () => {
    const result = generateInstallments('2026-01-01', 300, 3)
    expect(result[0].index).toBe(1)
    expect(result[0].total).toBe(3)
    expect(result[2].index).toBe(3)
  })
})
