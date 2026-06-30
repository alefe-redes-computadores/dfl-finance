import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// Registra fontes (opcional, mas deixa o PDF mais bonito)
Font.register({
  family: 'Inter',
  src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtM.ttf',
})

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Inter',
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#14b8a6',
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
  date: string
  description: string
  categories?: { name: string }
  type: string
  amount: number
  status: string
}

interface ReportPDFProps {
  title: string
  period: string
  income: number
  expense: number
  balance: number
  transactions: Transaction[]
}

export default function ReportPDF({ title, period, income, expense, balance, transactions }: ReportPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>{period}</Text>
        </View>

        {/* Resumo */}
        <View style={styles.summary}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Receitas</Text>
            <Text style={[styles.summaryValue, styles.income]}>
              + R$ {income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Despesas</Text>
            <Text style={[styles.summaryValue, styles.expense]}>
              - R$ {expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Saldo</Text>
            <Text style={[styles.summaryValue, styles.balance]}>
              R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Lista de Transações */}
        <Text style={styles.sectionTitle}>Transações do Período</Text>
        <View style={styles.table}>
          {/* Cabeçalho da tabela */}
          <View style={styles.tableHeader}>
            <Text style={styles.cellDate}>DATA</Text>
            <Text style={styles.cellDesc}>DESCRIÇÃO</Text>
            <Text style={styles.cellCategory}>CATEGORIA</Text>
            <Text style={styles.cellAmount}>VALOR</Text>
          </View>

          {/* Linhas da tabela */}
          {transactions.map((tx, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.cellDate}>{formatDate(tx.date)}</Text>
              <Text style={styles.cellDesc}>{tx.description || 'Sem descrição'}</Text>
              <Text style={styles.cellCategory}>{tx.categories?.name || 'Geral'}</Text>
              <Text style={[styles.cellAmount, { color: tx.type === 'income' ? '#10b981' : '#ef4444' }]}>
                {tx.type === 'income' ? '+ ' : '- '}
                R$ {(Number(tx.amount) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
        </View>

        {/* Rodapé */}
        <Text style={styles.footer}>
          Gerado por DFL Finance em {new Date().toLocaleDateString('pt-BR')}
        </Text>
      </Page>
    </Document>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR')
}