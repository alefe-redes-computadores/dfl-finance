'use client'

import { getBankColor, getBankLogoSvg } from '@/lib/BankIcons'
import { Building } from 'lucide-react'

interface BankLogoProps {
  color: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function BankLogo({ color, name, size = 'md' }: BankLogoProps) {
  const logoSvg = getBankLogoSvg(name);
  const bankColor = getBankColor(name);

  const sizeClasses = {
    sm: 'w-6 h-6 rounded-lg',
    md: 'w-10 h-10 rounded-[14px]',
    lg: 'w-16 h-16 rounded-2xl',
  };

  const textSizeClasses = {
    sm: 'text-[8px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  const initials = name
    ? name.substring(0, 2).toUpperCase()
    : '??';

  // Se tem SVG e cor do banco, mostra o logo com fundo colorido
  if (logoSvg && bankColor) {
    return (
      <div
        className={`${sizeClasses[size]} flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0`}
        style={{ backgroundColor: bankColor }}
        dangerouslySetInnerHTML={{ __html: logoSvg }}
      />
    );
  }

  // Se tem cor do banco mas sem SVG, mostra iniciais com a cor do banco
  if (bankColor) {
    return (
      <div
        className={`${sizeClasses[size]} flex items-center justify-center ${textSizeClasses[size]} font-bold text-white shadow-sm flex-shrink-0`}
        style={{ backgroundColor: bankColor }}
      >
        {initials}
      </div>
    );
  }

  // Fallback: iniciais com a cor personalizada da conta
  return (
    <div
      className={`${sizeClasses[size]} flex items-center justify-center ${textSizeClasses[size]} font-bold text-white shadow-sm flex-shrink-0`}
      style={{ backgroundColor: color || '#64748b' }}
    >
      {initials}
    </div>
  );
}