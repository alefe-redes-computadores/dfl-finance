// Simula a aplicação de filtros cruzados em uma lista de transações
function applyCrossFilters(transactions, filters) {
  let result = [...transactions]

  if (filters.tags && filters.tags.length > 0) {
    result = result.filter(tx => {
      if (!tx.tag_ids || tx.tag_ids.length === 0) return false
      return tx.tag_ids.some((tagId: string) => filters.tags.includes(tagId))
    })
  }

  if (filters.accounts && filters.accounts.length > 0) {
    result = result.filter(tx => filters.accounts.includes(tx.account_id))
  }

  if (filters.creditCards && filters.creditCards.length > 0) {
    result = result.filter(tx => filters.creditCards.includes(tx.credit_card_id))
  }

  return result
}

// Simula o agrupamento de transações por período (dia)
function groupByDate(transactions) {
  const groups: Record<string, any[]> = {}
  transactions.forEach(tx => {
    const key = tx.date
    if (!groups[key]) groups[key] = []
    groups[key].push(tx)
  })
  return groups
}

// Simula o cálculo de totais do relatório
function calculateTotals(transactions) {
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
  const expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
  return { income, expense, balance: income - expense }
}

describe('Filtros Cruzados e Relatórios', () => {
  const transactions = [
    { id: '1', type: 'expense', amount: 100, date: '2026-06-20', tag_ids: ['tag1'], account_id: 'acc1', credit_card_id: null },
    { id: '2', type: 'expense', amount: 200, date: '2026-06-20', tag_ids: ['tag2'], account_id: 'acc2', credit_card_id: 'card1' },
    { id: '3', type: 'income', amount: 500, date: '2026-06-21', tag_ids: ['tag1'], account_id: 'acc1', credit_card_id: null },
    { id: '4', type: 'expense', amount: 50, date: '2026-06-21', tag_ids: [], account_id: 'acc1', credit_card_id: null },
  ]

  describe('applyCrossFilters', () => {
    it('filtra por tags', () => {
      const result = applyCrossFilters(transactions, { tags: ['tag1'], accounts: [], creditCards: [] })
      expect(result).toHaveLength(2)
      expect(result.every(tx => tx.tag_ids.includes('tag1'))).toBe(true)
    })

    it('filtra por contas', () => {
      const result = applyCrossFilters(transactions, { tags: [], accounts: ['acc1'], creditCards: [] })
      expect(result).toHaveLength(3)
      expect(result.every(tx => tx.account_id === 'acc1')).toBe(true)
    })

    it('filtra por cartões de crédito', () => {
      const result = applyCrossFilters(transactions, { tags: [], accounts: [], creditCards: ['card1'] })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('2')
    })

    it('combina múltiplos filtros', () => {
      const result = applyCrossFilters(transactions, { tags: ['tag1'], accounts: ['acc1'], creditCards: [] })
      expect(result).toHaveLength(2)
      expect(result.every(tx => tx.account_id === 'acc1' && tx.tag_ids.includes('tag1'))).toBe(true)
    })

    it('retorna array vazio se nenhum filtro corresponder', () => {
      const result = applyCrossFilters(transactions, { tags: ['tag3'], accounts: [], creditCards: [] })
      expect(result).toHaveLength(0)
    })

    it('retorna todos se nenhum filtro estiver ativo', () => {
      const result = applyCrossFilters(transactions, { tags: [], accounts: [], creditCards: [] })
      expect(result).toHaveLength(4)
    })
  })

  describe('groupByDate', () => {
    it('agrupa transações por data', () => {
      const groups = groupByDate(transactions)
      const keys = Object.keys(groups)
      expect(keys).toHaveLength(2)
      expect(groups['2026-06-20']).toHaveLength(2)
      expect(groups['2026-06-21']).toHaveLength(2)
    })
  })

  describe('calculateTotals', () => {
    it('calcula receitas, despesas e saldo', () => {
      const totals = calculateTotals(transactions)
      expect(totals.income).toBe(500)
      expect(totals.expense).toBe(350)
      expect(totals.balance).toBe(150)
    })
  })
})