import { renderHook, act, waitFor } from '@testing-library/react'
import { useOfflineQueue } from '../useOfflineQueue'
import { supabase } from '@/lib/supabase'

// ============================================================
// 🛠️ MOCKS (Simulando o ambiente)
// ============================================================

// 1. Simula o Supabase (garantindo sucesso na inserção)
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }), // Finge que não existe duplicata
      insert: jest.fn().mockResolvedValue({ error: null }), // Finge que inseriu com sucesso
    })),
  },
}))

// 2. Simula o LocalStorage para podermos ver se a fila salvou os dados
const localStorageMock = (function () {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString() },
    clear: () => { store = {} }
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// ============================================================
// 🧪 SUÍTE DE TESTES
// ============================================================
describe('Hook: useOfflineQueue', () => {
  beforeEach(() => {
    // Limpa a memória antes de cada teste
    window.localStorage.clear()
    jest.clearAllMocks()
  })

  it('DEVE adicionar uma transação na fila offline se não houver internet', async () => {
    // Força o navegador a simular que está OFFLINE
    jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    const { result } = renderHook(() => useOfflineQueue())

    // Simula o usuário salvando uma despesa
    await act(async () => {
      await result.current.saveToQueue({ amount: 100, type: 'expense', description: 'Teste Offline' })
    })

    // Verifica se a contagem pendente subiu para 1
    expect(result.current.pendingCount).toBe(1)
    
    // Verifica se salvou fisicamente no localStorage
    const queue = JSON.parse(window.localStorage.getItem('tx_queue') || '[]')
    expect(queue).toHaveLength(1)
    expect(queue[0].payload.amount).toBe(100)
    
    // Como estava offline, NÃO pode ter chamado o Supabase
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('DEVE enviar para o Supabase e limpar a fila quando ficar ONLINE', async () => {
    // Força o navegador a simular que está ONLINE
    jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)

    // Coloca um item falso na fila primeiro (como se o app tivesse aberto agora)
    window.localStorage.setItem('tx_queue', JSON.stringify([
      { id: '123', payload: { amount: 50, type: 'income' }, timestamp: Date.now() }
    ]))

    const { result } = renderHook(() => useOfflineQueue())

    // Força a execução da sincronização
    await act(async () => {
      await result.current.syncQueue()
    })

    // O Supabase DEVE ser chamado na tabela 'transactions' para inserir o dado salvo
    expect(supabase.from).toHaveBeenCalledWith('transactions')
    
    // A fila deve ter sido zerada após o sucesso
    expect(result.current.pendingCount).toBe(0)
    expect(JSON.parse(window.localStorage.getItem('tx_queue') || '[]')).toHaveLength(0)
  })
})
