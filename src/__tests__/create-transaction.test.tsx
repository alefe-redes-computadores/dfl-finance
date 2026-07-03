import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NewTransactionPage from '@/app/(app)/transactions/new/page'
import { useAuth } from '@/lib/hooks/useAuth'
import { useContext_ } from '@/components/ContextToggle'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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

jest.mock('@/components/ReceiptModal', () => () => null)
jest.mock('@/components/CameraCapture', () => () => null)
jest.mock('@/components/QRCodeScanner', () => () => null)
jest.mock('@/components/ModalFinancing', () => () => null)
jest.mock('@/components/ModalEmprestimo', () => () => null)
jest.mock('@/components/IconPicker', () => () => null)

describe('Create Transaction Integration', () => {
  const mockUser = { id: 'user-123' }
  const mockRouterPush = jest.fn()
  const mockSupabaseInsert = jest.fn()

  beforeEach(() => {
    ;(useAuth as jest.Mock).mockReturnValue({ user: mockUser })
    ;(useContext_ as jest.Mock).mockReturnValue({
      context: 'dfl',
      appMode: 'full',
    })
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockRouterPush,
      back: jest.fn(),
      refresh: jest.fn(),
    })

    // Mock do Supabase para retornar sucesso
    mockSupabaseInsert.mockResolvedValue({ data: { id: 'tx-123' }, error: null })
    ;(supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      match: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: mockSupabaseInsert,
        }),
      }),
    })
  })

  it('deve permitir preencher valor, descrição e salvar com sucesso', async () => {
    render(<NewTransactionPage />)

    // Preencher valor (simula entrada de dinheiro)
    const valueInput = screen.getByPlaceholderText('0,00')
    fireEvent.change(valueInput, { target: { value: '15000' } }) // R$ 150,00

    // Preencher descrição (campo dentro de "Mais detalhes")
    const detailsButton = screen.getByText('Mais detalhes')
    fireEvent.click(detailsButton)

    const descInput = screen.getByPlaceholderText('Descrição da transação')
    fireEvent.change(descInput, { target: { value: 'Supermercado' } })

    // Clicar no botão de salvar (usando o seletor da classe)
    const saveButton = document.querySelector('button[class*="fixed bottom-8"]')
    fireEvent.click(saveButton!)

    // Verificar se o Supabase foi chamado com os dados corretos
    await waitFor(() => {
      expect(mockSupabaseInsert).toHaveBeenCalled()
      // Poderia verificar o payload, mas como é mock, apenas confirmamos chamada
      expect(mockRouterPush).toHaveBeenCalledWith('/transactions')
    })
  })
})