import { render, screen, waitFor } from '@testing-library/react'
import { ContextProvider } from '@/components/ContextToggle'

let mockLocalRows: any[] = []

// Notifications are local-first.  Mock the repository boundary instead of an
// obsolete Supabase query chain that this page no longer calls.
jest.mock('@/hooks/useLocalData', () => ({
  useLocalData: () => ({ data: mockLocalRows, reload: jest.fn().mockResolvedValue(undefined) }),
}))
jest.mock('@/hooks/useSafeDb', () => ({
  useSafeDb: () => ({ safeDelete: jest.fn(), safeUpdate: jest.fn() }),
}))
jest.mock('@/hooks/useAdmin', () => ({ useIsAdmin: () => ({ isAdmin: false, loading: false }) }))

// Mock do useAuth
jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user' }, loading: false })
}))

// Mock do useRouter
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), refresh: jest.fn() })
}))

// Mock do useToast
jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: jest.fn() })
}))

// Mock do date-fns para evitar problemas de timezone
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  format: jest.fn().mockReturnValue('2026-07-01'),
  differenceInDays: jest.fn().mockReturnValue(2),
}))

import NotificationsPage from '@/app/(app)/notifications/page'

describe('NotificationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deve exibir mensagem de "Tudo sob controle" quando não há notificações', async () => {
    mockLocalRows = []

    render(
      <ContextProvider>
        <NotificationsPage />
      </ContextProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Nenhuma notificação')).toBeInTheDocument()
    })
  })

  it('deve exibir uma notificação local pendente', async () => {
    mockLocalRows = [{ id: 'invoice-1', title: 'Fatura vencida', message: 'Nubank', is_read: false, created_at: '2026-07-01T12:00:00Z', type: 'warning' }]

    render(
      <ContextProvider>
        <NotificationsPage />
      </ContextProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Fatura vencida')).toBeInTheDocument()
    })
  })
})
