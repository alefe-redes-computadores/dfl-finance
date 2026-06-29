function getLimitProgress(limit, spent) {
  if (limit <= 0) return 0
  return Math.min((spent / limit) * 100, 100)
}

function getProgressColor(percent) {
  if (percent > 80) return 'red'
  if (percent > 50) return 'amber'
  return 'emerald'
}

describe('getLimitProgress', () => {
  it('calcula 50% corretamente', () => {
    expect(getLimitProgress(1000, 500)).toBe(50)
  })

  it('não ultrapassa 100%', () => {
    expect(getLimitProgress(1000, 1200)).toBe(100)
  })

  it('retorna 0 se limite for 0', () => {
    expect(getLimitProgress(0, 500)).toBe(0)
  })
})

describe('getProgressColor', () => {
  it('retorna vermelho acima de 80%', () => {
    expect(getProgressColor(85)).toBe('red')
  })

  it('retorna amarelo entre 51% e 80%', () => {
    expect(getProgressColor(60)).toBe('amber')
  })

  it('retorna verde até 50%', () => {
    expect(getProgressColor(30)).toBe('emerald')
  })
})
