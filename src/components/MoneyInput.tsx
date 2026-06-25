'use client'

import React, { useState, useCallback } from 'react'

interface MoneyInputProps {
  value: number
  onChange: (numValue: number, formattedValue: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
}

export default function MoneyInput({
  value,
  onChange,
  className = '',
  placeholder = '0,00',
  disabled = false,
}: MoneyInputProps) {
  const [displayValue, setDisplayValue] = useState(() =>
    (value || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value.replace(/\D/g, '')
      if (!raw || raw === '0') {
        setDisplayValue('0,00')
        onChange(0, '0,00')
        return
      }
      // Remove zeros à esquerda
      raw = raw.replace(/^0+/, '') || '0'

      const numValue = parseFloat(raw) / 100
      const formatted = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numValue)

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
    />
  )
}