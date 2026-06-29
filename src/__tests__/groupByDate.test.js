function groupTransactionsByDate(transactions) {
  return transactions.reduce((acc, tx) => {
    const date = tx.date
    if (!acc[date]) {
      acc[date] = { date, transactions: [], totalIncome: 0, totalExpense: 0 }
    }
    acc[date].transactions.push(tx)
    if (tx.type === 'income') {
      acc[date].totalIncome += tx.amount
    } else if (tx.type === 'expense') {
      acc[date].totalExpense += tx.amount
    }
    return acc
  }, {})
}

describe('groupTransactionsByDate', () => {
  const txs = [
    { id: 1, date: '2026-01-10', type: 'income', amount: 500 },
    { id: 2, date: '2026-01-10', type: 'expense', amount: 200 },
    { id: 3, date: '2026-01-12', type: 'expense', amount: 100 },
    { id: 4, date: '2026-01-12', type: 'income', amount: 300 },
  ]

  it('agrupa transações pela data', () => {
    const result = groupTransactionsByDate(txs)
    const keys = Object.keys(result)
    expect(keys).toHaveLength(2)
    expect(keys).toContain('2026-01-10')
    expect(keys).toContain('2026-01-12')
  })

  it('calcula total de income e expense por data', () => {
    const result = groupTransactionsByDate(txs)
    expect(result['2026-01-10'].totalIncome).toBe(500)
    expect(result['2026-01-10'].totalExpense).toBe(200)
    expect(result['2026-01-12'].totalIncome).toBe(300)
    expect(result['2026-01-12'].totalExpense).toBe(100)
  })

  it('retorna objeto vazio se não houver transações', () => {
    const result = groupTransactionsByDate([])
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('mantém as transações dentro do grupo', () => {
    const result = groupTransactionsByDate(txs)
    expect(result['2026-01-10'].transactions).toHaveLength(2)
    expect(result['2026-01-10'].transactions[0].id).toBe(1)
    expect(result['2026-01-10'].transactions[1].id).toBe(2)
  })
})