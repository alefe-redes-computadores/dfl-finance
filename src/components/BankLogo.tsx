import { getBankIcon } from '@/lib/bankicons'

interface BankLogoProps {
  color: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function BankLogo({ color, name, size = 'md' }: BankLogoProps) {
  const logoUrl = getBankLogoUrl(name);
  
  const sizeClasses = {
    sm: 'w-6 h-6 rounded-lg',
    md: 'w-10 h-10 rounded-[14px]',
    lg: 'w-16 h-16 rounded-2xl',
  };

  const fallbackInitials = name
    ? name.substring(0, 2).toUpperCase()
    : '??';

  if (logoUrl) {
    // Exibe o logo do banco
    return (
      <div
        className={`${sizeClasses[size]} flex items-center justify-center overflow-hidden bg-white border border-gray-100 dark:border-slate-600 shadow-sm flex-shrink-0`}
      >
        <img
          src={logoUrl}
          alt={name}
          className="w-full h-full object-contain p-0.5"
          onError={(e) => {
            // Se a imagem falhar, exibe as iniciais como fallback
            const target = e.currentTarget;
            target.style.display = 'none';
            target.parentElement?.classList.add('bg-gray-100', 'dark:bg-slate-700');
            target.parentElement!.innerHTML = `<span class="text-xs font-bold text-gray-600 dark:text-gray-300">${fallbackInitials}</span>`;
          }}
        />
      </div>
    );
  }

  // Fallback: exibe as iniciais coloridas (como antes)
  return (
    <div
      className={`${sizeClasses[size]} flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0`}
      style={{ backgroundColor: color || '#64748b' }}
    >
      {fallbackInitials}
    </div>
  );
}