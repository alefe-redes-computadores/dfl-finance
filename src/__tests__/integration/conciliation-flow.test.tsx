import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ConciliationPage from '@/app/(app)/conciliation/page'

const mockConciliatePendingTransaction = jest.fn().mockResolvedValue({ alreadyDone: false })
const mockToday = new Date().toLocaleDateString('en-CA')

jest.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => ({
    transactions: [{ id: 'pending-1', user_id: 'user-1', context: 'dfl', description: 'Teste 1', amount: 100, type: 'expense', status: 'pending', date: mockToday, account_id: 'account-1', source: 'whatsapp', affects_balance: false }],
    accounts: [{ id: 'account-1', name: 'Conta principal', user_id: 'user-1', context: 'dfl' }], categories: [],
  }),
}))
jest.mock('@/lib/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
jest.mock('@/components/ContextToggle', () => ({ useContext_: () => ({ context: 'dfl', appMode: 'full' }) }))
jest.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }))
jest.mock('@/hooks/useHapticFeedback', () => ({ useHapticFeedback: () => ({ light: jest.fn(), success: jest.fn(), error: jest.fn() }) }))
jest.mock('@/lib/conciliationOperations', () => ({ conciliatePendingTransaction: (...args: unknown[]) => mockConciliatePendingTransaction(...args), saveConciliationReview: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

describe('Fluxo de Conciliação', () => {
  beforeEach(() => mockConciliatePendingTransaction.mockClear())

  it('renderiza a Inbox financeira e a transação pendente atual', () => {
    render(<ConciliationPage />)
    expect(screen.getByText('Inbox financeira')).toBeInTheDocument()
    expect(screen.getByText('Teste 1')).toBeInTheDocument()
    expect(screen.getAllByText(/100,00/).length).toBeGreaterThan(0)
  })

  it('concilia uma pendência com conta através da operação atômica atual', async () => {
    render(<ConciliationPage />)
    fireEvent.click(screen.getByRole('button', { name: /Conciliar/ }))
    await waitFor(() => expect(mockConciliatePendingTransaction).toHaveBeenCalledWith('user-1', 'pending-1'))
  })

  it('abre revisão sem efetivar saldo quando o usuário escolhe revisar', () => {
    render(<ConciliationPage />)
    fireEvent.click(screen.getByRole('button', { name: /^Revisar$/ }))
    expect(screen.getByText('Revisar pendência')).toBeInTheDocument()
    expect(mockConciliatePendingTransaction).not.toHaveBeenCalled()
  })
})
