import Image from 'next/image';
import { Building2 } from 'lucide-react';

// Dicionário mapeando a palavra-chave para o site oficial da empresa
const bankDomains: Record<string, string> = {
  'inter': 'bancointer.com.br',
  'nubank': 'nubank.com.br',
  'itau': 'itau.com.br',
  'itaú': 'itau.com.br',
  'bradesco': 'banco.bradesco',
  'caixa': 'caixa.gov.br',
  'banco do brasil': 'bb.com.br',
  'bb': 'bb.com.br',
  'santander': 'santander.com.br',
  'c6': 'c6bank.com.br',
  'sicredi': 'sicredi.com.br',
  'sicoob': 'sicoob.com.br',
  'stone': 'stone.com.br',
  'infinitepay': 'infinitepay.io',
  'ifood': 'ifood.com.br',
  'mercado pago': 'mercadopago.com.br',
  'picpay': 'picpay.com',
};

interface BankLogoProps {
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function BankLogo({ name, color, size = 'md' }: BankLogoProps) {
  const normalizedName = name.toLowerCase();

  // Procura se o nome da conta contém alguma das chaves do nosso mapa
  const matchedBankKey = Object.keys(bankDomains).find(key => normalizedName.includes(key));

  const sizeClasses = {
    sm: 'w-6 h-6 rounded-md',
    md: 'w-10 h-10 rounded-[12px]',
    lg: 'w-12 h-12 rounded-2xl'
  };

  // Se achou uma correspondência, busca a logo direto da API do Clearbit
  if (matchedBankKey) {
    const domain = bankDomains[matchedBankKey];
    return (
      <div className={`${sizeClasses[size]} shrink-0 overflow-hidden shadow-sm border border-gray-200/60 dark:border-slate-700 bg-white flex items-center justify-center`}>
        <Image
          src={`https://logo.clearbit.com/${domain}`}
          alt={`Logo ${name}`}
          width={40}
          height={40}
          className="w-full h-full object-cover"
          unoptimized // Fundamental para carregar imagens de URLs externas sem erro
        />
      </div>
    );
  }

  // Fallback: Ícone genérico suave
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
