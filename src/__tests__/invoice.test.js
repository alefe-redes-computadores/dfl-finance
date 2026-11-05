async function createInvoiceForTransaction({ creditCardId, amount, date }) {
  if (!creditCardId) return null
  
  const txDate = new Date(date + 'T12:00:00Z')
  const closingDay = 10
  let closingDate = new Date(Date.UTC(txDate.getUTCFullYear(), txDate.getUTCMonth(), closingDay))
  if (txDate > closingDate) {
    closingDate = new Date(Date.UTC(txDate.getUTCFullYear(), txDate.getUTCMonth() + 1, closingDay))
  }
  
  const dueDate = new Date(closingDate)
  dueDate.setUTCDate(15)

  return {
    id: 'mock-invoice-id',
    closing_date: closingDate.toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
    total_amount: amount,
    status: 'open',
  }
}

describe('createInvoiceForTransaction', () => {
  it('retorna null se não há cartão de crédito', async () => {
    const result = await createInvoiceForTransaction({ creditCardId: null, amount: 100, date: '2026-01-05' })
    expect(result).toBeNull()
  })

  it('cria fatura com data de fechamento correta', async () => {
    const result = await createInvoiceForTransaction({ creditCardId: 'card-123', amount: 100, date: '2026-01-05' })
    expect(result).not.toBeNull()
    expect(result.status).toBe('open')
    expect(result.total_amount).toBe(100)
    expect(result.closing_date).toBe('2026-01-10')
    expect(result.due_date).toBe('2026-01-15')
  })

  it('ajusta data de fechamento se a transação for após o fechamento', async () => {
    const result = await createInvoiceForTransaction({ creditCardId: 'card-123', amount: 200, date: '2026-01-12' })
    expect(result.closing_date).toBe('2026-02-10')
  })
})
