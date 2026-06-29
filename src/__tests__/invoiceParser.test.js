// Simula o parser OFX com regex (mesma lógica da API Route)
function parseOFX(ofxText) {
  const transactions = []
  const stmttrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g
  let match

  while ((match = stmttrnRegex.exec(ofxText)) !== null) {
    const block = match[1]
    const dateMatch = block.match(/<DTPOSTED>(\d{8})/)
    const descriptionMatch = block.match(/<MEMO>(.*?)<\/MEMO>/) || block.match(/<NAME>(.*?)<\/NAME>/)
    const amountMatch = block.match(/<TRNAMT>([-\d.,]+)/)

    if (dateMatch && amountMatch) {
      const dateStr = dateMatch[1]
      const date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
      const amount = parseFloat(amountMatch[1].replace(',', '.'))
      const description = descriptionMatch?.[1]?.trim() || 'Transação OFX'

      transactions.push({
        date,
        description,
        amount: Math.abs(amount),
        suggested_category: 'Outros',
      })
    }
  }
  return transactions
}

// Simula a transformação para o payload que vai para o Supabase
function buildImportPayload(transactions, userId, context) {
  return transactions.map(tx => ({
    user_id: userId,
    type: 'expense',
    amount: tx.amount,
    description: tx.description,
    date: tx.date,
    status: 'pending',
    context,
  }))
}

describe('Leitor de Faturas', () => {
  describe('parseOFX', () => {
    it('extrai transações de um OFX válido', () => {
      const ofx = `
        <STMTTRN>
          <DTPOSTED>20260615</DTPOSTED>
          <MEMO>UBER TRIP</MEMO>
          <TRNAMT>-25.50</TRNAMT>
        </STMTTRN>
      `
      const result = parseOFX(ofx)
      expect(result).toHaveLength(1)
      expect(result[0].date).toBe('2026-06-15')
      expect(result[0].description).toBe('UBER TRIP')
      expect(result[0].amount).toBe(25.50)
    })

    it('retorna array vazio para OFX sem transações', () => {
      const result = parseOFX('<OFX></OFX>')
      expect(result).toHaveLength(0)
    })
  })

  describe('buildImportPayload', () => {
    it('converte transações extraídas para o formato do banco', () => {
      const extracted = [
        { date: '2026-06-15', description: 'Restaurante', amount: 89.90, suggested_category: 'Alimentação' },
        { date: '2026-06-16', description: 'Posto', amount: 200, suggested_category: 'Transporte' },
      ]
      const payload = buildImportPayload(extracted, 'user-123', 'personal')
      expect(payload).toHaveLength(2)
      expect(payload[0].user_id).toBe('user-123')
      expect(payload[0].type).toBe('expense')
      expect(payload[0].status).toBe('pending')
      expect(payload[0].context).toBe('personal')
    })
  })
})