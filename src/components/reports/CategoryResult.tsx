'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportFilterValues } from './ReportFilters'
import { Download } from 'lucide-react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import ReportPDF from '@/components/reports/ReportPDF'

const CATEGORY_COLORS: Record<string, string> = {
  Alimentação: '#FF6B6B', Transporte: '#4ECDC4', Moradia: '#45B7D1', Lazer: '#96CEB4',
  Saúde: '#FFEAA7', Educação: '#DDA0DD', Assinaturas: '#98D8C8', Salário: '#6C5CE7',
  Freelance: '#A8E6CF', Investimentos: '#FFD93D', Vendas: '#FF8B94', Serviços: '#B8A9C9',
  Outros: '#95A5A6',
}

interface CategoryResultProps {
  filters: ReportFilterValues
}

export default function CategoryResult({ filters }: CategoryResultProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])

  useEffect(() => {
    if (!user?.id || !filters.dateRange.start || !filters.dateRange.end) return
    setLoading(true)

    const load = async () => {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
        .order('date', { ascending: false })

      if (filters.context === 'personal') query = query.eq('context', 'personal')

      // 🆕 Filtros cruzados
      if (filters.tags && filters.tags.length > 0) {
        query = query.overlaps('tag_ids', filters.tags)
      }
      if (filters.accounts && filters.accounts.length > 0) {
        query = query.in('account_id', filters.accounts)
      }
      if (filters.creditCards && filters.creditCards.length > 0) {
        query = query.in('credit_card_id', filters.creditCards)
      }

      const { data, error } = await query
      if (error) console.error(error)
      setTransactions(data || [])
      setLoading(false)
    }

    load()
  }, [user?.id, filters])

  const expensesByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc: any, t: any) => {
      const cat = t.category || 'Outros'
      if (!acc[cat]) acc[cat] = { total: 0, count: 0, transactions: [] }
      acc[cat].total += t.amount
      acc[cat].count += 1
      acc[cat].transactions.push(t)
      return acc
    }, {})

  const categoryArray = Object.entries(expensesByCategory)
    .map(([name, data]: any) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)

  const totalExpenses = categoryArray.reduce((sum, c) => sum + c.total, 0)

  return (
    <div className="flex-1">
      {loading ? (
        <div className="flex justify-center p-8"><div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : categoryArray.length === 0 ? (
        <div className="text-center p-8 text-slate-500">Nenhuma despesa no período.</div>
      ) : (
        <div className="space-y-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-500 mb-3">Distribuição de Gastos</h3>
            <div className="space-y-2">
              {categoryArray.map(cat => {
                const percent = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0
                return (
                  <div key={cat.name} className="flex items-center">
                    <div className="w-24 text-xs text-slate-600 truncate mr-2">{cat.name}</div>
                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: CATEGORY_COLORS[cat.name] || '#95A5A6' }} />
                    </div>
                    <div className="w-20 text-xs text-right ml-2">
                      <span className="font-medium">R$ {cat.total.toFixed(2)}</span>
                      <span className="text-slate-500 ml-1">({percent.toFixed(1)}%)</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {categoryArray.map(cat => (
            <div key={cat.name} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: CATEGORY_COLORS[cat.name] || '#95A5A6' }} />
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200">{cat.name}</h4>
                </div>
                <p className="text-sm font-bold text-red-600">R$ {cat.total.toFixed(2)}</p>
              </div>
              <p className="text-xs text-slate-500 mb-2">{cat.count} transação(es) {totalExpenses > 0 && `• ${((cat.total/totalExpenses)*100).toFixed(1)}% do total`}</p>
              <div className="space-y-1">
                {cat.transactions.slice(0,3).map((t: any) => (
                  <div key={t.id} className="flex justify-between text-xs text-slate-600">
                    <span className="truncate mr-2">{t.description}</span>
                    <span>R$ {t.amount.toFixed(2)}</span>
                  </div>
                ))}
                {cat.transactions.length > 3 && <p className="text-xs text-teal-600 mt-1">+ {cat.transactions.length - 3} outras</p>}
              </div>
            </div>
          ))}

          {/* Botão Exportar PDF */}
          {transactions.length > 0 && (
            <PDFDownloadLink
              document={
                <ReportPDF
                  title="Despesas por Categoria"
                  period={`${filters.dateRange.start} a ${filters.dateRange.end}`}
                  income={0}
                  expense={totalExpenses}
                  balance={-totalExpenses}
                  transactions={transactions.filter(t => t.type === 'expense')}
                />
              }
              fileName={`despesas-por-categoria-${Date.now()}.pdf`}
              className="w-full mt-4 bg-teal-700 text-white py-3 rounded-xl font-bold text-sm hover:bg-teal-800 transition-colors flex items-center justify-center gap-2"
            >
              {({ loading: pdfLoading }: { loading: boolean }) => (
                <>
                  <Download size={16} />
                  {pdfLoading ? 'Gerando PDF...' : 'Exportar PDF'}
                </>
              )}
            </PDFDownloadLink>
          )}
        </div>
      )}
    </div>
  )
}