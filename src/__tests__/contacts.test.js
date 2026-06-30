// Simula a classificação de contatos por tipo
function getContactTypeLabel(type) {
  const labels = {
    supplier: 'Fornecedor',
    customer: 'Cliente',
    both: 'Fornecedor/Cliente'
  }
  return labels[type] || type
}

// Simula o filtro de transações por contato
function filterTransactionsByContact(transactions, contactId) {
  if (!contactId) return transactions
  return transactions.filter(tx => tx.contact_id === contactId)
}

// Simula o total pendente por contato
function calculateContactTotals(transactions, contactId) {
  const contactTxs = transactions.filter(tx => 
    tx.contact_id === contactId && tx.status === 'pending'
  )
  const toPay = contactTxs
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0)
  const toReceive = contactTxs
    .filter(tx => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0)
  return { toPay, toReceive }
}

describe('Gestão de Contatos (Fornecedores/Clientes)', () => {
  describe('getContactTypeLabel', () => {
    it('retorna "Fornecedor" para supplier', () => {
      expect(getContactTypeLabel('supplier')).toBe('Fornecedor')
    })
    it('retorna "Cliente" para customer', () => {
      expect(getContactTypeLabel('customer')).toBe('Cliente')
    })
    it('retorna "Fornecedor/Cliente" para both', () => {
      expect(getContactTypeLabel('both')).toBe('Fornecedor/Cliente')
    })
  })

  describe('filterTransactionsByContact', () => {
    const txs = [
      { id: 1, contact_id: 'c1', amount: 100 },
      { id: 2, contact_id: 'c2', amount: 200 },
      { id: 3, contact_id: null, amount: 300 },
    ]
    it('filtra por contact_id', () => {
      expect(filterTransactionsByContact(txs, 'c1')).toHaveLength(1)
    })
    it('retorna todas se contactId for nulo', () => {
      expect(filterTransactionsByContact(txs, null)).toHaveLength(3)
    })
  })

  describe('calculateContactTotals', () => {
    const txs = [
      { contact_id: 'c1', type: 'expense', amount: 100, status: 'pending' },
      { contact_id: 'c1', type: 'income', amount: 50, status: 'pending' },
      { contact_id: 'c1', type: 'expense', amount: 30, status: 'done' },
    ]
    it('calcula totais pendentes por contato', () => {
      const totals = calculateContactTotals(txs, 'c1')
      expect(totals.toPay).toBe(100)
      expect(totals.toReceive).toBe(50)
    })
  })
})