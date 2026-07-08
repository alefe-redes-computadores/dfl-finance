import { render, screen, fireEvent } from '@testing-library/react'
import { ContextProvider, useContext_ } from '@/components/ContextToggle'
import ContextToggle from '@/components/ContextToggle'

// 🔥 Componente de teste que usa o hook
function TestComponent() {
  const { appMode, effectiveContext } = useContext_()
  return (
    <div>
      <ContextToggle />
      <span data-testid="app-mode">{appMode}</span>
      <span data-testid="effective-context">{effectiveContext}</span>
    </div>
  )
}

describe('🧪 TESTE DE UI — ContextToggle', () => {

  beforeEach(() => {
    localStorage.clear()
  })

  // ============================================================
  // TESTE 1: ContextToggle visível no modo 'full'
  // ============================================================
  test('✅ ContextToggle aparece quando appMode === "full"', () => {
    localStorage.setItem('dfl_app_mode', 'full')
    localStorage.setItem('dfl_context', 'dfl')

    render(
      <ContextProvider>
        <TestComponent />
      </ContextProvider>
    )

    // Verifica se os botões PJ e PF estão visíveis
    const pjButton = screen.getByText('PJ')
    const pfButton = screen.getByText('PF')
    
    expect(pjButton).toBeInTheDocument()
    expect(pfButton).toBeInTheDocument()
    
    // Verifica se o appMode está correto
    expect(screen.getByTestId('app-mode')).toHaveTextContent('full')
  })

  // ============================================================
  // TESTE 2: ContextToggle INVISÍVEL no modo 'personal_only'
  // ============================================================
  test('❌ ContextToggle NÃO aparece quando appMode === "personal_only"', () => {
    localStorage.setItem('dfl_app_mode', 'personal_only')
    localStorage.setItem('dfl_context', 'personal')

    render(
      <ContextProvider>
        <TestComponent />
      </ContextProvider>
    )

    // Verifica que os botões NÃO estão presentes
    expect(screen.queryByText('PJ')).not.toBeInTheDocument()
    expect(screen.queryByText('PF')).not.toBeInTheDocument()
    
    // Verifica que o effectiveContext é 'personal'
    expect(screen.getByTestId('app-mode')).toHaveTextContent('personal_only')
    expect(screen.getByTestId('effective-context')).toHaveTextContent('personal')
  })

  // ============================================================
  // TESTE 3: Alternância entre PF e PJ no modo 'full'
  // ============================================================
  test('🔄 Alternância PF/PJ funciona no modo "full"', () => {
    localStorage.setItem('dfl_app_mode', 'full')
    localStorage.setItem('dfl_context', 'dfl')

    render(
      <ContextProvider>
        <TestComponent />
      </ContextProvider>
    )

    // Começa com PJ ativo (contexto padrão)
    expect(screen.getByTestId('effective-context')).toHaveTextContent('dfl')

    // Clica no botão PF
    const pfButton = screen.getByText('PF')
    fireEvent.click(pfButton)

    // Deve mudar para 'personal'
    expect(screen.getByTestId('effective-context')).toHaveTextContent('personal')

    // Clica no botão PJ
    const pjButton = screen.getByText('PJ')
    fireEvent.click(pjButton)

    // Deve voltar para 'dfl'
    expect(screen.getByTestId('effective-context')).toHaveTextContent('dfl')
  })

  // ============================================================
  // TESTE 4: Bloqueio de alternância no modo 'personal_only'
  // ============================================================
  test('🚫 Alternância BLOQUEADA no modo "personal_only"', () => {
    localStorage.setItem('dfl_app_mode', 'personal_only')
    localStorage.setItem('dfl_context', 'personal')

    render(
      <ContextProvider>
        <TestComponent />
      </ContextProvider>
    )

    // O seletor NÃO aparece
    expect(screen.queryByText('PJ')).not.toBeInTheDocument()
    expect(screen.queryByText('PF')).not.toBeInTheDocument()
    
    // O effectiveContext é forçado para 'personal'
    expect(screen.getByTestId('effective-context')).toHaveTextContent('personal')
  })

  // ============================================================
  // TESTE 5: Persistência do contexto no localStorage
  // ============================================================
  test('💾 Contexto é salvo no localStorage ao alternar', () => {
    localStorage.setItem('dfl_app_mode', 'full')
    localStorage.setItem('dfl_context', 'dfl')

    render(
      <ContextProvider>
        <TestComponent />
      </ContextProvider>
    )

    // Clica no PF
    const pfButton = screen.getByText('PF')
    fireEvent.click(pfButton)

    // Verifica se o localStorage foi atualizado
    expect(localStorage.getItem('dfl_context')).toBe('personal')
    
    // Verifica se o effectiveContext mudou
    expect(screen.getByTestId('effective-context')).toHaveTextContent('personal')
  })
})