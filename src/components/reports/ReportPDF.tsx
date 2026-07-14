import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// 🔥 SUBSTITUÍDO: Fonte Poppins (opcional)
Font.register({
  family: 'Poppins',
  src: 'https://fonts.gstatic.com/s/poppins/v20/pxiEyp8kv8JHgFVrJJfecg.ttf',
})

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Poppins',
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#0f766e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSubtitle: {
    color: '#ccfbf1',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  income: {
    color: '#10b981',
  },
  expense: {
    color: '#ef4444',
  },
  balance: {
    color: '#0f172a',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
    marginTop: 16,
  },
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1 solid #e2e8f0',
  },
  cellDate: {
    width: '15%',
    fontSize: 8,
    color: '#64748b',
  },
  cellDesc: {
    width: '35%',
    fontSize: 9,
    color: '#0f172a',
    fontWeight: 'bold',
  },
  cellCategory: {
    width: '25%',
    fontSize: 8,
    color: '#64748b',
  },
  cellAmount: {
    width: '25%',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 8,
  },
})

// 🔥 SUBSTITUÍDO: interface com campos opcionais
interface Transaction {
  id?: string
  date?: string
  description?: string | null
  category?: string | null
  categories?: { name?: string | null } | null
  type: string
  amount: number | string
  status?: string | null
}

interface ReportPDFProps {
  title: string
  period: string
  income: number
  expense: number
  balance: number
  transactions: Transaction[]
}

// 🔥 SUBSTITUÍDO: safeNum com Number
const safeNum = (val: unknown) => Number(val) || 0

// 🔥 SUBSTITUÍDO: formatDate com validação
function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR')
}

export default function ReportPDF({ title, period, income, expense, balance, transactions }: ReportPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>{period}</Text>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Receitas</Text>
            <Text style={[styles.summaryValue, styles.income]}>
              + R$ {safeNum(income).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Despesas</Text>
            <Text style={[styles.summaryValue, styles.expense]}>
              - R$ {safeNum(expense).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Saldo</Text>
            <Text style={[styles.summaryValue, styles.balance]}>
              R$ {safeNum(balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Transações do Período</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cellDate}>DATA</Text>
            <Text style={styles.cellDesc}>DESCRIÇÃO</Text>
            <Text style={styles.cellCategory}>CATEGORIA</Text>
            <Text style={styles.cellAmount}>VALOR</Text>
          </View>

          {/* 🔥 SUBSTITUÍDO: map com fallbacks robustos */}
          {transactions.map((tx, index) => {
            const categoryName = tx.categories?.name || tx.category || 'Geral'
            const description = tx.description || categoryName || 'Sem descrição'
            const amount = safeNum(tx.amount)

            return (
              <View key={tx.id || index} style={styles.tableRow}>
                <Text style={styles.cellDate}>{formatDate(tx.date || '')}</Text>
                <Text style={styles.cellDesc}>{description}</Text>
                <Text style={styles.cellCategory}>{categoryName}</Text>
                <Text style={[styles.cellAmount, { color: tx.type === 'income' ? '#10b981' : '#ef4444' }]}>
                  {tx.type === 'income' ? '+ ' : '- '}
                  R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )
          })}
        </View>

        <Text style={styles.footer}>
          Gerado por DFL Finance em {new Date().toLocaleDateString('pt-BR')}
        </Text>
      </Page>
    </Document>
  )
}