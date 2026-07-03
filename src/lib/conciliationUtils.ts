// src/lib/conciliationUtils.ts
import { TransactionSuggestion } from '@/components/conciliation/ConciCard'

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function parseCSVToTransactions(csvContent: string): Omit<TransactionSuggestion, 'id' | 'status'>[] {
  // Exemplo simples: espera CSV com colunas: date,description,amount,type
  const lines = csvContent.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const dateIdx = headers.indexOf('date')
  const descIdx = headers.indexOf('description')
  const amountIdx = headers.indexOf('amount')
  const typeIdx = headers.indexOf('type')

  if (dateIdx === -1 || amountIdx === -1) {
    throw new Error('CSV deve conter colunas: date, amount (e opcionalmente description, type)')
  }

  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim())
    return {
      date: cols[dateIdx] || new Date().toISOString().split('T')[0],
      description: descIdx >= 0 ? cols[descIdx] || 'Sem descrição' : 'Sem descrição',
      amount: parseFloat(cols[amountIdx]) || 0,
      type: (typeIdx >= 0 && cols[typeIdx]?.toLowerCase() === 'income') ? 'income' : 'expense',
      source: 'csv' as const,
    }
  }).filter(t => t.amount > 0)
}

export function generateMockTransactions(count: number = 5): Omit<TransactionSuggestion, 'id' | 'status'>[] {
  const descriptions = [
    'Supermercado', 'Farmácia', 'Restaurante', 'Uber', 'Netflix',
    'Salário', 'Freelance', 'Aluguel', 'Energia', 'Água',
  ]
  const categories = ['Alimentação', 'Transporte', 'Lazer', 'Moradia', 'Serviços']
  const accounts = ['Conta Corrente', 'Poupança', 'Cartão Crédito']

  return Array.from({ length: count }, (_, i) => {
    const isIncome = Math.random() > 0.7
    const amount = isIncome
      ? Math.round((1000 + Math.random() * 4000) * 100) / 100
      : Math.round((30 + Math.random() * 500) * 100) / 100

    const date = new Date()
    date.setDate(date.getDate() - Math.floor(Math.random() * 30))

    return {
      date: date.toISOString().split('T')[0],
      description: descriptions[i % descriptions.length] + (i > 3 ? ` #${i+1}` : ''),
      amount,
      type: isIncome ? 'income' : 'expense',
      categorySuggestion: categories[i % categories.length],
      accountSuggestion: accounts[i % accounts.length],
      source: 'manual' as const,
    }
  })
}