// src/__tests__/components/conciliation/ConciSummary.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { ConciSummary } from '@/components/conciliation/ConciSummary'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

describe('ConciSummary', () => {
  const mockOnReset = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deve renderizar o resumo corretamente', () => {
    render(
      <ConciSummary
        total={10}
        approved={7}
        rejected={3}
        onReset={mockOnReset}
      />
    )

    expect(screen.getByText('Conciliação concluída! 🎉')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('deve chamar onReset ao clicar em "Recomeçar"', () => {
    render(
      <ConciSummary
        total={10}
        approved={7}
        rejected={3}
        onReset={mockOnReset}
      />
    )

    const resetButton = screen.getByText('Recomeçar')
    fireEvent.click(resetButton)

    expect(mockOnReset).toHaveBeenCalled()
  })

  it('deve mostrar zero quando não há transações', () => {
    render(
      <ConciSummary
        total={0}
        approved={0}
        rejected={0}
        onReset={mockOnReset}
      />
    )

    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
  })
})