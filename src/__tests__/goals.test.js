// Calcula o progresso da meta (porcentagem)
function getGoalProgress(current, target) {
  if (target <= 0) return 0
  return Math.min((current / target) * 100, 100)
}

// Determina o status com base no progresso e prazo
function getGoalStatus(current, target, deadline) {
  if (current >= target) return 'completed'
  if (deadline && new Date(deadline) < new Date() && current < target) return 'overdue'
  return 'active'
}

// Aplica um ajuste manual ao valor atual
function applyManualAdjustment(current, target, amount) {
  const newCurrent = current + amount
  const progress = getGoalProgress(newCurrent, target)
  return {
    current: newCurrent,
    progress,
    completed: newCurrent >= target,
  }
}

// Calcula dias restantes até o prazo
function getDaysLeft(deadline) {
  if (!deadline) return null
  const now = new Date()
  const deadlineDate = new Date(deadline)
  return Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

describe('Metas Financeiras', () => {
  describe('getGoalProgress', () => {
    it('calcula 50% corretamente', () => {
      expect(getGoalProgress(500, 1000)).toBe(50)
    })

    it('não ultrapassa 100%', () => {
      expect(getGoalProgress(1500, 1000)).toBe(100)
    })

    it('retorna 0 se o alvo for 0', () => {
      expect(getGoalProgress(100, 0)).toBe(0)
    })

    it('retorna 0 se o valor atual for 0', () => {
      expect(getGoalProgress(0, 1000)).toBe(0)
    })
  })

  describe('getGoalStatus', () => {
    it('retorna completed quando valor atual >= alvo', () => {
      expect(getGoalStatus(1000, 1000, null)).toBe('completed')
      expect(getGoalStatus(1500, 1000, null)).toBe('completed')
    })

    it('retorna overdue se prazo passou e meta não atingida', () => {
      const pastDate = '2020-01-01'
      expect(getGoalStatus(500, 1000, pastDate)).toBe('overdue')
    })

    it('retorna active se ainda dentro do prazo', () => {
      const futureDate = '2030-12-31'
      expect(getGoalStatus(500, 1000, futureDate)).toBe('active')
    })
  })

  describe('applyManualAdjustment', () => {
    it('adiciona valor ao progresso atual', () => {
      const result = applyManualAdjustment(500, 1000, 200)
      expect(result.current).toBe(700)
      expect(result.progress).toBe(70)
      expect(result.completed).toBe(false)
    })

    it('marca como completed se atingir o alvo', () => {
      const result = applyManualAdjustment(800, 1000, 300)
      expect(result.current).toBe(1100)
      expect(result.completed).toBe(true)
    })
  })

  describe('getDaysLeft', () => {
    it('calcula dias restantes corretamente', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)
      const days = getDaysLeft(futureDate.toISOString().split('T')[0])
      expect(days).toBe(10)
    })

    it('retorna número negativo para datas passadas', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      const days = getDaysLeft(pastDate.toISOString().split('T')[0])
      expect(days).toBeLessThan(0)
    })

    it('retorna null se não houver prazo', () => {
      expect(getDaysLeft(null)).toBeNull()
    })
  })
})