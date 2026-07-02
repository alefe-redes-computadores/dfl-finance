import { render, screen, waitFor } from '@testing-library/react'
import { ContextProvider } from '@/components/ContextToggle'

// Mock do supabase
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  match: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
}

jest.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}))

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
    // Mock dos dados vazios
    mockSupabase.from.mockImplementation((table: string) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      match: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: [], error: null }),
    }))

    render(
      <ContextProvider>
        <NotificationsPage />
      </ContextProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Tudo sob controle!')).toBeInTheDocument()
    })
  })

  it('deve gerar notificação de fatura vencida', async () => {
    // Mock de cartão de crédito com fatura vencida
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'credit_cards') {
        return {
          select: jest.fn().mockReturnThis(),
          match: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [{ id: 'card-1', name: 'Nubank', due_day: 1, closing_day: 25 }],
            error: null
          })
        }
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        match: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
    })

    render(
      <ContextProvider>
        <NotificationsPage />
      </ContextProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Fatura vencida/)).toBeInTheDocument()
    })
  })
})