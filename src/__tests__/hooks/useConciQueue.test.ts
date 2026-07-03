// src/__tests__/hooks/useConciQueue.test.ts
import { renderHook, act } from '@testing-library/react'
import { useConciQueue } from '@/hooks/useConciQueue'

describe('useConciQueue', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const mockTransactions = [
    {
      date: '2026-07-01',
      description: 'Supermercado',
      amount: 150.00,
      type: 'expense' as const,
      accountName: 'Conta Corrente',
    },
    {
      date: '2026-07-02',
      description: 'Salário',
      amount: 5000.00,
      type: 'income' as const,
      accountName: 'Conta Corrente',
    },
  ]

  it('deve iniciar com fila vazia', () => {
    const { result } = renderHook(() => useConciQueue())
    expect(result.current.queue).toEqual([])
    expect(result.current.total).toBe(0)
    expect(result.current.current).toBeNull()
  })

  it('deve resetar a fila com novas transações', () => {
    const { result } = renderHook(() => useConciQueue())

    act(() => {
      result.current.reset(mockTransactions)
    })

    expect(result.current.queue).toHaveLength(2)
    expect(result.current.total).toBe(2)
    expect(result.current.current).toBeDefined()
    expect(result.current.current?.status).toBe('pending')
  })

  it('deve aprovar uma transação', () => {
    const { result } = renderHook(() => useConciQueue())

    act(() => {
      result.current.reset(mockTransactions)
    })

    act(() => {
      result.current.approve()
    })

    expect(result.current.approved).toBe(1)
    expect(result.current.queue[0].status).toBe('approved')
  })

  it('deve rejeitar uma transação', () => {
    const { result } = renderHook(() => useConciQueue())

    act(() => {
      result.current.reset(mockTransactions)
    })

    act(() => {
      result.current.reject()
    })

    expect(result.current.rejected).toBe(1)
    expect(result.current.queue[0].status).toBe('rejected')
  })

  it('deve pular para a próxima transação ao aprovar', () => {
    const { result } = renderHook(() => useConciQueue())

    act(() => {
      result.current.reset(mockTransactions)
    })

    expect(result.current.current?.description).toBe('Supermercado')

    act(() => {
      result.current.approve()
    })

    expect(result.current.current?.description).toBe('Salário')
    expect(result.current.currentIndex).toBe(1)
  })

  it('deve marcar como completo quando todas forem processadas', () => {
    const { result } = renderHook(() => useConciQueue())

    act(() => {
      result.current.reset(mockTransactions)
    })

    act(() => {
      result.current.approve()
    })
    act(() => {
      result.current.approve()
    })

    expect(result.current.isComplete).toBe(true)
    expect(result.current.current).toBeNull()
  })

  it('deve retornar estatísticas corretas', () => {
    const { result } = renderHook(() => useConciQueue())

    act(() => {
      result.current.reset(mockTransactions)
    })

    act(() => {
      result.current.approve()
    })
    act(() => {
      result.current.reject()
    })

    const stats = result.current.getStats()
    expect(stats).toEqual({
      approved: 1,
      rejected: 1,
      pending: 0,
    })
  })

  it('deve limpar a fila', () => {
    const { result } = renderHook(() => useConciQueue())

    act(() => {
      result.current.reset(mockTransactions)
    })

    expect(result.current.queue).toHaveLength(2)

    act(() => {
      result.current.clear()
    })

    expect(result.current.queue).toHaveLength(0)
    expect(result.current.current).toBeNull()
  })

  it('deve persistir no localStorage', () => {
    const { result } = renderHook(() => useConciQueue())

    act(() => {
      result.current.reset(mockTransactions)
    })

    const saved = localStorage.getItem('conciliation_queue')
    expect(saved).toBeDefined()

    const parsed = JSON.parse(saved!)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].status).toBe('pending')
  })
})
