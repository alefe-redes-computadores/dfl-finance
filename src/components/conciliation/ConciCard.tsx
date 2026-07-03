// src/components/conciliation/ConciCard.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, X, Calendar, DollarSign, Building2, User, ArrowUp, ArrowDown, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

export interface TransactionSuggestion {
  id: string
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  categorySuggestion?: string
  accountName?: string        // Nome da conta (ex: "Conta Corrente")
  accountId?: string
  context?: 'dfl' | 'personal' // PF ou PJ
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

  const startX = useRef(0)
  const startY = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const { success, error } = useHapticFeedback()

  const SWIPE_THRESHOLD = 80
  const MAX_OFFSET = 200

  const isIncome = transaction.type === 'income'
  const formattedDate = format(new Date(transaction.date), "dd 'de' MMMM", { locale: ptBR })
  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(transaction.amount)

  // Handlers de gestos
  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (isAnimating || isLoading) return
    startX.current = clientX
    startY.current = clientY
    setIsDragging(true)
  }, [isAnimating, isLoading])

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || isAnimating) return
    const deltaX = clientX - startX.current
    const deltaY = clientY - startY.current

    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      const clamped = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, deltaX))
      setOffsetX(clamped)
      if (clamped > SWIPE_THRESHOLD) setDirection('right')
      else if (clamped < -SWIPE_THRESHOLD) setDirection('left')
      else setDirection(null)
    }
  }, [isDragging, isAnimating])

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
      error()
      setTimeout(() => {
        onReject(transaction.id)
        setOffsetX(0)
        setDirection(null)
        setIsAnimating(false)
      }, 300)
    } else {
      if (Math.abs(offsetX) < 20 && onTap) {
        onTap(transaction.id)
      }
      setOffsetX(0)
      setDirection(null)
    }
  }, [isDragging, isAnimating, direction, offsetX, transaction.id, onApprove, onReject, onTap, success, error])

  // Eventos de mouse
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    handleStart(e.clientX, e.clientY)
  }, [handleStart])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) handleMove(e.clientX, e.clientY)
  }, [isDragging, handleMove])

  const onMouseUp = useCallback(() => {
    if (isDragging) handleEnd()
  }, [isDragging, handleEnd])

  // Eventos de touch
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleStart(touch.clientX, touch.clientY)
  }, [handleStart])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging) {
      const touch = e.touches[0]
      handleMove(touch.clientX, touch.clientY)
    }
  }, [isDragging, handleMove])

  const onTouchEnd = useCallback(() => {
    if (isDragging) handleEnd()
  }, [isDragging, handleEnd])

  // Eventos globais
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
    transform: `translateX(${offsetX}px) rotate(${offsetX * 0.03}deg) scale(${1 - Math.abs(offsetX) / 800})`,
    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  }

  const overlayClasses = cn(
    'absolute inset-0 rounded-[32px] pointer-events-none transition-opacity duration-200',
    direction === 'right' && 'bg-emerald-500/20 border-4 border-emerald-500',
    direction === 'left' && 'bg-red-500/20 border-4 border-red-500'
  )

  const iconClasses = cn(
    'absolute top-1/2 -translate-y-1/2 text-6xl font-bold opacity-50 pointer-events-none transition-all duration-200',
    direction === 'right' && 'right-8 text-emerald-500 scale-100',
    direction === 'left' && 'left-8 text-red-500 scale-100',
    !direction && 'scale-50 opacity-0'
  )

  if (isLoading) {
    return (
      <div className="w-full max-w-md mx-auto animate-pulse">
        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-lg border border-gray-100 dark:border-slate-700/50 p-6 h-[400px] flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-slate-700" />
          <div className="h-6 w-48 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-12 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto relative">
      {/* Card principal */}
      <div
        ref={cardRef}
        className={cn(
          'relative bg-white dark:bg-slate-800 rounded-[32px] shadow-lg border-2 border-gray-100 dark:border-slate-700/50 overflow-hidden',
          'cursor-grab active:cursor-grabbing touch-none select-none',
          'transition-shadow duration-200 hover:shadow-xl',
          isLast && 'border-emerald-200 dark:border-emerald-800/50'
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
        {/* Overlay de cor */}
        <div className={overlayClasses} />

        {/* Ícones de aprovação/rejeição */}
        <div className={iconClasses}>
          {direction === 'right' ? <Check size={48} /> : <X size={48} />}
        </div>

        {/* Conteúdo do card */}
        <div className="p-6 space-y-4">
          {/* Cabeçalho: tipo + data */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  isIncome
                    ? 'bg-emerald-50 dark:bg-emerald-500/10'
                    : 'bg-red-50 dark:bg-red-500/10'
                )}
              >
                {isIncome ? (
                  <ArrowUp size={20} className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ArrowDown size={20} className="text-red-600 dark:text-red-400" />
                )}
              </div>
              <span
                className={cn(
                  'text-sm font-bold uppercase tracking-wider',
                  isIncome
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                )}
              >
                {isIncome ? 'Receita' : 'Despesa'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
              <Calendar size={14} />
              <span>{formattedDate}</span>
            </div>
          </div>

          {/* Valor */}
          <div className="text-center py-1">
            <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              {formattedAmount}
            </p>
          </div>

          {/* Descrição */}
          <div className="bg-gray-50 dark:bg-slate-700/30 rounded-2xl p-3 text-center">
            <p className="text-base font-semibold text-gray-800 dark:text-gray-200">
              {transaction.description || 'Sem descrição'}
            </p>
          </div>

          {/* Conta e Categoria */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            {transaction.accountName && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full text-blue-700 dark:text-blue-300">
                <Wallet size={14} />
                <span className="font-medium">{transaction.accountName}</span>
              </div>
            )}
            {transaction.categorySuggestion && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 dark:bg-teal-900/20 rounded-full text-teal-700 dark:text-teal-300">
                <DollarSign size={14} />
                <span className="font-medium">{transaction.categorySuggestion}</span>
              </div>
            )}
          </div>

          {/* Fonte da transação */}
          <div className="text-center text-xs text-gray-400 dark:text-gray-500 pt-1">
            {transaction.source === 'csv' && '📄 Importado via CSV'}
            {transaction.source === 'ocr' && '📷 Reconhecido por OCR'}
            {!transaction.source && '✏️ Inserido manualmente'}
          </div>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="flex justify-between gap-3 mt-4 px-2">
        <button
          onClick={() => onReject(transaction.id)}
          className={cn(
            'flex-1 py-3.5 rounded-full bg-red-500 text-white font-bold shadow-lg',
            'hover:bg-red-600 active:scale-95 transition-all duration-200',
            'flex items-center justify-center gap-2 text-sm'
          )}
          disabled={isAnimating || isLoading}
        >
          <X size={18} />
          <span>Descartar</span>
        </button>
        <button
          onClick={() => onApprove(transaction.id)}
          className={cn(
            'flex-1 py-3.5 rounded-full bg-emerald-500 text-white font-bold shadow-lg',
            'hover:bg-emerald-600 active:scale-95 transition-all duration-200',
            'flex items-center justify-center gap-2 text-sm'
          )}
          disabled={isAnimating || isLoading}
        >
          <Check size={18} />
          <span>Aprovar</span>
        </button>
      </div>
    </div>
  )
}// src/components/conciliation/ConciCard.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, X, Calendar, DollarSign, Building2, User, ArrowUp, ArrowDown, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

export interface TransactionSuggestion {
  id: string
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  categorySuggestion?: string
  accountName?: string        // Nome da conta (ex: "Conta Corrente")
  accountId?: string
  context?: 'dfl' | 'personal' // PF ou PJ
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

  const startX = useRef(0)
  const startY = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const { success, error } = useHapticFeedback()

  const SWIPE_THRESHOLD = 80
  const MAX_OFFSET = 200

  const isIncome = transaction.type === 'income'
  const formattedDate = format(new Date(transaction.date), "dd 'de' MMMM", { locale: ptBR })
  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(transaction.amount)

  // Handlers de gestos
  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (isAnimating || isLoading) return
    startX.current = clientX
    startY.current = clientY
    setIsDragging(true)
  }, [isAnimating, isLoading])

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || isAnimating) return
    const deltaX = clientX - startX.current
    const deltaY = clientY - startY.current

    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      const clamped = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, deltaX))
      setOffsetX(clamped)
      if (clamped > SWIPE_THRESHOLD) setDirection('right')
      else if (clamped < -SWIPE_THRESHOLD) setDirection('left')
      else setDirection(null)
    }
  }, [isDragging, isAnimating])

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
      error()
      setTimeout(() => {
        onReject(transaction.id)
        setOffsetX(0)
        setDirection(null)
        setIsAnimating(false)
      }, 300)
    } else {
      if (Math.abs(offsetX) < 20 && onTap) {
        onTap(transaction.id)
      }
      setOffsetX(0)
      setDirection(null)
    }
  }, [isDragging, isAnimating, direction, offsetX, transaction.id, onApprove, onReject, onTap, success, error])

  // Eventos de mouse
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    handleStart(e.clientX, e.clientY)
  }, [handleStart])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) handleMove(e.clientX, e.clientY)
  }, [isDragging, handleMove])

  const onMouseUp = useCallback(() => {
    if (isDragging) handleEnd()
  }, [isDragging, handleEnd])

  // Eventos de touch
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleStart(touch.clientX, touch.clientY)
  }, [handleStart])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging) {
      const touch = e.touches[0]
      handleMove(touch.clientX, touch.clientY)
    }
  }, [isDragging, handleMove])

  const onTouchEnd = useCallback(() => {
    if (isDragging) handleEnd()
  }, [isDragging, handleEnd])

  // Eventos globais
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
    transform: `translateX(${offsetX}px) rotate(${offsetX * 0.03}deg) scale(${1 - Math.abs(offsetX) / 800})`,
    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  }

  const overlayClasses = cn(
    'absolute inset-0 rounded-[32px] pointer-events-none transition-opacity duration-200',
    direction === 'right' && 'bg-emerald-500/20 border-4 border-emerald-500',
    direction === 'left' && 'bg-red-500/20 border-4 border-red-500'
  )

  const iconClasses = cn(
    'absolute top-1/2 -translate-y-1/2 text-6xl font-bold opacity-50 pointer-events-none transition-all duration-200',
    direction === 'right' && 'right-8 text-emerald-500 scale-100',
    direction === 'left' && 'left-8 text-red-500 scale-100',
    !direction && 'scale-50 opacity-0'
  )

  if (isLoading) {
    return (
      <div className="w-full max-w-md mx-auto animate-pulse">
        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-lg border border-gray-100 dark:border-slate-700/50 p-6 h-[400px] flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-slate-700" />
          <div className="h-6 w-48 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-12 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto relative">
      {/* Card principal */}
      <div
        ref={cardRef}
        className={cn(
          'relative bg-white dark:bg-slate-800 rounded-[32px] shadow-lg border-2 border-gray-100 dark:border-slate-700/50 overflow-hidden',
          'cursor-grab active:cursor-grabbing touch-none select-none',
          'transition-shadow duration-200 hover:shadow-xl',
          isLast && 'border-emerald-200 dark:border-emerald-800/50'
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
        {/* Overlay de cor */}
        <div className={overlayClasses} />

        {/* Ícones de aprovação/rejeição */}
        <div className={iconClasses}>
          {direction === 'right' ? <Check size={48} /> : <X size={48} />}
        </div>

        {/* Conteúdo do card */}
        <div className="p-6 space-y-4">
          {/* Cabeçalho: tipo + data */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  isIncome
                    ? 'bg-emerald-50 dark:bg-emerald-500/10'
                    : 'bg-red-50 dark:bg-red-500/10'
                )}
              >
                {isIncome ? (
                  <ArrowUp size={20} className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ArrowDown size={20} className="text-red-600 dark:text-red-400" />
                )}
              </div>
              <span
                className={cn(
                  'text-sm font-bold uppercase tracking-wider',
                  isIncome
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                )}
              >
                {isIncome ? 'Receita' : 'Despesa'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
              <Calendar size={14} />
              <span>{formattedDate}</span>
            </div>
          </div>

          {/* Valor */}
          <div className="text-center py-1">
            <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              {formattedAmount}
            </p>
          </div>

          {/* Descrição */}
          <div className="bg-gray-50 dark:bg-slate-700/30 rounded-2xl p-3 text-center">
            <p className="text-base font-semibold text-gray-800 dark:text-gray-200">
              {transaction.description || 'Sem descrição'}
            </p>
          </div>

          {/* Conta e Categoria */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            {transaction.accountName && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full text-blue-700 dark:text-blue-300">
                <Wallet size={14} />
                <span className="font-medium">{transaction.accountName}</span>
              </div>
            )}
            {transaction.categorySuggestion && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 dark:bg-teal-900/20 rounded-full text-teal-700 dark:text-teal-300">
                <DollarSign size={14} />
                <span className="font-medium">{transaction.categorySuggestion}</span>
              </div>
            )}
          </div>

          {/* Fonte da transação */}
          <div className="text-center text-xs text-gray-400 dark:text-gray-500 pt-1">
            {transaction.source === 'csv' && '📄 Importado via CSV'}
            {transaction.source === 'ocr' && '📷 Reconhecido por OCR'}
            {!transaction.source && '✏️ Inserido manualmente'}
          </div>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="flex justify-between gap-3 mt-4 px-2">
        <button
          onClick={() => onReject(transaction.id)}
          className={cn(
            'flex-1 py-3.5 rounded-full bg-red-500 text-white font-bold shadow-lg',
            'hover:bg-red-600 active:scale-95 transition-all duration-200',
            'flex items-center justify-center gap-2 text-sm'
          )}
          disabled={isAnimating || isLoading}
        >
          <X size={18} />
          <span>Descartar</span>
        </button>
        <button
          onClick={() => onApprove(transaction.id)}
          className={cn(
            'flex-1 py-3.5 rounded-full bg-emerald-500 text-white font-bold shadow-lg',
            'hover:bg-emerald-600 active:scale-95 transition-all duration-200',
            'flex items-center justify-center gap-2 text-sm'
          )}
          disabled={isAnimating || isLoading}
        >
          <Check size={18} />
          <span>Aprovar</span>
        </button>
      </div>
    </div>
  )
}