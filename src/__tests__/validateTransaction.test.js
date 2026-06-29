function validateTransactionPayload(payload) {
  const errors = []
  if (!payload.user_id) errors.push('user_id é obrigatório')
  if (!payload.amount || payload.amount <= 0) errors.push('amount deve ser maior que zero')
  if (!['income', 'expense', 'transfer'].includes(payload.type)) errors.push('type inválido')
  return errors
}

describe('validateTransactionPayload', () => {
  it('retorna erro se user_id estiver ausente', () => {
    const errors = validateTransactionPayload({ amount: 100, type: 'expense' })
    expect(errors).toContain('user_id é obrigatório')
  })

  it('retorna erro se amount for zero ou negativo', () => {
    const errors = validateTransactionPayload({ user_id: 'u1', amount: 0, type: 'expense' })
    expect(errors).toContain('amount deve ser maior que zero')
  })

  it('retorna erro se type for inválido', () => {
    const errors = validateTransactionPayload({ user_id: 'u1', amount: 50, type: 'invalid' })
    expect(errors).toContain('type inválido')
  })

  it('retorna array vazio para payload válido', () => {
    const errors = validateTransactionPayload({ user_id: 'u1', amount: 50, type: 'expense' })
    expect(errors).toHaveLength(0)
  })
})