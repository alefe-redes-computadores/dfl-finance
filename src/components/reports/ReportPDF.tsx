// src/components/reports/ReportPDF.tsx
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
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

interface Transaction {
  id?: string
  date?: string
  description?: string | null
  category?: string | null
  categoryLabel?: string | null
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

const safeNum = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '')
  if (!match) return ''

  return `${match[3]}/${match[2]}/${match[1]}`
}

function transactionAppearance(type: string) {
  if (type === 'income') {
    return { prefix: '+ ', color: '#10b981' }
  }

  if (type === 'expense' || type === 'sangria') {
    return { prefix: '- ', color: '#ef4444' }
  }

  return { prefix: '', color: '#64748b' }
}

export default function ReportPDF({
  title,
  period,
  income,
  expense,
  balance,
  transactions,
}: ReportPDFProps) {
  const generatedAt = new Date().toLocaleDateString('pt-BR')

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
              + R$ {safeNum(income).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Despesas</Text>
            <Text style={[styles.summaryValue, styles.expense]}>
              - R$ {safeNum(expense).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Saldo</Text>
            <Text style={[styles.summaryValue, styles.balance]}>
              R$ {safeNum(balance).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          Transações do Período
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cellDate}>DATA</Text>
            <Text style={styles.cellDesc}>DESCRIÇÃO</Text>
            <Text style={styles.cellCategory}>CATEGORIA</Text>
            <Text style={styles.cellAmount}>VALOR</Text>
          </View>

          {transactions.map((transaction, index) => {
            const categoryName =
              transaction.categoryLabel ||
              transaction.categories?.name ||
              transaction.category ||
              'Geral'

            const description =
              transaction.description ||
              categoryName ||
              'Sem descrição'

            const amount = safeNum(transaction.amount)
            const appearance = transactionAppearance(transaction.type)

            return (
              <View
                key={transaction.id || index}
                style={styles.tableRow}
              >
                <Text style={styles.cellDate}>
                  {formatDate(transaction.date || '')}
                </Text>

                <Text style={styles.cellDesc}>
                  {description}
                </Text>

                <Text style={styles.cellCategory}>
                  {categoryName}
                </Text>

                <Text
                  style={[
                    styles.cellAmount,
                    { color: appearance.color },
                  ]}
                >
                  {appearance.prefix}
                  R$ {amount.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </View>
            )
          })}
        </View>

        <Text style={styles.footer}>
          Gerado por DFL Finance em {generatedAt}
        </Text>
      </Page>
    </Document>
  )
}
