// src/__tests__/integration/conciliation-flow.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ConciliationPage from '@/app/(app)/conciliation/page'
import { useConciQueue } from '@/hooks/useConciQueue'

jest.mock('@/hooks/useConciQueue')
jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: jest.fn(),
  }),
}))

describe('Fluxo de Conciliação', () => {
  const mockQueue = {
    queue: [
      { id: '1', date: '2026-07-01', description: 'Teste 1', amount: 100, type: 'expense', status: 'pending' },
      { id: '2', date: '2026-07-02', description: 'Teste 2', amount: 200, type: 'income', status: 'pending' },
    ],
    current: { id: '1', date: '2026-07-01', description: 'Teste 1', amount: 100, type: 'expense', status: 'pending' },
    currentIndex: 0,
    total: 2,
    approved: 0,
    rejected: 0,
    isComplete: false,
    approve: jest.fn(),
    reject: jest.fn(),
    reset: jest.fn(),
    clear: jest.fn(),
    getStats: jest.fn(() => ({ approved: 0, rejected: 0, pending: 2 })),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useConciQueue as jest.Mock).mockReturnValue(mockQueue)
  })

  it('deve renderizar a página de conciliação', () => {
    render(<ConciliationPage />)
    expect(screen.getByText('Conciliação')).toBeInTheDocument()
  })

  it('deve mostrar o card da transação atual', () => {
    render(<ConciliationPage />)
    expect(screen.getByText('Teste 1')).toBeInTheDocument()
    expect(screen.getByText('R$ 100,00')).toBeInTheDocument()
  })

  it('deve chamar approve ao clicar no botão Aprovar', async () => {
    render(<ConciliationPage />)
    
    const approveButton = screen.getByText('Aprovar')
    fireEvent.click(approveButton)

    await waitFor(() => {
      expect(mockQueue.approve).toHaveBeenCalled()
    })
  })

  it('deve chamar reject ao clicar no botão Descartar', async () => {
    render(<ConciliationPage />)
    
    const rejectButton = screen.getByText('Descartar')
    fireEvent.click(rejectButton)

    await waitFor(() => {
      expect(mockQueue.reject).toHaveBeenCalled()
    })
  })
})
