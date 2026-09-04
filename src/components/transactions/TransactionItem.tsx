// src/components/transactions/TransactionItem.tsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Clock,
  Check,
  ArrowLeftRight,
  Image as ImageIcon,
  Paperclip,
  Edit3,
  Trash2,
  Receipt
} from 'lucide-react'
import { getDynamicIcon } from '@/lib/iconUtils'
import { getTransactionStatusLabel } from '@/lib/pendingOperations'
import { motion, useMotionValue, useAnimation, useMotionValueEvent } from 'framer-motion'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

const safeNum = (val: any) => {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0

  const parsed = parseFloat(
    String(val)
      .replace(',', '.')
      .replace(/[^0-9.-]+/g, '')
  )

  return Number.isNaN(parsed) ? 0 : parsed
}

const safeString = (val: any) => {
  if (val === null || val === undefined) return ''
  return String(val)
}

const safeDate = (value: any) => {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return isValid(parsed) ? parsed : null
}

const formatTxDate = (value: any) => {
  const parsed = safeDate(value)
  if (!parsed) return '-- --'
  try {
    return format(parsed, 'dd MMM', { locale: ptBR })
  } catch {
    return '-- --'
  }
}

const getAttachmentIcon = (url: string | null | undefined) => {
  if (!url) return null

  const normalized = safeString(url).toLowerCase()
  const isDocument = /\.(pdf|doc|docx|xls|xlsx|csv|txt)(\?|$)/i.test(normalized)

  if (isDocument) {
    return <Paperclip size={12} className="text-gray-500 shrink-0" />
  }

  return <ImageIcon size={12} className="text-blue-500 shrink-0" />
}

interface TransactionItemProps {
  transaction: any
  onToggleStatus: (tx: any) => void
  onDelete: (tx: any) => void
}

export const TransactionItem = React.memo(
  ({ transaction, onToggleStatus, onDelete }: TransactionItemProps) => {
    const router = useRouter()
    const { vibrate, success, error: hapticError } = useHapticFeedback()

    const x = useMotionValue(0)
    const controls = useAnimation()

    const [swipeAction, setSwipeAction] = useState<'none' | 'edit' | 'done' | 'delete'>('none')
    const [lastVibratedAction, setLastVibratedAction] = useState<'none' | 'edit' | 'done' | 'delete'>('none')
    const [isDragging, setIsDragging] = useState(false)

    const tx = transaction ?? {}
    const txType = safeString(tx.type).toLowerCase()
    const txStatus = safeString(tx.status).toLowerCase()
    const txDescription = safeString(tx.description)
    const txCategoryName = safeString(tx.categories?.name)
    const txAccountName = safeString(tx.accounts?.name)
    const txDateLabel = useMemo(() => formatTxDate(tx.date), [tx.date])

    const isPending = txStatus === 'pending'
    const isIncome = txType === 'income'
    const isExpense =
      txType === 'expense' ||
      txType === 'sangria'
    const isTransfer = txType === 'transfer'
    const statusLabel =
      getTransactionStatusLabel(tx)

    const hasInstallments =
      safeNum(tx.total_installments) > 1

    const installmentBadge = hasInstallments
      ? `${safeNum(tx.installment_index) || 1}/${safeNum(tx.total_installments)}`
      : null

    const DynamicIcon = useMemo(() => {
      try {
        return isTransfer ? ArrowLeftRight : getDynamicIcon(tx.categories?.icon)
      } catch {
        return Receipt
      }
    }, [isTransfer, tx.categories?.icon])

    const attachmentIcon = getAttachmentIcon(tx.receipt_url)

    let amountColorClass = 'text-gray-800 dark:text-gray-200'
    let amountPrefix = ''
    let defaultName = 'Transação'

    if (isIncome) {
      amountColorClass = 'text-emerald-600 dark:text-emerald-400'
      amountPrefix = '+'
      defaultName = 'Receita'
    } else if (isExpense) {
      amountColorClass = 'text-red-500 dark:text-red-400'
      amountPrefix = '-'
      defaultName = 'Despesa'
    } else if (isTransfer) {
      amountColorClass = 'text-blue-500 dark:text-blue-400'
      amountPrefix = txDescription.toLowerCase().includes('de ') ? '+' : '-'
      defaultName = 'Transferência'
    }

    const transactionName = txDescription || txCategoryName || defaultName

    let bgClass = 'bg-gray-50 dark:bg-slate-800'
    let iconLeft: React.ReactNode = null
    let iconRight: React.ReactNode = null

    if (swipeAction === 'edit') {
      bgClass = 'bg-blue-500'
      iconLeft = <Edit3 className="text-white ml-5" size={24} />
    } else if (swipeAction === 'done') {
      bgClass = isPending ? 'bg-emerald-500' : 'bg-amber-500'
      iconRight = isPending ? (
        <Check className="text-white mr-5" size={24} />
      ) : (
        <Clock className="text-white mr-5" size={24} />
      )
    } else if (swipeAction === 'delete') {
      bgClass = 'bg-red-500'
      iconRight = <Trash2 className="text-white mr-5" size={24} />
    }

    useMotionValueEvent(x, 'change', (latest) => {
      let currentAction: 'none' | 'edit' | 'done' | 'delete' = 'none'

      if (latest > 60) currentAction = 'edit'
      else if (latest < -100) currentAction = 'delete'
      else if (latest < -40) currentAction = 'done'

      if (swipeAction !== currentAction) {
        setSwipeAction(currentAction)
      }

      if (currentAction !== lastVibratedAction) {
        setLastVibratedAction(currentAction)

        if (currentAction === 'edit') vibrate([10])
        else if (currentAction === 'done') success()
        else if (currentAction === 'delete') hapticError()
        else vibrate([5])
      }
    })

    useEffect(() => {
      if (swipeAction === 'none') {
        setLastVibratedAction('none')
      }
    }, [swipeAction])

    const handleOpenDetails = () => {
      if (isDragging) return
      if (!tx.id) return
      vibrate([10])
      router.push(`/transactions/details?id=${tx.id}`)
    }

    const handleDragEnd = (_event: any, info: any) => {
      const offset = safeNum(info?.offset?.x)

      if (offset > 60 && tx.id) {
        vibrate([10])
        router.push(`/transactions/edit?id=${tx.id}`)
      } else if (offset < -100 && tx.id) {
        onDelete?.(tx)
      } else if (offset < -40 && tx.id) {
        onToggleStatus?.(tx)
      }

      controls.start({
        x: 0,
        transition: { type: 'spring', stiffness: 400, damping: 25 }
      })

      setSwipeAction('none')
      setLastVibratedAction('none')

      setTimeout(() => setIsDragging(false), 40)
    }

    return (
      <div className="relative w-full mb-3 rounded-[24px] overflow-hidden group">
        <div className={`absolute inset-0 flex items-center justify-between transition-colors duration-200 ${bgClass}`}>
          <div className="flex-1 flex items-center justify-start h-full">{iconLeft}</div>
          <div className="flex-1 flex items-center justify-end h-full">{iconRight}</div>
        </div>

        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={handleDragEnd}
          animate={controls}
          style={{ x }}
          onClick={handleOpenDetails}
          className="relative bg-white dark:bg-slate-800 px-4 py-4 flex items-center gap-3 cursor-pointer shadow-sm border border-gray-50 dark:border-slate-700/50 rounded-[24px] active:scale-[0.98] transition-transform"
        >
          {isPending ? (
            <div className="w-7 h-7 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <Clock size={14} className="text-amber-500" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <Check size={14} className="text-emerald-500" />
            </div>
          )}

          <div
            className="w-12 h-12 rounded-[16px] flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: tx.categories?.color ? `${tx.categories.color}15` : '#f8f9fa',
              color: tx.categories?.color || '#64748b'
            }}
          >
            <DynamicIcon size={22} />
          </div>

          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5">
              <p className="text-[15px] font-bold text-gray-800 dark:text-gray-100 truncate tracking-tight">
                {transactionName}
              </p>
              {attachmentIcon && <span className="shrink-0">{attachmentIcon}</span>}
            </div>

            <div className="flex items-center gap-1.5 mt-0.5">
              {txCategoryName && (
                <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500">
                  {txCategoryName}
                </span>
              )}

              {txCategoryName && txAccountName && (
                <span className="text-[10px] text-gray-300 dark:text-gray-600">•</span>
              )}

              {txAccountName && (
                <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500">
                  {txAccountName}
                </span>
              )}
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="flex items-center gap-1.5 justify-end mb-1">
              {installmentBadge && (
                <span className="text-[10px] font-bold bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full border border-gray-100 dark:border-slate-600">
                  {installmentBadge}
                </span>
              )}

              <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {txDateLabel}
              </p>
            </div>

            <p className={`text-[15px] font-bold whitespace-nowrap ${amountColorClass}`}>
              {amountPrefix} {safeNum(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p
              className={`mt-0.5 text-[10.5px] font-semibold ${
                isPending
                  ? isIncome
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isExpense
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-blue-500 dark:text-blue-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {statusLabel}
            </p>
          </div>
        </motion.div>
      </div>
    )
  }
)

TransactionItem.displayName = 'TransactionItem'
