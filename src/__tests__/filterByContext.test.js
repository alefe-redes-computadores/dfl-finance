function filterByContext(transactions, targetContext) {
  return transactions.filter(t => t.context === targetContext)
}

describe('filterByContext', () => {
  const txs = [
    { id: 1, context: 'personal', amount: 100 },
    { id: 2, context: 'dfl', amount: 200 },
    { id: 3, context: 'personal', amount: 150 },
  ]

  it('retorna apenas transações do contexto personal', () => {
    const result = filterByContext(txs, 'personal')
    expect(result).toHaveLength(2)
    expect(result.every(t => t.context === 'personal')).toBe(true)
  })

  it('retorna array vazio se nenhuma transação corresponder', () => {
    const result = filterByContext(txs, 'business')
    expect(result).toHaveLength(0)
  })
})
