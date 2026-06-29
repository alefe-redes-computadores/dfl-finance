// Filtro por tipo de arquivo
function filterReceipts(receipts, filterType) {
  if (filterType === 'all') return receipts
  if (filterType === 'image') return receipts.filter(r => r.isImage)
  if (filterType === 'pdf') return receipts.filter(r => !r.isImage)
  return receipts
}

// Busca por nome
function searchReceipts(receipts, query) {
  if (!query) return receipts
  const lower = query.toLowerCase()
  return receipts.filter(r => r.name.toLowerCase().includes(lower))
}

// Formata tamanho do arquivo
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

describe('Galeria de Comprovantes', () => {
  const receipts = [
    { name: 'foto-cupom.jpg', isImage: true, size: 204800 },
    { name: 'fatura.pdf', isImage: false, size: 1048576 },
    { name: 'nota-restaurante.png', isImage: true, size: 512000 },
  ]

  describe('filterReceipts', () => {
    it('retorna todos quando filtro é "all"', () => {
      expect(filterReceipts(receipts, 'all')).toHaveLength(3)
    })

    it('retorna apenas imagens', () => {
      const result = filterReceipts(receipts, 'image')
      expect(result).toHaveLength(2)
      expect(result.every(r => r.isImage)).toBe(true)
    })

    it('retorna apenas PDFs', () => {
      const result = filterReceipts(receipts, 'pdf')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('fatura.pdf')
    })
  })

  describe('searchReceipts', () => {
    it('encontra por nome parcial', () => {
      const result = searchReceipts(receipts, 'fatura')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('fatura.pdf')
    })

    it('retorna array vazio se não encontrar', () => {
      const result = searchReceipts(receipts, 'xyz')
      expect(result).toHaveLength(0)
    })

    it('retorna todos se query vazia', () => {
      const result = searchReceipts(receipts, '')
      expect(result).toHaveLength(3)
    })
  })

  describe('formatFileSize', () => {
    it('formata bytes', () => {
      expect(formatFileSize(500)).toBe('500 B')
    })

    it('formata KB', () => {
      expect(formatFileSize(204800)).toBe('200.0 KB')
    })

    it('formata MB', () => {
      expect(formatFileSize(1048576)).toBe('1.0 MB')
    })
  })
})