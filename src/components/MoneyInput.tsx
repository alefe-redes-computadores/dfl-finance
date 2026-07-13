'use client'

import { useCallback, useEffect, useState } from 'react'

interface MoneyInputProps {
  value?: number
  onChange: (numValue: number, formattedValue: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
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
}: MoneyInputProps) {
  const [displayValue, setDisplayValue] = useState(formatMoney(value))

  useEffect(() => {
    const safeValue = Number.isFinite(value) ? value : 0
    setDisplayValue(formatMoney(safeValue))
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value.replace(/D/g, '')

      if (!raw) {
        setDisplayValue('0,00')
        onChange(0, '0,00')
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

      const numValue = Number(raw) / 100
      const formatted = formatMoney(numValue)

      setDisplayValue(formatted)
      onChange(numValue, formatted)
    },
    [onChange]
  )

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
    />
  )
}