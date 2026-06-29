function calculateBalance(transactions) {
  const income = transactions
    .filter(t => t.type === 'income' && t.status === 'done')
    .reduce((sum, t) => sum + t.amount, 0)
  const expense = transactions
    .filter(t => t.type === 'expense' && t.status === 'done')
    .reduce((sum, t) => sum + t.amount, 0)
  return { income, expense, balance: income - expense }
}

describe('calculateBalance', () => {
  it('calcula saldo corretamente', () => {
    const txs = [
      { type: 'income', amount: 1000, status: 'done' },
      { type: 'expense', amount: 300, status: 'done' },
      { type: 'expense', amount: 200, status: 'pending' },
    ]
    const result = calculateBalance(txs)
    expect(result.income).toBe(1000)
    expect(result.expense).toBe(300)
    expect(result.balance).toBe(700)
  })

  it('retorna zero quando não há transações', () => {
    const result = calculateBalance([])
    expect(result.income).toBe(0)
    expect(result.expense).toBe(0)
    expect(result.balance).toBe(0)
  })
})