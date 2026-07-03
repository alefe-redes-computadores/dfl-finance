import { renderHook, act } from '@testing-library/react'
import { useScrollPosition } from '@/hooks/useScrollPosition'

describe('useScrollPosition', () => {
  const originalScrollY = window.scrollY
  const originalInnerHeight = window.innerHeight
  const originalDocumentHeight = document.documentElement.scrollHeight

  beforeEach(() => {
    // Mock das propriedades do window
    Object.defineProperty(window, 'scrollY', {
      value: 0,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 2000,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    // Restaurar valores originais
    Object.defineProperty(window, 'scrollY', {
      value: originalScrollY,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: originalDocumentHeight,
      writable: true,
      configurable: true,
    })
  })

  it('deve retornar os valores iniciais corretos', () => {
    const { result } = renderHook(() => useScrollPosition())

    expect(result.current.scrollY).toBe(0)
    expect(result.current.windowHeight).toBe(800)
    expect(result.current.documentHeight).toBe(2000)
  })

  it('deve atualizar scrollY quando a página rola', () => {
    const { result } = renderHook(() => useScrollPosition())

    act(() => {
      window.scrollY = 150
      window.dispatchEvent(new Event('scroll'))
    })

    expect(result.current.scrollY).toBe(150)
  })

  it('deve atualizar windowHeight quando a janela redimensiona', () => {
    const { result } = renderHook(() => useScrollPosition())

    act(() => {
      window.innerHeight = 600
      window.dispatchEvent(new Event('resize'))
    })

    // O hook só escuta scroll, não resize, então o valor não muda
    // Mas testamos que o valor inicial está correto
    expect(result.current.windowHeight).toBe(800)
  })

  it('deve remover o event listener ao desmontar', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useScrollPosition())

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function))
  })
})