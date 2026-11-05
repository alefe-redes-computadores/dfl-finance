// src/__tests__/components/conciliation/ConciCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { ConciCard } from '@/components/conciliation/ConciCard'

jest.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({
    success: jest.fn(),
    error: jest.fn(),
    vibrate: jest.fn(),
  }),
}))

describe('ConciCard', () => {
  const mockTransaction = {
    id: '1',
    date: '2026-07-01',
    description: 'Supermercado Extra',
    amount: 150.00,
    type: 'expense' as const,
    categorySuggestion: 'Alimentação',
    accountName: 'Conta Corrente',
    source: 'manual' as const,
  }

  const mockApprove = jest.fn()
  const mockReject = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deve renderizar os dados da transação corretamente', () => {
    render(
      <ConciCard
        transaction={mockTransaction}
        onApprove={mockApprove}
        onReject={mockReject}
      />
    )

    expect(screen.getByText('Supermercado Extra')).toBeInTheDocument()
    expect(screen.getByText('R$ 150,00')).toBeInTheDocument()
    expect(screen.getByText('Saída')).toBeInTheDocument()
    expect(screen.getByText('Conta Corrente')).toBeInTheDocument()
    expect(screen.getByText('Alimentação')).toBeInTheDocument()
  })

  it('deve mostrar skeleton quando isLoading=true', () => {
    render(
      <ConciCard
        transaction={mockTransaction}
        onApprove={mockApprove}
        onReject={mockReject}
        isLoading={true}
      />
    )

    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeInTheDocument()
  })

  it('deve chamar onApprove ao clicar no botão "Aprovar"', () => {
    render(
      <ConciCard
        transaction={mockTransaction}
        onApprove={mockApprove}
        onReject={mockReject}
      />
    )

    const approveButton = screen.getByText('Conciliar')
    fireEvent.click(approveButton)

    expect(mockApprove).toHaveBeenCalledWith('1')
  })

  it('deve chamar onReject ao clicar no botão "Descartar"', () => {
    render(
      <ConciCard
        transaction={mockTransaction}
        onApprove={mockApprove}
        onReject={mockReject}
      />
    )

    const rejectButton = screen.getByText('Adiar')
    fireEvent.click(rejectButton)

    expect(mockReject).toHaveBeenCalledWith('1')
  })

  it('deve mostrar badge "Última transação" quando isLast=true', () => {
    const { container } = render(
      <ConciCard
        transaction={mockTransaction}
        onApprove={mockApprove}
        onReject={mockReject}
        isLast={true}
      />
    )

    expect(container.querySelector('.border-b-4.border-emerald-400')).toBeInTheDocument()
  })

  it('deve mostrar indicador de receita quando type=income', () => {
    const incomeTransaction = {
      ...mockTransaction,
      type: 'income' as const,
      description: 'Salário',
    }

    render(
      <ConciCard
        transaction={incomeTransaction}
        onApprove={mockApprove}
        onReject={mockReject}
      />
    )

    expect(screen.getByText('Entrada')).toBeInTheDocument()
  })

  it('deve mostrar fonte da transação corretamente', () => {
    const csvTransaction = {
      ...mockTransaction,
      source: 'csv' as const,
    }

    render(
      <ConciCard
        transaction={csvTransaction}
        onApprove={mockApprove}
        onReject={mockReject}
      />
    )

    expect(screen.getByText('Origem: Extrato (CSV)')).toBeInTheDocument()
  })
})
