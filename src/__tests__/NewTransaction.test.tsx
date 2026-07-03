import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NewTransactionPage from '@/app/(app)/transactions/new/page'
import { useAuth } from '@/lib/hooks/useAuth'
import { useContext_ } from '@/components/ContextToggle'
import { supabase } from '@/lib/supabase'

// Mocks
jest.mock('@/lib/hooks/useAuth')
jest.mock('@/components/ContextToggle')
jest.mock('@/lib/supabase')
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}))
jest.mock('@/hooks/useOfflineQueue', () => ({
  useOfflineQueue: () => ({
    isOnline: true,
    saveToQueue: jest.fn(),
  }),
}))
jest.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({
    vibrate: jest.fn(),
    success: jest.fn(),
  }),
}))

// Mock dos modais pesados para simplificar
jest.mock('@/components/ReceiptModal', () => () => null)
jest.mock('@/components/CameraCapture', () => () => null)
jest.mock('@/components/QRCodeScanner', () => () => null)
jest.mock('@/components/ModalFinancing', () => () => null)
jest.mock('@/components/ModalEmprestimo', () => () => null)
jest.mock('@/components/IconPicker', () => () => null)

describe('NewTransactionPage', () => {
  const mockUser = { id: 'user-123' }

  beforeEach(() => {
    ;(useAuth as jest.Mock).mockReturnValue({ user: mockUser })
    ;(useContext_ as jest.Mock).mockReturnValue({
      context: 'dfl',
      appMode: 'full',
    })
    // Mock de dados do Supabase
    ;(supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      match: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })
  })

  it('deve renderizar o título correto para despesa', () => {
    render(<NewTransactionPage />)
    expect(screen.getByText('Nova Despesa')).toBeInTheDocument()
  })

  it('deve exibir o botão de salvar (ícone de check)', () => {
    render(<NewTransactionPage />)
    // O botão tem um ícone Check, podemos buscar pelo papel ou pela classe
    const saveButton = document.querySelector('button[class*="fixed bottom-8"]')
    expect(saveButton).toBeInTheDocument()
  })

  it('deve exibir o input de valor com placeholder "0,00"', () => {
    render(<NewTransactionPage />)
    const valueInput = screen.getByPlaceholderText('0,00')
    expect(valueInput).toBeInTheDocument()
  })

  it('deve exibir os botões de QR Code e anexo', () => {
    render(<NewTransactionPage />)
    const qrButton = screen.getByRole('button', { name: /QrCode/i })
    const attachButton = screen.getByRole('button', { name: /Camera/i })
    expect(qrButton).toBeInTheDocument()
    expect(attachButton).toBeInTheDocument()
  })

  it('deve mostrar "Mais detalhes" ao clicar no botão', () => {
    render(<NewTransactionPage />)
    const detailsButton = screen.getByText('Mais detalhes')
    fireEvent.click(detailsButton)
    // Verifica se o campo de data aparece (está dentro da seção de detalhes)
    expect(screen.getByDisplayValue(/^\d{4}-\d{2}-\d{2}$/)).toBeInTheDocument()
  })
})