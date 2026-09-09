// src/components/BankLogo.tsx
import { getBankIcon } from '@/lib/BankIcons'

interface BankLogoProps {
  name: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function BankLogo({
  name,
  color,
  size = 'md',
}: BankLogoProps) {
  const sizeClasses = {
    sm: 'h-7 w-7 rounded-[9px]',
    md: 'h-10 w-10 rounded-[13px]',
    lg: 'h-12 w-12 rounded-[15px]',
  }

  return (
    <div
      className={`${sizeClasses[size]} shrink-0 overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/10`}
      title={name || 'Instituição financeira'}
    >
      {getBankIcon(
        name,
        color
      )}
    </div>
  )
}
