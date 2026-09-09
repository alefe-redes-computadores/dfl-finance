// src/lib/financial-intelligence/types.ts

export type FinancialIntelligenceContext =
  | 'dfl'
  | 'personal'

export type InsightSeverity =
  | 'info'
  | 'opportunity'
  | 'attention'
  | 'warning'
  | 'critical'

export type InsightConfidence =
  | 'low'
  | 'medium'
  | 'high'

export interface IntelligenceTransactionLike {
  id?: string
  context?: string | null
  type?: string | null
  amount?: number | null
  status?: string | null
  affects_balance?: boolean | null
  date?: string | null
  category_id?: string | null
  account_id?: string | null
  goal_id?: string | null
  debt_id?: string | null
  debt_applied_amount?: number | null
  contact_credit_delta?: number | null
}

export interface IntelligenceAccountLike {
  id?: string
  context?: string | null
  balance?: number | null
  is_archived?: boolean | null
}

export interface IntelligenceCategoryLike {
  id?: string
  name?: string | null
  color?: string | null
}

export interface IntelligenceDebtLike {
  id?: string
  context?: string | null
  total_amount?: number | null
  paid_amount?: number | null
  due_date?: string | null
  status?: string | null
}

export interface IntelligenceSubscriptionLike {
  id?: string
  context?: string | null
  name?: string | null
  amount?: number | null
  billing_cycle?: string | null
  status?: string | null
}

export interface IntelligenceBudgetLike {
  id?: string
  context?: string | null
  name?: string | null
  amount?: number | null
  category_id?: string | null
  period?: 'monthly' | 'biweekly' | 'weekly' | null
  accumulate?: boolean | null
  created_at?: string | null
}

export interface IntelligenceGoalLike {
  id?: string
  context?: string | null
  name?: string | null
  target_amount?: number | null
  saved_amount?: number | null
  deadline?: string | null
  status?: string | null
  created_at?: string | null
}

export interface IntelligenceLoanLike {
  id?: string
  context?: string | null
  description?: string | null
  amount?: number | null
  remaining_amount?: number | null
  due_date?: string | null
  status?: string | null
}

export interface IntelligenceFinancingLike {
  id?: string
  context?: string | null
  name?: string | null
  description?: string | null
  total_amount?: number | null
  remaining_amount?: number | null
  current_installment?: number | null
  total_installments?: number | null
  installments_count?: number | null
  installment_value?: number | null
  installment_amount?: number | null
  next_due_date?: string | null
  status?: string | null
}

export interface IntelligenceCreditCardLike {
  id?: string
  context?: string | null
  name?: string | null
  limit_amount?: number | null
  due_day?: number | null
  closing_day?: number | null
  is_archived?: boolean | null
}

export interface IntelligenceCreditInvoiceLike {
  id?: string
  context?: string | null
  credit_card_id?: string | null
  total_amount?: number | null
  paid_amount?: number | null
  due_date?: string | null
  closing_date?: string | null
  status?: string | null
}

export interface FinancialInsight {
  id: string
  type: string
  severity: InsightSeverity
  confidence: InsightConfidence
  title: string
  message: string
  currentValue?: number
  baselineValue?: number
  deltaValue?: number
  deltaPercent?: number
  sampleSize: number
  periodsUsed?: number
  evidence?: Record<
    string,
    string | number | boolean | null
  >
  suggestedQuestion?: string
}

export interface FinancialIntelligenceSnapshot {
  accountBalance: number
  currentMonthIncome: number
  currentMonthExpense: number
  currentMonthNet: number
  previousComparableIncome: number
  previousComparableExpense: number
  previousComparableNet: number
  currentWeekIncome: number
  currentWeekExpense: number
  previousWeekIncome: number
  previousWeekExpense: number
  historicalAverageIncome: number
  historicalAverageExpense: number
  historicalAverageNet: number
  historicalMonthsUsed: number
  savingsRate: number | null
  transactionCount: number
  sampleSize: number
  confidence: InsightConfidence
  projectedMonthExpense: number
  projectedMonthNet: number
  receivablesOpen: number
  receivablesOverdue: number
  overdueReceivablesCount: number
  recurringMonthlyEquivalent: number
  activeBudgetCount: number
  warningBudgetCount: number
  overBudgetCount: number
  goalsActiveCount: number
  goalsOverdueCount: number
  goalsNearDeadlineCount: number
  creditCardOpenExposure: number
  creditCardLimitTotal: number
  creditCardUtilizationRate: number | null
  overdueCardInvoiceAmount: number
  overdueCardInvoiceCount: number
  activeLoanRemaining: number
  overdueLoanCount: number
  activeFinancingRemaining: number
  overdueFinancingCount: number
  committedOutstandingTotal: number
  topExpenseCategories: Array<{
    id: string
    name: string
    amount: number
    share: number
    previousAmount: number
    deltaPercent: number | null
  }>
}

export interface FinancialIntelligenceOutput {
  context: FinancialIntelligenceContext
  generatedAt: string
  snapshot: FinancialIntelligenceSnapshot
  insights: FinancialInsight[]
}

export interface BuildFinancialIntelligenceInput {
  context: FinancialIntelligenceContext
  now?: Date
  transactions: IntelligenceTransactionLike[]
  accounts: IntelligenceAccountLike[]
  categories: IntelligenceCategoryLike[]
  debts?: IntelligenceDebtLike[]
  subscriptions?: IntelligenceSubscriptionLike[]
  budgets?: IntelligenceBudgetLike[]
  goals?: IntelligenceGoalLike[]
  loans?: IntelligenceLoanLike[]
  financings?: IntelligenceFinancingLike[]
  creditCards?: IntelligenceCreditCardLike[]
  creditInvoices?: IntelligenceCreditInvoiceLike[]
}
