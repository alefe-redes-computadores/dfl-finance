// src/lib/conciliationUtils.ts
import { TransactionSuggestion } from '@/components/conciliation/ConciCard'

/**
 * Formata um valor numérico para moeda brasileira (R$)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/**
 * Converte um arquivo CSV em um array de transações sugeridas
 * Espera colunas: date, amount (obrigatórias) e opcionalmente description, type
 */
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

  if (dateIdx === -1 || amountIdx === -1) {
    throw new Error('CSV deve conter colunas: date, amount (e opcionalmente description, type)')
  }

  const result: Omit<TransactionSuggestion, 'id' | 'status'>[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim())
    const date = cols[dateIdx] || new Date().toISOString().split('T')[0]
    const description = descIdx >= 0 ? cols[descIdx] || 'Sem descrição' : 'Sem descrição'
    const amount = parseFloat(cols[amountIdx]) || 0
    const typeRaw = typeIdx >= 0 ? cols[typeIdx]?.toLowerCase() : ''
    const type: 'income' | 'expense' = typeRaw === 'income' ? 'income' : 'expense'

    if (amount > 0) {
      result.push({
        date,
        description,
        amount,
        type,
        source: 'csv',
      })
    }
  }

  return result
}

/**
 * Gera transações de exemplo para teste da conciliação
 */
export function generateMockTransactions(
  count: number = 5
): Omit<TransactionSuggestion, 'id' | 'status'>[] {
  const descriptions = [
    'Supermercado',
    'Farmácia',
    'Restaurante',
    'Uber',
    'Netflix',
    'Salário',
    'Freelance',
    'Aluguel',
    'Energia',
    'Água',
  ]
  const categories = ['Alimentação', 'Transporte', 'Lazer', 'Moradia', 'Serviços']
  const accounts = ['Conta Corrente', 'Poupança', 'Cartão Crédito']

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
      accountSuggestion: accounts[i % accounts.length],
      source: 'manual',
    })
  }

  return result
}