'use client'

import React, { useState, useCallback, useEffect } from 'react'

interface MoneyInputProps {
  value: number
  onChange: (numValue: number, formattedValue: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
}

export default function MoneyInput({
  value,
  onChange,
  className = '',
  placeholder = '0,00',
  disabled = false,
  autoFocus = false,
}: MoneyInputProps) {
  const [displayValue, setDisplayValue] = useState(() =>
    (value || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )

  // Sincroniza o valor de exibição se a prop `value` mudar de fora (ex: via OCR)
  useEffect(() => {
    setDisplayValue(
      (value || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    )
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value.replace(/\D/g, '')
      
      if (!raw || raw === '0' || raw === '00') {
        setDisplayValue('0,00')
        onChange(0, '0,00')
        return
      }
      
      raw = raw.replace(/^0+/, '')
      
      if (raw.length === 1) {
        raw = '00' + raw
      } else if (raw.length === 2) {
        raw = '0' + raw
      }

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
      autoFocus={autoFocus}
    />
  )
}
