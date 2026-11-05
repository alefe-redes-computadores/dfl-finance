import 'fake-indexeddb/auto'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NewTransactionPage from '@/app/(app)/transactions/new/page'
import { useAuth } from '@/lib/hooks/useAuth'
import { useContext_ } from '@/components/ContextToggle'
import { db } from '@/lib/db'
import { serialize, deserialize } from 'node:v8'
const mockShowToast = jest.fn()
jest.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }))

jest.mock('@/lib/hooks/useAuth')
jest.mock('@/components/ContextToggle')
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}))
jest.mock('@/hooks/useLocalSync', () => ({
  useLocalSync: () => ({
    isOnline: true,
    saveToQueue: jest.fn(),
  }),
}))
jest.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({
    vibrate: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
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

  beforeEach(() => {
    Object.defineProperty(globalThis, 'structuredClone', { configurable: true, value: (value: unknown) => deserialize(serialize(value)) })
    mockShowToast.mockClear()
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: jest.fn().mockReturnValue('00000000-0000-4000-8000-000000000001') })
    ;(useAuth as jest.Mock).mockReturnValue({ user: mockUser })
    ;(useContext_ as jest.Mock).mockReturnValue({
      context: 'dfl',
      effectiveContext: 'dfl',
      appMode: 'full',
    })

  })

  it('deve permitir preencher valor, descrição e salvar com sucesso', async () => {
    render(<NewTransactionPage />)

    // Preencher valor (simula entrada de dinheiro)
    const valueInput = screen.getByPlaceholderText('0,00')
    fireEvent.change(valueInput, { target: { value: '15000' } }) // R$ 150,00

    // A tela atual mostra descrição no fluxo principal e persiste primeiro
    // em Dexie; sincronização remota não é uma responsabilidade deste teste.
    const descInput = screen.getByPlaceholderText('Nome ou descrição')
    fireEvent.change(descInput, { target: { value: 'Supermercado' } })

    expect(valueInput).toHaveValue('150,00')
    expect(descInput).toHaveValue('Supermercado')
    expect(screen.getByRole('button', { name: /Marcar como (pago|pendente)/ })).toBeInTheDocument()
    if (screen.queryByRole('button', { name: 'Marcar como pendente' })) {
      fireEvent.click(screen.getByRole('button', { name: 'Marcar como pendente' }))
    }
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar despesa' }))
    await waitFor(() => expect(mockShowToast).toHaveBeenCalled())
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('adicionada'), 'success')
    await waitFor(async () => {
      const rows = await db.transactions.where('user_id').equals('user-123').toArray()
      expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ description: 'Supermercado', amount: 150, status: 'pending', context: 'dfl' })]))
    })
  })
})
