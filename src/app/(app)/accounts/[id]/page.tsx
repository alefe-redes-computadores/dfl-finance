'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft,
  Edit2,
  ArrowRightLeft,
  Scale,
  ChevronRight,
  X,
  Plus,
  Loader2,
} from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import TransferModal from '@/components/TransferModal'

const DEFAULT_COLORS = [
  '#dc2626',
  '#16a34a',
  '#0284c7',
  '#8b5cf6',
  '#111827',
  '#f59e0b',
  '#ec4899',
  '#64748b',
]

export default function AccountStatementPage() {
  const { id } = useParams()
  const router = useRouter()

  const [account, setAccount] = useState(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [summary, setSummary] = useState({
    income: 0,
    expense: 0,
  })
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showBalance, setShowBalance] = useState(false)

  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLORS[0])
  const [displayBalance, setDisplayBalance] = useState('')
  const [balanceNum, setBalanceNum] = useState(0)

  const monthLabel = format(
    currentDate,
    "MMMM 'De' yyyy",
    {
      locale: ptBR,
    }
  )

  const loadData = useCallback(async () => {
    if (!id) return

    setLoading(true)

    const { data: accData } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single()

    if (accData) {
      setAccount(accData)
    }

    const start = format(
      startOfMonth(currentDate),
      'yyyy-MM-dd'
    )

    const end = format(
      endOfMonth(currentDate),
      'yyyy-MM-dd'
    )

    const { data: txsData } = await supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('account_id', id)
      .gte('date', start)
      .lte('date', end)
      .order('date', {
        ascending: false,
      })

    const txs = txsData || []

    setTransactions(txs)

    const income = txs
      .filter((t) => t.type === 'income')
      .reduce((a, t) => a + Number(t.amount), 0)

    const expense = txs
      .filter(
        (t) =>
          t.type === 'expense' ||
          t.type === 'sangria'
      )
      .reduce((a, t) => a + Number(t.amount), 0)

    setSummary({
      income,
      expense,
    })

    setLoading(false)
  }, [id, currentDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleBalanceChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const rawValue = e.target.value.replace(/\D/g, '')

    const num = Number(rawValue) / 100

    setBalanceNum(num)

    setDisplayBalance(
      num.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    )
  }

  const handleSave = async () => {
    if (!name.trim()) return

    setLoading(true)

    const { error } = await supabase
      .from('accounts')
      .update({
        name: name.trim(),
        balance: balanceNum,
        color,
      })
      .eq('id', id)

    if (!error) {
      setShowForm(false)
      loadData()
    } else {
      setLoading(false)
    }
  }

  const openEditModal = () => {
    if (!account) return

    setName(account.name)
    setColor(account.color)
    setBalanceNum(account.balance)

    setDisplayBalance(
      Number(account.balance).toLocaleString(
        'pt-BR',
        {
          minimumFractionDigits: 2,
        }
      )
    )

    setShowForm(true)
  }

  const formatCurrency = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  if (loading && !account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2
          className="animate-spin text-teal-600"
          size={40}
        />
      </div>
    )
  }

  if (!account) {
    return (
      <div className="p-6 text-center">
        Conta não encontrada.
      </div>
    )
  }

  const initials = account.name
    ? account.name.substring(0, 2).toUpperCase()
    : '??'

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20 font-sans relative">

      <div className="flex justify-between items-center p-4 bg-white">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-gray-700"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="flex items-center gap-4 text-gray-700">
          <button onClick={() => setShowTransfer(true)}>
            <ArrowRightLeft size={20} />
          </button>

          <button onClick={() => setShowBalance(true)}>
            <Scale size={20} />
          </button>

          <button onClick={openEditModal}>
            <Edit2 size={20} />
          </button>
        </div>
      </div>

      {/* restante do layout */}

      <TransferModal
        isOpen={showTransfer}
        onClose={() => setShowTransfer(false)}
        fromAccountId={id}
        onComplete={() => {
          loadData()
          setShowTransfer(false)
        }}
      />

      {showBalance && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowBalance(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-xl mb-4">
              Ajuste de Saldo
            </h2>

            <p className="text-gray-500 mb-6">
              Funcionalidade em desenvolvimento.
            </p>

            <button
              onClick={() => setShowBalance(false)}
              className="w-full bg-teal-700 text-white py-4 rounded-2xl font-bold"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}