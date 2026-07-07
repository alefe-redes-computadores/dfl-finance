import { renderHook, waitFor } from '@testing-library/react'
import { useLocalData } from '../useLocalData'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'

// ============================================================
// 🛠️ MOCKS (Simulando o ambiente)
// ============================================================

// 1. Simula o hook de autenticação
jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}))

// 2. Simula o Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [{ id: '1', name: 'Teste Remoto' }], error: null }),
    })),
  },
}))

// 3. Simula o Dexie e o liveQuery
jest.mock('dexie', () => ({
  liveQuery: jest.fn((callback) => ({
    subscribe: jest.fn(({ next }) => {
      // Simula o banco local retornando dados instantaneamente
      next([{ id: 'local-1', name: 'Teste Local' }])
      return { unsubscribe: jest.fn() }
    }),
  })),
}))

// 4. Simula o banco de dados local (db)
jest.mock('@/lib/db', () => ({
  db: {
    table: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      equals: jest.fn().mockReturnThis(),
      and: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([{ id: 'local-1', name: 'Teste Local' }]),
      bulkPut: jest.fn().mockResolvedValue(true),
    })),
  },
}))

// ============================================================
// 🧪 SUÍTE DE TESTES
// ============================================================
describe('Hook: useLocalData', () => {
  const mockUser = { id: 'user-123' }

  beforeEach(() => {
    // Limpa os mocks antes de cada teste
    jest.clearAllMocks()
    ;(useAuth as jest.Mock).mockReturnValue({ user: mockUser })
  })

  it('Deve retornar dados locais e loading falso quando inicializado', async () => {
    const { result } = renderHook(() => useLocalData({ table: 'transactions' as any }))

    // Aguarda a resolução do liveQuery
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data[0].name).toBe('Teste Local')
  })

  it('NÃO deve chamar o Supabase se o usuário estiver OFFLINE', async () => {
    // Força o navegador a simular que está offline
    jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    renderHook(() => useLocalData({ table: 'transactions' as any }))

    // Aguarda um momento para garantir que os efeitos rodaram
    await waitFor(() => {
      // O Supabase NÃO deve ter sido chamado nenhuma vez!
      expect(supabase.from).not.toHaveBeenCalled()
    })
  })

  it('DEVE chamar o Supabase para sincronizar se o usuário estiver ONLINE', async () => {
    // Força o navegador a simular que está online
    jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)

    renderHook(() => useLocalData({ table: 'transactions' as any }))

    await waitFor(() => {
      // O Supabase DEVE ser chamado na tabela 'transactions'
      expect(supabase.from).toHaveBeenCalledWith('transactions')
    })
  })
})
