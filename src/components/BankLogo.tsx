'use client'

import { getBankLogoSvg } from '@/lib/bankIcons'

interface BankLogoProps {
  color: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function BankLogo({ color, name, size = 'md' }: BankLogoProps) {
  const logoSvg = getBankLogoSvg(name);

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

  // Se encontrou logo SVG
  if (logoSvg) {
    return (
      <div
        className={`${sizeClasses[size]} flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0`}
        dangerouslySetInnerHTML={{ __html: logoSvg }}
      />
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