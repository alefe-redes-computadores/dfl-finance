// Simula a busca de transações similares (mesma lógica do frontend)
function findSimilarTransactions(ocrData, existingTransactions) {
  if (!ocrData.amount || !ocrData.date) return []
  
  return existingTransactions.filter(tx => {
    const sameDay = tx.date === ocrData.date
    const similarAmount = Math.abs(tx.amount - ocrData.amount) <= 1
    const isPending = tx.status === 'pending'
    const isExpense = tx.type === 'expense'
    return sameDay && similarAmount && isPending && isExpense
  })
}

// Simula a decisão de conciliação
function shouldConcilie(ocrData, similarTransactions) {
  if (similarTransactions.length === 0) return null
  return similarTransactions[0] // Retorna a primeira transação similar
}

// Simula o preenchimento do formulário com dados do OCR (fallback)
function buildFormData(ocrData) {
  const data = {}
  if (ocrData.amount > 0) data.amount = ocrData.amount
  if (ocrData.date) data.date = ocrData.date
  if (ocrData.description) data.description = ocrData.description
  if (ocrData.suggested_category) data.suggested_category = ocrData.suggested_category
  return data
}

describe('Conciliação Inteligente', () => {
  const existingTxs = [
    { id: '1', description: 'Supermercado', amount: 150.00, date: '2026-06-29', status: 'pending', type: 'expense' },
    { id: '2', description: 'Uber', amount: 25.50, date: '2026-06-28', status: 'done', type: 'expense' },
    { id: '3', description: 'Farmácia', amount: 80.00, date: '2026-06-29', status: 'pending', type: 'expense' },
  ]

  describe('findSimilarTransactions', () => {
    it('encontra transação similar por data e valor aproximado', () => {
      const ocrData = { amount: 150.50, date: '2026-06-29' }
      const result = findSimilarTransactions(ocrData, existingTxs)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })

    it('não encontra transação se o status não for pending', () => {
      const ocrData = { amount: 25.00, date: '2026-06-28' }
      const result = findSimilarTransactions(ocrData, existingTxs)
      expect(result).toHaveLength(0)
    })

    it('retorna array vazio se não houver correspondência', () => {
      const ocrData = { amount: 500, date: '2026-06-30' }
      const result = findSimilarTransactions(ocrData, existingTxs)
      expect(result).toHaveLength(0)
    })

    it('retorna array vazio se dados do OCR forem inválidos', () => {
      const ocrData = { amount: 0, date: null }
      const result = findSimilarTransactions(ocrData, existingTxs)
      expect(result).toHaveLength(0)
    })

    it('encontra múltiplas transações similares', () => {
      const ocrData = { amount: 80.50, date: '2026-06-29' }
      const result = findSimilarTransactions(ocrData, existingTxs)
      expect(result).toHaveLength(2) // Supermercado (150) e Farmácia (80)
    })
  })

  describe('shouldConcilie', () => {
    it('retorna a primeira transação similar encontrada', () => {
      const similar = [{ id: '1', description: 'Supermercado', amount: 150.00, date: '2026-06-29' }]
      const result = shouldConcilie({}, similar)
      expect(result).not.toBeNull()
      expect(result.id).toBe('1')
    })

    it('retorna null se não houver similares', () => {
      const result = shouldConcilie({}, [])
      expect(result).toBeNull()
    })
  })

  describe('buildFormData', () => {
    it('converte dados do OCR para formato do formulário', () => {
      const ocrData = {
        amount: 75.90,
        date: '2026-06-29',
        description: 'Posto',
        suggested_category: 'Transporte',
      }
      const result = buildFormData(ocrData)
      expect(result).toEqual(ocrData)
    })

    it('ignora campos vazios ou inválidos', () => {
      const ocrData = {
        amount: 0,
        date: '',
        description: null,
        suggested_category: undefined,
      }
      const result = buildFormData(ocrData)
      expect(result).toEqual({})
    })
  })
})