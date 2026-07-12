'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock, Check, ArrowLeftRight, Image, Paperclip, Edit3, Trash2 } from 'lucide-react'
import { getDynamicIcon } from '@/lib/iconUtils'
import { motion, useMotionValue, useAnimation, useMotionValueEvent } from 'framer-motion'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

const safeNum = (val: any) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(',', '.').replace(/[^0-9.-]+/g,""));
  return isNaN(parsed) ? 0 : parsed;
}

const getAttachmentIcon = (url: string | null) => {
  if (!url) return null;
  const isDocument = /\.(pdf|doc|docx|xls|xlsx|csv|txt)(\?|$)/i.test(url.toLowerCase());
  if (isDocument) {
    return <Paperclip size={12} className="text-gray-500 shrink-0" />;
  }
  return <Image size={12} className="text-blue-500 shrink-0" />;
}

interface TransactionItemProps {
  transaction: any
  onToggleStatus: (tx: any) => void
  onDelete: (tx: any) => void
}

export const TransactionItem = React.memo(({ transaction, onToggleStatus, onDelete }: TransactionItemProps) => {
  const router = useRouter()
  const { vibrate, success, error: hapticError } = useHapticFeedback()
  
  const x = useMotionValue(0)
  const controls = useAnimation()
  const [swipeAction, setSwipeAction] = useState<'none' | 'edit' | 'done' | 'delete'>('none')
  
  // Controle para não disparar a vibração repetidas vezes no mesmo limite
  const [lastVibratedAction, setLastVibratedAction] = useState<'none' | 'edit' | 'done' | 'delete'>('none')

  useMotionValueEvent(x, "change", (latest) => {
    let currentAction: 'none' | 'edit' | 'done' | 'delete' = 'none'

    if (latest > 60) {
      currentAction = 'edit'
    } else if (latest < -100) {
      currentAction = 'delete'
    } else if (latest < -40) {
      currentAction = 'done'
    }

    if (swipeAction !== currentAction) {
      setSwipeAction(currentAction)
    }

    // Vibra apenas se a ação mudou e não for 'none'
    if (currentAction !== lastVibratedAction) {
      setLastVibratedAction(currentAction)
      if (currentAction === 'edit') vibrate([10])
      else if (currentAction === 'done') success() // Vibração de confirmação (pago)
      else if (currentAction === 'delete') hapticError() // Vibração mais pesada para exclusão
      else if (currentAction === 'none') vibrate([5]) // Leve toque ao voltar ao meio
    }
  })

  // Reseta o track de vibração quando soltar
  useEffect(() => {
    if (swipeAction === 'none') {
      setLastVibratedAction('none')
    }
  }, [swipeAction])

  const handleDragEnd = (event: any, info: any) => {
    const offset = info.offset.x
    if (offset > 60) {
      vibrate([10])
      router.push(`/transactions/edit?id=${transaction.id}`)
    } else if (offset < -100) {
      onDelete(transaction)
    } else if (offset < -40) {
      onToggleStatus(transaction)
    }
    controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 25 } })
    setSwipeAction('none')
    setLastVibratedAction('none')
  }

  const isPending = transaction.status === 'pending'
  const hasInstallments = transaction.total_installments && transaction.total_installments > 1
  const installmentBadge = hasInstallments ? `${transaction.installment_index || 1}/${transaction.total_installments}` : null
  const IconComp = transaction.type === 'transfer' ? ArrowLeftRight : getDynamicIcon(transaction.categories?.icon)
  const attachmentIcon = getAttachmentIcon(transaction.receipt_url)

  const isIncome = transaction.type === 'income';
  const isExpense = transaction.type === 'expense' || transaction.type === 'sangria';
  const isTransfer = transaction.type === 'transfer';

  let amountColorClass = 'text-gray-800 dark:text-gray-200';
  let amountPrefix = '';
  let defaultName = 'Transação';

  if (isIncome) {
    amountColorClass = 'text-emerald-600 dark:text-emerald-400';
    amountPrefix = '+';
    defaultName = 'Receita';
  } else if (isExpense) {
    amountColorClass = 'text-red-500 dark:text-red-400';
    amountPrefix = '-';
    defaultName = 'Despesa';
  } else if (isTransfer) {
    amountColorClass = 'text-blue-500 dark:text-blue-400';
    amountPrefix = transaction.description?.toLowerCase().includes('de ') ? '+' : '-';
    defaultName = 'Transferência';
  }

  const transactionName = transaction.description || transaction.categories?.name || defaultName;

  let bgClass = 'bg-gray-50 dark:bg-slate-800'
  let iconLeft = null
  let iconRight = null

  if (swipeAction === 'edit') {
    bgClass = 'bg-blue-500'
    iconLeft = <Edit3 className="text-white ml-5" size={24} />
  } else if (swipeAction === 'done') {
    bgClass = isPending ? 'bg-emerald-500' : 'bg-amber-500'
    iconRight = isPending ? <Check className="text-white mr-5" size={24} /> : <Clock className="text-white mr-5" size={24} />
  } else if (swipeAction === 'delete') {
    bgClass = 'bg-red-500'
    iconRight = <Trash2 className="text-white mr-5" size={24} />
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
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        onClick={() => {
          vibrate([10])
          router.push(`/transactions/details?id=${transaction.id}`)
        }}
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

        <div className="w-12 h-12 rounded-[16px] flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: transaction.categories?.color ? `${transaction.categories.color}15` : '#f8f9fa', color: transaction.categories?.color || '#64748b' }}>
          <IconComp size={22} />
        </div>

        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5">
            <p className="text-[15px] font-bold text-gray-800 dark:text-gray-100 truncate tracking-tight">
              {transactionName}
            </p>
            {attachmentIcon && <span className="shrink-0">{attachmentIcon}</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {transaction.categories?.name && (
              <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500">
                {transaction.categories.name}
              </span>
            )}
            {transaction.categories?.name && transaction.accounts?.name && (
              <span className="text-[10px] text-gray-300 dark:text-gray-600">•</span>
            )}
            {transaction.accounts?.name && (
              <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500">
                {transaction.accounts.name}
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
              {format(new Date(transaction.date), "dd MMM", { locale: ptBR })}
            </p>
          </div>
          <p className={`text-[15px] font-bold whitespace-nowrap ${amountColorClass}`}>
            {amountPrefix} {safeNum(transaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </motion.div>
    </div>
  )
})
