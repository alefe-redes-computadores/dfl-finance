// src/__tests__/hooks/useSwipeGesture.test.ts
import { renderHook, act } from '@testing-library/react'
import { useSwipeGesture } from '@/hooks/useSwipeGesture'

describe('useSwipeGesture', () => {
  it('deve iniciar sem arraste', () => {
    const { result } = renderHook(() => useSwipeGesture())
    expect(result.current.offsetX).toBe(0)
    expect(result.current.isDragging).toBe(false)
    expect(result.current.direction).toBeNull()
  })

  it('deve detectar swipe para a direita', () => {
    const onSwipeRight = jest.fn()
    const { result } = renderHook(() => useSwipeGesture({ 
      threshold: 80,
      onSwipeRight 
    }))

    act(() => {
      result.current.onTouchStart({
        touches: [{ clientX: 100, clientY: 100 }]
      } as any)
    })

    act(() => {
      result.current.onTouchMove({
        touches: [{ clientX: 200, clientY: 100 }]
      } as any)
    })

    act(() => {
      result.current.onTouchEnd()
    })

    expect(onSwipeRight).toHaveBeenCalled()
    expect(result.current.offsetX).toBe(0)
  })

  it('deve detectar swipe para a esquerda', () => {
    const onSwipeLeft = jest.fn()
    const { result } = renderHook(() => useSwipeGesture({
      threshold: 80,
      onSwipeLeft
    }))

    act(() => {
      result.current.onTouchStart({
        touches: [{ clientX: 200, clientY: 100 }]
      } as any)
    })

    act(() => {
      result.current.onTouchMove({
        touches: [{ clientX: 100, clientY: 100 }]
      } as any)
    })

    act(() => {
      result.current.onTouchEnd()
    })

    expect(onSwipeLeft).toHaveBeenCalled()
  })

  it('deve detectar tap (clique sem arraste)', () => {
    const onTap = jest.fn()
    const { result } = renderHook(() => useSwipeGesture({
      onTap
    }))

    act(() => {
      result.current.onTouchStart({
        touches: [{ clientX: 100, clientY: 100 }]
      } as any)
    })

    act(() => {
      result.current.onTouchEnd()
    })

    expect(onTap).toHaveBeenCalled()
  })

  it('não deve disparar swipe se não atingir o threshold', () => {
    const onSwipeRight = jest.fn()
    const { result } = renderHook(() => useSwipeGesture({
      threshold: 80,
      onSwipeRight
    }))

    act(() => {
      result.current.onTouchStart({
        touches: [{ clientX: 100, clientY: 100 }]
      } as any)
    })

    act(() => {
      result.current.onTouchMove({
        touches: [{ clientX: 130, clientY: 100 }]
      } as any)
    })

    act(() => {
      result.current.onTouchEnd()
    })

    expect(onSwipeRight).not.toHaveBeenCalled()
  })
})
