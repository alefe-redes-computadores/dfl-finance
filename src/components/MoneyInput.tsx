'use client'

import { useCallback, useEffect, useState } from 'react'

interface MoneyInputProps {
  value?: number
  onChange: (numValue: number, formattedValue: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  allowNegative?: boolean
  ariaLabel?: string
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export default function MoneyInput({
  value = 0,
  onChange,
  className = '',
  placeholder = '0,00',
  disabled = false,
  autoFocus = false,
  allowNegative = false,
  ariaLabel = 'Valor em reais',
}: MoneyInputProps) {
  const [displayValue, setDisplayValue] = useState(formatMoney(value))

  useEffect(() => {
    const safeValue = Number.isFinite(value) ? value : 0
    setDisplayValue(formatMoney(safeValue))
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value
      const negative =
        allowNegative &&
        input.trim().startsWith('-')

      // O valor visual é sempre derivado dos centavos digitados.
      let raw = input.replace(/\D/g, '')

      if (!raw) {
        const formatted = negative ? '-0,00' : '0,00'
        setDisplayValue(formatted)
        onChange(0, formatted)
        return
      }

      raw = raw.replace(/^0+/, '')

      if (!raw) {
        setDisplayValue('0,00')
        onChange(0, '0,00')
        return
      }

      if (raw.length === 1) raw = `00${raw}`
      if (raw.length === 2) raw = `0${raw}`

      const absoluteValue = Number(raw) / 100
      const numValue =
        negative ? -absoluteValue : absoluteValue
      const formatted = `${
        negative ? '-' : ''
      }${formatMoney(absoluteValue)}`

      setDisplayValue(formatted)
      onChange(numValue, formatted)
    },
    [allowNegative, onChange]
  )

  return (
    <input
      type="text"
      inputMode={allowNegative ? 'text' : 'numeric'}
      enterKeyHint="done"
      autoComplete="off"
      spellCheck={false}
      value={displayValue}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
    />
  )
}
