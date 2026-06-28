'use client'

import { getBankIcon } from '@/lib/BankIcons'


interface BankLogoProps {
  color: string
  name: string
  size?: 'sm' | 'md' | 'lg'
}

export default function BankLogo({ color, name, size = 'md' }: BankLogoProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  }

  const fallbackInitials = name
    ? name.substring(0, 2).toUpperCase()
    : '??'

  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-sm`}>
      {getBankIcon(name)}
    </div>
  )
}