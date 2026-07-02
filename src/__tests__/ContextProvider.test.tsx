import { render, screen, fireEvent, act } from '@testing-library/react'
import { ContextProvider, useContext_, ContextToggle } from '@/components/ContextToggle'

// Mock do localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} }
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock do supabase (para o ContextProvider)
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null })
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null })
    })
  }
}))

// Componente de teste para acessar o contexto
function TestConsumer() {
  const { context, setContext, appMode, setAppMode } = useContext_()
  return (
    <div>
      <span data-testid="context-value">{context}</span>
      <span data-testid="appmode-value">{appMode || 'null'}</span>
      <button data-testid="set-dfl" onClick={() => setContext('dfl')}>Set DFL</button>
      <button data-testid="set-personal" onClick={() => setContext('personal')}>Set Personal</button>
      <button data-testid="set-mode-full" onClick={() => setAppMode('full')}>Full Mode</button>
      <button data-testid="set-mode-personal-only" onClick={() => setAppMode('personal_only')}>Personal Only</button>
    </div>
  )
}

describe('ContextProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('deve iniciar com appMode null e contexto dfl', () => {
    render(
      <ContextProvider>
        <TestConsumer />
      </ContextProvider>
    )
    expect(screen.getByTestId('appmode-value').textContent).toBe('null')
    expect(screen.getByTestId('context-value').textContent).toBe('dfl')
  })

  it('deve carregar appMode do localStorage', () => {
    localStorage.setItem('dfl_app_mode', 'personal_only')
    render(
      <ContextProvider>
        <TestConsumer />
      </ContextProvider>
    )
    expect(screen.getByTestId('appmode-value').textContent).toBe('personal_only')
    expect(screen.getByTestId('context-value').textContent).toBe('personal')
  })

  it('deve alternar para personal_only e bloquear setContext', () => {
    render(
      <ContextProvider>
        <TestConsumer />
      </ContextProvider>
    )
    
    fireEvent.click(screen.getByTestId('set-mode-personal-only'))
    expect(screen.getByTestId('appmode-value').textContent).toBe('personal_only')
    expect(screen.getByTestId('context-value').textContent).toBe('personal')
    
    // Tentar mudar para dfl não deve funcionar
    fireEvent.click(screen.getByTestId('set-dfl'))
    expect(screen.getByTestId('context-value').textContent).toBe('personal')
  })

  it('deve permitir setContext no modo full', () => {
    render(
      <ContextProvider>
        <TestConsumer />
      </ContextProvider>
    )
    
    fireEvent.click(screen.getByTestId('set-mode-full'))
    fireEvent.click(screen.getByTestId('set-personal'))
    expect(screen.getByTestId('context-value').textContent).toBe('personal')
  })
})

describe('ContextToggle', () => {
  it('não deve renderizar quando appMode não é full', () => {
    localStorage.setItem('dfl_app_mode', 'personal_only')
    const { container } = render(
      <ContextProvider>
        <ContextToggle />
      </ContextProvider>
    )
    expect(container.firstChild).toBeNull()
  })

  it('deve renderizar quando appMode é full', () => {
    localStorage.setItem('dfl_app_mode', 'full')
    const { container } = render(
      <ContextProvider>
        <ContextToggle />
      </ContextProvider>
    )
    expect(container.firstChild).not.toBeNull()
    expect(screen.getByText('PJ')).toBeInTheDocument()
    expect(screen.getByText('PF')).toBeInTheDocument()
  })
})