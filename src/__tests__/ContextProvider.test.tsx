import { render, screen, fireEvent } from '@testing-library/react'
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

// Mock do supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }) },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null })
    })
  }
}))

// Mock do useAuth
jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user' }, loading: false })
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

  it('inicia com appMode null e contexto dfl', () => {
    render(<ContextProvider><TestConsumer /></ContextProvider>)
    expect(screen.getByTestId('appmode-value').textContent).toBe('null')
    expect(screen.getByTestId('context-value').textContent).toBe('dfl')
  })

  it('carrega appMode do localStorage', () => {
    localStorage.setItem('dfl_app_mode', 'personal_only')
    render(<ContextProvider><TestConsumer /></ContextProvider>)
    expect(screen.getByTestId('appmode-value').textContent).toBe('personal_only')
    expect(screen.getByTestId('context-value').textContent).toBe('personal')
  })

  it('bloqueia setContext no modo personal_only', () => {
    render(<ContextProvider><TestConsumer /></ContextProvider>)
    fireEvent.click(screen.getByTestId('set-mode-personal-only'))
    expect(screen.getByTestId('context-value').textContent).toBe('personal')
    fireEvent.click(screen.getByTestId('set-dfl')) // deve ser ignorado
    expect(screen.getByTestId('context-value').textContent).toBe('personal')
  })

  it('permite setContext no modo full', () => {
    localStorage.setItem('dfl_app_mode', 'full')
    render(<ContextProvider><TestConsumer /></ContextProvider>)
    fireEvent.click(screen.getByTestId('set-personal'))
    expect(screen.getByTestId('context-value').textContent).toBe('personal')
  })
})

describe('ContextToggle', () => {
  it('não renderiza quando appMode não é full', () => {
    localStorage.setItem('dfl_app_mode', 'personal_only')
    const { container } = render(<ContextProvider><ContextToggle /></ContextProvider>)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza com PJ e PF quando appMode é full', () => {
    localStorage.setItem('dfl_app_mode', 'full')
    render(<ContextProvider><ContextToggle /></ContextProvider>)
    expect(screen.getByText('PJ')).toBeInTheDocument()
    expect(screen.getByText('PF')).toBeInTheDocument()
  })
})