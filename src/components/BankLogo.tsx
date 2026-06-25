'use client'

import { useState } from 'react'
import { getBankLogoUrl } from '@/lib/bankIcons'

interface BankLogoProps {
  color: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function BankLogo({ color, name, size = 'md' }: BankLogoProps) {
  const logoUrl = getBankLogoUrl(name);
  const [imgFailed, setImgFailed] = useState(false);

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

  const fallbackInitials = name
    ? name.substring(0, 2).toUpperCase()
    : '??';

  // Se temos URL e a imagem ainda não falhou
  if (logoUrl && !imgFailed) {
    return (
      <div
        className={`${sizeClasses[size]} flex items-center justify-center overflow-hidden bg-white border border-gray-100 dark:border-slate-600 shadow-sm flex-shrink-0`}
      >
        <img
          src={logoUrl}
          alt={name}
          className="w-full h-full object-contain p-0.5"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  // Fallback: iniciais coloridas
  return (
    <div
      className={`${sizeClasses[size]} flex items-center justify-center ${textSizeClasses[size]} font-bold text-white shadow-sm flex-shrink-0`}
      style={{ backgroundColor: color || '#64748b' }}
    >
      {fallbackInitials}
    </div>
  );
}