import { renderHook, act } from '@testing-library/react'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

describe('useHapticFeedback', () => {
  const mockVibrate = jest.fn()

  beforeEach(() => {
    // Mock do navigator.vibrate antes de cada teste
    Object.defineProperty(navigator, 'vibrate', {
      value: mockVibrate,
      writable: true,
      configurable: true,
    })
    mockVibrate.mockClear()
  })

  it('deve chamar navigator.vibrate com o padrão correto ao usar vibrate()', () => {
    const { result } = renderHook(() => useHapticFeedback())

    act(() => {
      result.current.vibrate([50, 100, 50])
    })

    expect(mockVibrate).toHaveBeenCalledWith([50, 100, 50])
  })

  it('deve chamar success() com o padrão [30, 50, 30]', () => {
    const { result } = renderHook(() => useHapticFeedback())

    act(() => {
      result.current.success()
    })

    expect(mockVibrate).toHaveBeenCalledWith([30, 50, 30])
  })

  it('deve chamar error() com o padrão [50, 100, 50]', () => {
    const { result } = renderHook(() => useHapticFeedback())

    act(() => {
      result.current.error()
    })

    expect(mockVibrate).toHaveBeenCalledWith([50, 100, 50])
  })

  it('deve chamar light() com [10]', () => {
    const { result } = renderHook(() => useHapticFeedback())

    act(() => {
      result.current.light()
    })

    expect(mockVibrate).toHaveBeenCalledWith(10)
  })

  it('não deve quebrar se navigator.vibrate não existir', () => {
    // Remove o vibrate para este teste
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useHapticFeedback())

    expect(() => {
      act(() => {
        result.current.vibrate([50])
      })
    }).not.toThrow()
  })
})