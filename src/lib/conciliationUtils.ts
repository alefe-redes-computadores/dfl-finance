// src/lib/conciliationUtils.ts
import { TransactionSuggestion } from '@/components/conciliation/ConciCard'

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function parseCSVToTransactions(
  csvContent: string
): Omit<TransactionSuggestion, 'id' | 'status'>[] {
  const lines = csvContent.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const dateIdx = headers.indexOf('date')
  const amountIdx = headers.indexOf('amount')
  const descIdx = headers.indexOf('description')
  const typeIdx = headers.indexOf('type')
  const accountIdx = headers.indexOf('account')

  if (dateIdx === -1 || amountIdx === -1) {
    throw new Error('CSV deve conter colunas: date, amount')
  }

  const result: Omit<TransactionSuggestion, 'id' | 'status'>[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim())
    const date = cols[dateIdx] || new Date().toISOString().split('T')[0]
    const description = descIdx >= 0 ? cols[descIdx] || 'Sem descrição' : 'Sem descrição'
    const amount = parseFloat(cols[amountIdx]) || 0
    const typeRaw = typeIdx >= 0 ? cols[typeIdx]?.toLowerCase() : ''
    const type: 'income' | 'expense' = typeRaw === 'income' ? 'income' : 'expense'
    const accountName = accountIdx >= 0 ? cols[accountIdx] || 'Conta Corrente' : 'Conta Corrente'

    if (amount > 0) {
      result.push({
        date,
        description,
        amount,
        type,
        accountName,
        source: 'csv',
      })
    }
  }

  return result
}

export function generateMockTransactions(
  count: number = 5
): Omit<TransactionSuggestion, 'id' | 'status'>[] {
  const descriptions = [
    'Supermercado Extra',
    'Farmácia Drogasil',
    'Restaurante Outback',
    'Uber Viagem',
    'Netflix',
    'Salário Empresa',
    'Freelance Design',
    'Aluguel Apartamento',
    'Energia Elétrica',
    'Água',
  ]
  const categories = ['Alimentação', 'Transporte', 'Lazer', 'Moradia', 'Serviços']
  const accounts = ['Conta Corrente', 'Poupança', 'Cartão de Crédito']

  const result: Omit<TransactionSuggestion, 'id' | 'status'>[] = []

  for (let i = 0; i < count; i++) {
    const isIncome = Math.random() > 0.7
    const amount = isIncome
      ? Math.round((1000 + Math.random() * 4000) * 100) / 100
      : Math.round((30 + Math.random() * 500) * 100) / 100

    const date = new Date()
    date.setDate(date.getDate() - Math.floor(Math.random() * 30))
    const dateStr = date.toISOString().split('T')[0]

    result.push({
      date: dateStr,
      description: descriptions[i % descriptions.length] + (i > 3 ? ` #${i + 1}` : ''),
      amount,
      type: isIncome ? 'income' : 'expense',
      categorySuggestion: categories[i % categories.length],
      accountName: accounts[i % accounts.length],
      source: 'manual',
    })
  }

  return result
}