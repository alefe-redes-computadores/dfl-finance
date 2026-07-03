// src/__tests__/components/conciliation/ConciProgress.test.tsx
import { render, screen } from '@testing-library/react'
import { ConciProgress } from '@/components/conciliation/ConciProgress'

describe('ConciProgress', () => {
  it('deve renderizar o progresso corretamente', () => {
    render(
      <ConciProgress
        current={3}
        total={10}
        approved={2}
        rejected={1}
      />
    )

    expect(screen.getByText('3 de 10')).toBeInTheDocument()
    expect(screen.getByText('✅ 2 • ❌ 1')).toBeInTheDocument()
  })

  it('deve mostrar zero quando não há transações', () => {
    render(
      <ConciProgress
        current={0}
        total={0}
        approved={0}
        rejected={0}
      />
    )

    expect(screen.getByText('0 de 0')).toBeInTheDocument()
    expect(screen.getByText('✅ 0 • ❌ 0')).toBeInTheDocument()
  })

  it('deve mostrar apenas aprovados quando não há rejeitados', () => {
    render(
      <ConciProgress
        current={5}
        total={5}
        approved={5}
        rejected={0}
      />
    )

    expect(screen.getByText('5 de 5')).toBeInTheDocument()
    expect(screen.getByText('✅ 5 • ❌ 0')).toBeInTheDocument()
  })
})