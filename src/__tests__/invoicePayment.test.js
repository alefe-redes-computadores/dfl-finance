function applyPayment(invoice, paymentAmount) {
  const newPaid = (invoice.paid_amount || 0) + paymentAmount
  const total = invoice.total_amount
  let newStatus = 'open'
  if (newPaid >= total) {
    newStatus = 'paid'
  } else if (newPaid > 0) {
    newStatus = 'partial'
  }
  return {
    ...invoice,
    paid_amount: newPaid,
    status: newStatus,
  }
}

describe('applyPayment', () => {
  const invoice = {
    id: 'inv1',
    total_amount: 1000,
    paid_amount: 0,
    status: 'open',
  }

  it('aplica pagamento parcial e muda status para partial', () => {
    const result = applyPayment(invoice, 400)
    expect(result.paid_amount).toBe(400)
    expect(result.status).toBe('partial')
  })

  it('aplica pagamento total e muda status para paid', () => {
    const result = applyPayment(invoice, 1000)
    expect(result.paid_amount).toBe(1000)
    expect(result.status).toBe('paid')
  })

  it('acumula pagamentos parciais até quitar', () => {
    const partial = applyPayment(invoice, 600)
    const full = applyPayment(partial, 400)
    expect(full.paid_amount).toBe(1000)
    expect(full.status).toBe('paid')
  })
})
