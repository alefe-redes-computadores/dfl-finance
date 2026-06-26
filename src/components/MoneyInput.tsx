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
      
      // Se o campo ficou vazio ou só tem zeros
      if (!raw || raw === '0' || raw === '00') {
        setDisplayValue('0,00')
        onChange(0, '0,00')
        return
      }
      
      // Remove zeros à esquerda, mas mantém pelo menos 1 dígito para centavos
      raw = raw.replace(/^0+/, '')
      
      // Garante que temos pelo menos 3 dígitos (1 para reais + 2 para centavos)
      // Se o usuário digitou "5", transforma em "005" = R$ 0,05
      // Se o usuário digitou "50", transforma em "050" = R$ 0,50
      // Se o usuário digitou "500", fica "500" = R$ 5,00
      if (raw.length === 1) {
        raw = '00' + raw  // "5" → "005" = R$ 0,05
      } else if (raw.length === 2) {
        raw = '0' + raw   // "50" → "050" = R$ 0,50
      }
      // Se raw.length >= 3, já está no formato correto

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