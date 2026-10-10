// src/hooks/useProjection.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import type { FinancialContext } from '@/lib/financialMetrics'
import { buildUnifiedCashProjection } from '@/lib/financialProjection'

export interface ProjectionData {
  dailyProjection: Array<{
    day: string
    balance: number
  }>
  currentBalance: number
  projectedEndBalance: number
  dailyAverage: number
  estimatedDailyExpense: number
  knownPayables30: number
  knownReceivables30: number
  pendingDebts: number
  isAtRisk: boolean
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  dayZero: number | null
  recommendation: string | null
  sampleSize: number
  sampleDays: number
  confidence: 'low' | 'medium' | 'high'
  outlierCap: number
  cappedDays: number
}

/** Invoice schema has user/card and user/status indexes, but no user/context index. */
export async function readProjectionRows(userId: string, context: FinancialContext) {
  const names = ['accounts', 'transactions', 'debts', 'credit_cards', 'credit_invoices', 'loans', 'financings', 'subscriptions'] as const
  return Promise.all(names.map(name => name === 'credit_invoices'
    ? db.credit_invoices.where('user_id').equals(userId).filter(row => row.context === context).toArray()
    : db.table(name).where('[user_id+context]').equals([userId, context]).toArray()))
}

export function useProjection(context: FinancialContext) {
  const { user } = useAuth()
  return useLiveQuery(async()=> {
    if(!context||!user?.id)return null
    const userId=user.id,now=new Date()
    const rows = await readProjectionRows(userId, context)
    const [accounts,transactions,debts,creditCards,creditInvoices,loans,financings,subscriptions]=rows
    return buildUnifiedCashProjection({context,now,accounts,transactions,debts,creditCards,creditInvoices,loans,financings,subscriptions,categories:[]})
  },[context,user?.id])
}
