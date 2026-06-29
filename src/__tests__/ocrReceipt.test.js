// Simula a extração do JSON da resposta do Gemini
function extractJSONFromText(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0])
  }
  return null
}

// Simula o mapeamento da categoria sugerida para uma categoria existente
function mapSuggestedCategory(suggestedCategory, categories) {
  if (!suggestedCategory || !categories) return null
  const matched = categories.find(
    (c) => c.name.toLowerCase() === suggestedCategory.toLowerCase()
  )
  return matched ? matched.id : null
}

// Simula a construção do payload para preencher o formulário
function buildOCRFormPayload(ocrData) {
  const payload = {}
  if (ocrData.amount > 0) payload.amount = ocrData.amount
  if (ocrData.date) payload.date = ocrData.date
  if (ocrData.description) payload.description = ocrData.description
  if (ocrData.suggested_category) payload.suggested_category = ocrData.suggested_category
  return payload
}

// Mock do feedback háptico (teste de segurança)
function safeVibrate(pattern) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern)
    return true
  }
  return false
}

describe('OCR de Comprovantes', () => {
  describe('extractJSONFromText', () => {
    it('extrai JSON válido da resposta do Gemini', () => {
      const response = '```json\n{"amount": 50.00, "date": "2026-06-29", "description": "Supermercado", "suggested_category": "Alimentação"}\n```'
      const result = extractJSONFromText(response)
      expect(result).toEqual({
        amount: 50.00,
        date: '2026-06-29',
        description: 'Supermercado',
        suggested_category: 'Alimentação',
      })
    })

    it('retorna null para resposta sem JSON', () => {
      const response = 'Não foi possível ler o comprovante.'
      const result = extractJSONFromText(response)
      expect(result).toBeNull()
    })

    it('extrai JSON mesmo sem marcação de código', () => {
      const response = '{"amount": 75.90, "date": "2026-06-28", "description": "Posto de Gasolina", "suggested_category": "Transporte"}'
      const result = extractJSONFromText(response)
      expect(result.amount).toBe(75.90)
    })
  })

  describe('mapSuggestedCategory', () => {
    const categories = [
      { id: '1', name: 'Alimentação', icon: 'utensils' },
      { id: '2', name: 'Transporte', icon: 'car' },
      { id: '3', name: 'Moradia', icon: 'home' },
    ]

    it('encontra categoria correspondente (case insensitive)', () => {
      const result = mapSuggestedCategory('alimentação', categories)
      expect(result).toBe('1')
    })

    it('retorna null se não houver correspondência', () => {
      const result = mapSuggestedCategory('Lazer', categories)
      expect(result).toBeNull()
    })

    it('retorna null se a categoria sugerida for vazia', () => {
      const result = mapSuggestedCategory('', categories)
      expect(result).toBeNull()
    })
  })

  describe('buildOCRFormPayload', () => {
    it('converte dados do OCR para payload do formulário', () => {
      const ocrData = {
        amount: 120.50,
        date: '2026-06-29',
        description: 'Farmácia',
        suggested_category: 'Saúde',
      }
      const payload = buildOCRFormPayload(ocrData)
      expect(payload).toEqual(ocrData)
    })

    it('ignora campos com valor inválido', () => {
      const ocrData = {
        amount: 0,
        date: null,
        description: '',
        suggested_category: undefined,
      }
      const payload = buildOCRFormPayload(ocrData)
      expect(payload).toEqual({})
    })
  })

  describe('safeVibrate', () => {
    it('retorna false se navigator.vibrate não existe (ambiente de teste)', () => {
      const result = safeVibrate([50, 100])
      expect(result).toBe(false)
    })
  })
})