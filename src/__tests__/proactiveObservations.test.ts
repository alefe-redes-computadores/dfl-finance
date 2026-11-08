import {
  buildProactiveObservations, normalizeProactiveHistory,
  reviewObservation, observationVisibility,
} from '@/lib/proactiveObservations'
import type { FinancialIntelligenceOutput } from '@/lib/financial-intelligence'
import type { MonthlyReview } from '@/lib/financeMonthlyReview'

const now = new Date('2026-11-08T12:00:00.000Z')
const review = (overrides: Partial<MonthlyReview> = {}) => ({
  context: 'personal', month: '2026-10', comparisonMonth: '2026-09', closed: true,
  economicCount: 14, income: 3500, expense: 2100, result: 1400,
  expenseVariation: 30, missingCategories: 1, missingAccounts: 0, importsToReview: 2,
  ...overrides,
} as MonthlyReview)
const intelligence = (context: 'personal'|'dfl'='personal') => ({
  context, insights: [{
    id: 'expense-month-spike', type: 'expense_trend', title: 'Despesas aceleraram',
    message: 'Despesas acima do mesmo período anterior.', severity: 'warning',
    confidence: 'medium', sampleSize: 9, priorityScore: 91,
    deltaPercent: 31, explanation: {period: '01 a 08/11',why: 'Comparação até o mesmo dia civil.',actionRoute: '/analysis',actionLabel: 'Ver análise'},
  }],
} as unknown as FinancialIntelligenceOutput)
const current = review({ month: '2026-11', closed: false })

describe('R458 observações determinísticas', () => {
  test('fechamento civil sem dupla contagem e diagnóstico de dados', () => {
    const result = buildProactiveObservations(intelligence(),current,review())
    expect(result.some(item=>item.key==='personal:monthly-close:2026-10')).toBe(true)
    expect(result.some(item=>item.key==='personal:data-quality:2026-10')).toBe(true)
    expect(result.find(item=>item.source==='monthly_review')?.why).toMatch(/fatura/)
    expect(result.find(item=>item.source==='monthly_review')?.evidence).toMatch(/30,0%/)
  })
  test('motor existente mantém severidade, evidência e rota', () => {
    const result = buildProactiveObservations(intelligence(),current,review())
    expect(result[0].priority).toBe(91)
    expect(result[0].severity).toBe('warning')
    expect(result[0].route).toBe('/analysis')
    expect(result[0].why).toContain('mesmo dia')
  })
  test('contexto cruzado não produz observações', () => {
    expect(buildProactiveObservations(intelligence('dfl'),current,review())).toEqual([])
  })
  test('histórico não cria fechamento sem dados e mês deve estar encerrado', () => {
    const result = buildProactiveObservations(intelligence(),current,review({economicCount:0}))
    expect(result.some(item=>item.source==='monthly_review'||item.source==='data_quality')).toBe(false)
    expect(buildProactiveObservations(intelligence(),current,review({closed:false}))).toEqual([])
  })
  test('histórico ignora dados privados e registros inválidos', () => {
    const items = normalizeProactiveHistory([
      {key:'personal:engine:2026-11:expense-month-spike',seenAt:'2026-11-08T10:00:00.000Z',amount:12500},
      {key:'personal:engine:2026-11:expense-month-spike',seenAt:'2026-11-08T09:00:00.000Z'},
      {key:'../../unsafe',seenAt:'2026-11-08T10:00:00.000Z'},
      {key:'dfl:monthly-close:2026-01',seenAt:'2020-01-01T00:00:00.000Z'},
    ],now)
    expect(items).toHaveLength(1)
    expect(Object.keys(items[0]).sort()).toEqual(['key','seenAt'])
  })
  test('revisar, adiar por 7 dias, reabrir e separar PF/PJ', () => {
    const key='personal:monthly-close:2026-10'
    const history=reviewObservation([],key,'snooze',now)
    expect(observationVisibility(history,key,'daily',now)).toBe('snoozed')
    expect(observationVisibility(history,'dfl:monthly-close:2026-10','daily',now)).toBe('active')
    expect(observationVisibility(history,key,'weekly',new Date('2026-11-16T12:00:00Z'))).toBe('active')
    expect(observationVisibility(history,key,'off',now)).toBe('paused')
    expect(reviewObservation(history,key,'reopen',now)).toHaveLength(0)
  })
  test('sem exportar valores no histórico', () => {
    const entry=reviewObservation([],'dfl:engine:2026-11:notice','seen',now)[0]
    expect(entry).toEqual({key:'dfl:engine:2026-11:notice',seenAt:now.toISOString()})
  })
})
