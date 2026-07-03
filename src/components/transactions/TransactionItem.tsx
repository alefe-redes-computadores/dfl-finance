'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock, Check, ArrowLeftRight, Image, Paperclip } from 'lucide-react'
import { getDynamicIcon } from '@/lib/iconUtils'

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
  index: number
  totalItems: number
}

const TransactionItemComponent = ({ transaction, index, totalItems }: TransactionItemProps) => {
  const router = useRouter()
  
  const isTransferIn = transaction.type === 'transfer' && transaction.description?.includes('de ')
  const isIncomeVisual = transaction.type === 'income' || isTransferIn
  const isPending = transaction.status === 'pending'

  const IconComp = transaction.type === 'transfer' ? ArrowLeftRight : getDynamicIcon(transaction.categories?.icon)
  const attachmentIcon = getAttachmentIcon(transaction.receipt_url)

  const hasInstallments = transaction.total_installments && transaction.total_installments > 1
  const installmentBadge = hasInstallments 
    ? `${transaction.installment_index || 1}/${transaction.total_installments}` 
    : null

  const transactionName = transaction.description || transaction.categories?.name || (isIncomeVisual ? 'Receita' : 'Despesa')

  return (
    <div 
      onClick={() => router.push(`/transactions/${transaction.id}`)}
      className={`px-4 py-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${index !== totalItems - 1 ? 'border-b border-gray-50 dark:border-slate-700' : ''}`}
    >
      {isPending ? (
        <div className="w-5 h-5 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
          <Clock size={12} className="text-red-400" />
        </div>
      ) : (
        <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
          <Check size={12} className="text-emerald-500" />
        </div>
      )}

      <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: transaction.categories?.color ? `${transaction.categories.color}20` : '#f3f4f6', color: transaction.categories?.color || '#64748b' }}>
        <IconComp size={18} />
      </div>

      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-1.5">
          <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate uppercase tracking-tight">
            {transactionName}
          </p>
          {attachmentIcon && (
            <span className="shrink-0">{attachmentIcon}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {transaction.categories?.name && (
            <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
              {transaction.categories.name}
            </span>
          )}
          {transaction.categories?.name && transaction.accounts?.name && (
            <span className="text-[11px] text-gray-300 dark:text-gray-600">•</span>
          )}
          {transaction.accounts?.name && (
            <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
              {transaction.accounts.name}
            </span>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-1 justify-end mb-1">
          {installmentBadge && (
            <span className="text-[9px] font-bold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-md">
              {installmentBadge}
            </span>
          )}
          <p className="text-[10px] font-bold text-gray-300 dark:text-gray-600">
            {format(new Date(transaction.date), "dd 'de' MMM", { locale: ptBR })}
          </p>
        </div>
        <p className={`text-[14px] font-bold whitespace-nowrap ${isIncomeVisual ? 'text-emerald-600' : 'text-red-500'}`}>
          {isIncomeVisual ? '+' : '-'} R$ {safeNum(transaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  )
}

export const TransactionItem = React.memo(TransactionItemComponent)
