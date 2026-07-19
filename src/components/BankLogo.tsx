import Image from 'next/image';
import { Building2 } from 'lucide-react';

// Dicionário de palavras-chave para buscar os SVGs
const bankLogos: Record<string, string> = {
  'inter': '/banks/inter.svg',
  'nubank': '/banks/nubank.svg',
  'itau': '/banks/itau.svg',
  'itaú': '/banks/itau.svg',
  'bradesco': '/banks/bradesco.svg',
  'caixa': '/banks/caixa.svg',
  'banco do brasil': '/banks/bb.svg',
  'bb': '/banks/bb.svg',
  'santander': '/banks/santander.svg',
  'c6': '/banks/c6.svg',
  'sicredi': '/banks/sicredi.svg',
  'sicoob': '/banks/sicoob.svg',
  'stone': '/banks/stone.svg',
  'infinitepay': '/banks/infinitepay.svg',
  'ifood': '/banks/ifood.svg',
  'mercado pago': '/banks/mercadopago.svg',
  'picpay': '/banks/picpay.svg',
};

interface BankLogoProps {
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function BankLogo({ name, color, size = 'md' }: BankLogoProps) {
  // Normaliza o nome para minúsculas para facilitar a busca
  const normalizedName = name.toLowerCase();

  // Procura se o nome da conta contém alguma das chaves do nosso mapa
  const matchedBank = Object.keys(bankLogos).find(key => normalizedName.includes(key));

  // Tamanhos padronizados do Squircle (quadrado com bordas arredondadas)
  const sizeClasses = {
    sm: 'w-6 h-6 rounded-md',
    md: 'w-10 h-10 rounded-[12px]',
    lg: 'w-12 h-12 rounded-2xl'
  };

  // Se achou uma logo conhecida, renderiza a imagem real
  if (matchedBank) {
    return (
      <div className={`${sizeClasses[size]} shrink-0 overflow-hidden shadow-sm border border-gray-200/60 dark:border-slate-700 bg-white flex items-center justify-center`}>
        <Image
          src={bankLogos[matchedBank]}
          alt={`Logo ${name}`}
          width={40}
          height={40}
          className="w-full h-full object-cover"
          unoptimized // Necessário se for rodar puro no Capacitor sem servidor Next
        />
      </div>
    );
  }

  // Fallback: Se não achou, renderiza o ícone genérico suave com a cor escolhida
  return (
    <div
      className={`${sizeClasses[size]} shrink-0 flex items-center justify-center shadow-sm`}
      style={{
        backgroundColor: color ? `${color}15` : '#94a3b815',
        color: color || '#64748b'
      }}
    >
      <Building2 size={size === 'md' ? 20 : size === 'sm' ? 14 : 24} />
    </div>
  );
}
