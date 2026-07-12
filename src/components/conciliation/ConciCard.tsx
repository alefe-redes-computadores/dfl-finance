// src/components/conciliation/ConciCard.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, X, Calendar, DollarSign, Wallet, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

// Blindagem de números
const safeNum = (val: any) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(',', '.').replace(/[^0-9.-]+/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

export interface TransactionSuggestion {
  id: string
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  categorySuggestion?: string
  accountName?: string
  accountId?: string
  context?: 'dfl' | 'personal'
  source?: 'csv' | 'ocr' | 'manual'
}

interface ConciCardProps {
  transaction: TransactionSuggestion
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onTap?: (id: string) => void
  isLast?: boolean
  isLoading?: boolean
}

export function ConciCard({
  transaction,
  onApprove,
  onReject,
  onTap,
  isLast = false,
  isLoading = false,
}: ConciCardProps) {
  const [offsetX, setOffsetX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  
  const [lastVibratedDirection, setLastVibratedDirection] = useState<'left' | 'right' | null>(null)

  const startX = useRef(0)
  const startY = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const { vibrate, success, error: hapticError } = useHapticFeedback()

  const SWIPE_THRESHOLD = 90 // Levemente maior para evitar swipes acidentais
  const MAX_OFFSET = 200

  const isIncome = transaction?.type === 'income'
  const safeAmount = safeNum(transaction?.amount)
  
  const formattedDate = transaction?.date 
    ? format(new Date(transaction.date), "dd 'de' MMMM", { locale: ptBR })
    : 'Data desconhecida'

  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(safeAmount)

  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (isAnimating || isLoading) return
    startX.current = clientX
    startY.current = clientY
    setIsDragging(true)
    setLastVibratedDirection(null)
  }, [isAnimating, isLoading])

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || isAnimating) return
    const deltaX = clientX - startX.current
    const deltaY = clientY - startY.current

    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      const clamped = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, deltaX))
      setOffsetX(clamped)
      
      let newDirection: 'left' | 'right' | null = null
      if (clamped > SWIPE_THRESHOLD) newDirection = 'right'
      else if (clamped < -SWIPE_THRESHOLD) newDirection = 'left'

      setDirection(newDirection)

      // Vibra apenas quando ultrapassa o threshold
      if (newDirection && newDirection !== lastVibratedDirection) {
        vibrate([10])
        setLastVibratedDirection(newDirection)
      } else if (!newDirection && lastVibratedDirection !== null) {
        setLastVibratedDirection(null) // Reset se voltar pro meio
      }
    }
  }, [isDragging, isAnimating, lastVibratedDirection, vibrate])

  const handleEnd = useCallback(() => {
    if (!isDragging || isAnimating) return
    setIsDragging(false)

    if (direction === 'right') {
      setIsAnimating(true)
      setOffsetX(MAX_OFFSET)
      success()
      setTimeout(() => {
        onApprove(transaction.id)
        setOffsetX(0)
        setDirection(null)
        setIsAnimating(false)
      }, 300)
    } else if (direction === 'left') {
      setIsAnimating(true)
      setOffsetX(-MAX_OFFSET)
      hapticError()
      setTimeout(() => {
        onReject(transaction.id)
        setOffsetX(0)
        setDirection(null)
        setIsAnimating(false)
      }, 300)
    } else {
      if (Math.abs(offsetX) < 20 && onTap) {
        vibrate([5])
        onTap(transaction.id)
      }
      setOffsetX(0)
      setDirection(null)
    }
  }, [isDragging, isAnimating, direction, offsetX, transaction?.id, onApprove, onReject, onTap, success, hapticError, vibrate])

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    handleStart(e.clientX, e.clientY)
  }, [handleStart])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) handleMove(e.clientX, e.clientY)
  }, [isDragging, handleMove])

  const onMouseUp = useCallback(() => {
    if (isDragging) handleEnd()
  }, [isDragging, handleEnd])

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0]
    if (touch) handleStart(touch.clientX, touch.clientY)
  }, [handleStart])

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (isDragging) {
      const touch = e.touches[0]
      if (touch) handleMove(touch.clientX, touch.clientY)
    }
  }, [isDragging, handleMove])

  const onTouchEnd = useCallback(() => {
    if (isDragging) handleEnd()
  }, [isDragging, handleEnd])

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
      if (isDragging && !isAnimating) handleMove(e.clientX, e.clientY)
    }
    const handleGlobalUp = () => {
      if (isDragging && !isAnimating) handleEnd()
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMove)
      window.addEventListener('mouseup', handleGlobalUp)
      window.addEventListener('touchmove', handleGlobalMove as any)
      window.addEventListener('touchend', handleGlobalUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove)
      window.removeEventListener('mouseup', handleGlobalUp)
      window.removeEventListener('touchmove', handleGlobalMove as any)
      window.removeEventListener('touchend', handleGlobalUp)
    }
  }, [isDragging, isAnimating, handleMove, handleEnd])

  const cardStyle = {
    transform: `translateX(${offsetX}px) rotate(${offsetX * 0.04}deg) scale(${1 - Math.abs(offsetX) / 1000})`,
    transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
  }

  const overlayClasses = cn(
    'absolute inset-0 rounded-[32px] pointer-events-none transition-opacity duration-200',
    direction === 'right' && 'bg-emerald-500/10 dark:bg-emerald-500/20 border-2 border-emerald-400 dark:border-emerald-500',
    direction === 'left' && 'bg-red-500/10 dark:bg-red-500/20 border-2 border-red-400 dark:border-red-500'
  )

  const iconClasses = cn(
    'absolute top-1/2 -translate-y-1/2 text-[80px] font-black opacity-30 pointer-events-none transition-all duration-300 drop-shadow-md',
    direction === 'right' && 'right-10 text-emerald-500 scale-100',
    direction === 'left' && 'left-10 text-red-500 scale-100',
    !direction && 'scale-50 opacity-0'
  )

  if (isLoading || !transaction) {
    return (
      <div className="w-full max-w-md mx-auto animate-pulse">
        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-sm border border-gray-100 dark:border-slate-700/50 p-8 h-[380px] flex flex-col items-center justify-center gap-5">
          <div className="w-16 h-16 rounded-[24px] bg-gray-100 dark:bg-slate-700" />
          <div className="h-8 w-48 bg-gray-100 dark:bg-slate-700 rounded-lg" />
          <div className="h-5 w-32 bg-gray-100 dark:bg-slate-700 rounded-md" />
          <div className="h-14 w-full mt-4 bg-gray-100 dark:bg-slate-700 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto relative px-2">
      <div
        ref={cardRef}
        className={cn(
          'relative bg-white dark:bg-slate-800 rounded-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-gray-50 dark:border-slate-700/50 overflow-hidden',
          'cursor-grab active:cursor-grabbing touch-none select-none',
          'transition-shadow duration-300',
          isDragging ? 'shadow-[0_20px_40px_rgba(0,0,0,0.12)]' : '',
          isLast && 'border-b-4 border-emerald-400 dark:border-emerald-600'
        )}
        style={cardStyle}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className={overlayClasses} />
        <div className={iconClasses}>
          {direction === 'right' ? <Check /> : <X />}
        </div>

        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-12 h-12 rounded-[18px] flex items-center justify-center',
                  isIncome
                    ? 'bg-emerald-50 dark:bg-emerald-500/10'
                    : 'bg-red-50 dark:bg-red-500/10'
                )}
              >
                {isIncome ? (
                  <ArrowUp size={24} className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ArrowDown size={24} className="text-red-600 dark:text-red-400" />
                )}
              </div>
              <div>
                <span
                  className={cn(
                    'text-[13px] font-bold uppercase tracking-widest block',
                    isIncome
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {isIncome ? 'Entrada' : 'Saída'}
                </span>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">
                  <Calendar size={12} />
                  <span>{formattedDate}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center py-2">
            <p className="text-[40px] font-light text-gray-800 dark:text-gray-100 tracking-tight">
              {formattedAmount}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4 text-center">
            <p className="text-[15px] font-bold text-gray-800 dark:text-gray-200">
              {transaction.description || 'Descrição não informada'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-sm pt-2">
            {transaction.accountName && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-full text-blue-700 dark:text-blue-400">
                <Wallet size={14} />
                <span className="font-bold text-[12px]">{transaction.accountName}</span>
              </div>
            )}
            {transaction.categorySuggestion && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/30 rounded-full text-teal-700 dark:text-teal-400">
                <DollarSign size={14} />
                <span className="font-bold text-[12px]">{transaction.categorySuggestion}</span>
              </div>
            )}
          </div>

          <div className="text-center text-[11px] font-medium text-gray-400 dark:text-gray-500 pt-2 uppercase tracking-wider">
            {transaction.source === 'csv' && 'Origem: Extrato (CSV)'}
            {transaction.source === 'ocr' && 'Origem: Escaneamento'}
            {!transaction.source && 'Origem: Cadastro Manual'}
          </div>
        </div>
      </div>

      {/* Botões alternativos em telas onde o swipe pode ser difícil */}
      <div className="flex justify-between gap-4 mt-6">
        <button
          onClick={() => {
            hapticError()
            onReject(transaction.id)
          }}
          className={cn(
            'flex-1 py-4 rounded-[24px] bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 font-bold',
            'hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-[0.98] transition-transform duration-200',
            'flex items-center justify-center gap-2 text-[14px] border border-red-100 dark:border-red-500/20'
          )}
          disabled={isAnimating || isLoading}
        >
          <X size={20} />
          <span>Ignorar</span>
        </button>
        <button
          onClick={() => {
            success()
            onApprove(transaction.id)
          }}
          className={cn(
            'flex-1 py-4 rounded-[24px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/30',
            'active:scale-[0.98] transition-transform duration-200',
            'flex items-center justify-center gap-2 text-[14px]'
          )}
          disabled={isAnimating || isLoading}
        >
          <Check size={20} />
          <span>Conciliar</span>
        </button>
      </div>
    </div>
  )
}
