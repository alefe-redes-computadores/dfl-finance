'use client'

import React, { useState } from 'react'
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
  if (!url) return null
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url)
  if (isImage) return <Image size={12} className="text-blue-500 shrink-0" />
  return <Paperclip size={12} className="text-gray-500 shrink-0" />
}

interface TransactionItemProps {
  transaction: any
  onToggleStatus: (tx: any) => void
  onDelete: (tx: any) => void
}

export const TransactionItem = React.memo(({ transaction, onToggleStatus, onDelete }: TransactionItemProps) => {
  const router = useRouter()
  const { vibrate } = useHapticFeedback()
  
  // Controles de Animação e Swipe
  const x = useMotionValue(0)
  const controls = useAnimation()
  const [swipeAction, setSwipeAction] = useState<'none' | 'edit' | 'done' | 'delete'>('none')

  // Monitora a posição do arrasto para mudar a cor de fundo dinamicamente
  useMotionValueEvent(x, "change", (latest) => {
    if (latest > 60) {
      if (swipeAction !== 'edit') { setSwipeAction('edit'); vibrate([10]); }
    } else if (latest < -100) {
      if (swipeAction !== 'delete') { setSwipeAction('delete'); vibrate([30]); }
    } else if (latest < -40) {
      if (swipeAction !== 'done') { setSwipeAction('done'); vibrate([10]); }
    } else {
      if (swipeAction !== 'none') setSwipeAction('none')
    }
  })

  const handleDragEnd = (event: any, info: any) => {
    const offset = info.offset.x
    
    // Ações baseadas na distância do Swipe
    if (offset > 60) {
      router.push(`/transactions/${transaction.id}`) // Edição
    } else if (offset < -100) {
      onDelete(transaction) // Excluir
    } else if (offset < -40) {
      onToggleStatus(transaction) // Efetivar/Pendente
    }

    // Volta o card para a posição inicial com efeito mola
    controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 25 } })
  }

  const isTransferIn = transaction.type === 'transfer' && transaction.description?.includes('de ')
  const isIncomeVisual = transaction.type === 'income' || isTransferIn
  const isPending = transaction.status === 'pending'
  const hasInstallments = transaction.total_installments && transaction.total_installments > 1
  const installmentBadge = hasInstallments ? `${transaction.installment_index || 1}/${transaction.total_installments}` : null
  const transactionName = transaction.description || transaction.categories?.name || (isIncomeVisual ? 'Receita' : 'Despesa')
  const IconComp = transaction.type === 'transfer' ? ArrowLeftRight : getDynamicIcon(transaction.categories?.icon)
  const attachmentIcon = getAttachmentIcon(transaction.receipt_url)

  // Configurações do Fundo Dinâmico
  let bgClass = 'bg-gray-100 dark:bg-slate-800'
  let iconLeft = null
  let iconRight = null

  if (swipeAction === 'edit') {
    bgClass = 'bg-blue-500'
    iconLeft = <Edit3 className="text-white ml-4" size={24} />
  } else if (swipeAction === 'done') {
    bgClass = isPending ? 'bg-emerald-500' : 'bg-amber-500'
    iconRight = isPending ? <Check className="text-white mr-4" size={24} /> : <Clock className="text-white mr-4" size={24} />
  } else if (swipeAction === 'delete') {
    bgClass = 'bg-red-500'
    iconRight = <Trash2 className="text-white mr-4" size={24} />
  }

  return (
    <div className="relative w-full mb-3 rounded-[20px] overflow-hidden">
      {/* Fundo do Swipe (Revelado ao arrastar) */}
      <div className={`absolute inset-0 flex items-center justify-between transition-colors duration-200 ${bgClass}`}>
        <div className="flex-1 flex items-center justify-start">{iconLeft}</div>
        <div className="flex-1 flex items-center justify-end">{iconRight}</div>
      </div>

      {/* Card Flutuante Principal */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        onClick={() => router.push(`/transactions/${transaction.id}`)}
        className="relative bg-white dark:bg-slate-800 px-4 py-4 flex items-center gap-3 cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.03)] dark:shadow-none rounded-[20px] border border-gray-100/50 dark:border-slate-700/50"
      >
        {isPending ? (
          <div className="w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <Clock size={14} className="text-amber-500" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
            <Check size={14} className="text-emerald-500" />
          </div>
        )}

        <div className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: transaction.categories?.color ? `${transaction.categories.color}20` : '#f3f4f6', color: transaction.categories?.color || '#64748b' }}>
          <IconComp size={20} />
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
              <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                {transaction.categories.name}
              </span>
            )}
            {transaction.categories?.name && transaction.accounts?.name && (
              <span className="text-[12px] text-gray-300 dark:text-gray-600">•</span>
            )}
            {transaction.accounts?.name && (
              <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                {transaction.accounts.name}
              </span>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="flex items-center gap-1 justify-end mb-1">
            {installmentBadge && (
              <span className="text-[10px] font-bold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300 px-1.5 py-0.5 rounded-md">
                {installmentBadge}
              </span>
            )}
            <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              {format(new Date(transaction.date), "dd MMM", { locale: ptBR })}
            </p>
          </div>
          <p className={`text-[15px] font-bold whitespace-nowrap ${isIncomeVisual ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            {isIncomeVisual ? '+' : '-'} R$ {safeNum(transaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </motion.div>
    </div>
  )
})
