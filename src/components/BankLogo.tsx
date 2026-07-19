import {
  Building2,
  CreditCard,
  Smartphone,
  Infinity as InfinityIcon,
  Utensils,
  Landmark,
  CircleDollarSign,
  Wallet
} from 'lucide-react';

// Dicionário com as cores hexadecimais oficiais e um ícone que lembre a marca
const brandMap: Record<string, { icon: any; color: string }> = {
  ifood: { icon: Utensils, color: '#EA1D2C' },
  stone: { icon: CircleDollarSign, color: '#1BBC6D' },
  infinite: { icon: InfinityIcon, color: '#1A1A1A' }, // InfinitePay
  pagbank: { icon: Smartphone, color: '#F48A20' },
  pagseguro: { icon: Smartphone, color: '#F48A20' },
  nubank: { icon: CreditCard, color: '#8A05BE' },
  inter: { icon: Landmark, color: '#FF7A00' },
  itau: { icon: Landmark, color: '#EC7000' },
  itaú: { icon: Landmark, color: '#EC7000' },
  bradesco: { icon: Landmark, color: '#CC092F' },
  bb: { icon: Landmark, color: '#F9D300' }, // Banco do Brasil
  bancodobrasil: { icon: Landmark, color: '#F9D300' },
  caixa: { icon: Landmark, color: '#005CA9' },
  santander: { icon: Landmark, color: '#EC0000' },
  sicredi: { icon: Landmark, color: '#00A859' },
  sicoob: { icon: Landmark, color: '#00AE9D' },
  mercadopago: { icon: Smartphone, color: '#009EE3' },
  picpay: { icon: Smartphone, color: '#11C76F' },
  carteira: { icon: Wallet, color: '#64748b' }, // Conta carteira física
};

interface BankLogoProps {
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function BankLogo({ name, color, size = 'md' }: BankLogoProps) {
  // Remove espaços e deixa tudo em minúsculo (ex: "Ifood Pago" vira "ifoodpago")
  const normalizedName = name.toLowerCase().replace(/\s+/g, '');

  // Tenta achar a marca pelas palavras-chave mapeadas
  const matchedKey = Object.keys(brandMap).find(key => normalizedName.includes(key));
  const brand = matchedKey ? brandMap[matchedKey] : null;

  const sizeClasses = {
    sm: 'w-6 h-6 rounded-md',
    md: 'w-10 h-10 rounded-[12px]',
    lg: 'w-12 h-12 rounded-2xl'
  };

  const iconSize = size === 'md' ? 20 : size === 'sm' ? 14 : 24;

  // Se achou uma marca mapeada, usa a cor e o ícone oficiais
  if (brand) {
    const IconComp = brand.icon;
    return (
      <div
        className={`${sizeClasses[size]} shrink-0 flex items-center justify-center shadow-sm`}
        style={{
          backgroundColor: `${brand.color}15`, // Fundo com 15% de opacidade da cor oficial
          color: brand.color
        }}
      >
        <IconComp size={iconSize} />
      </div>
    );
  }

  // Fallback: Ícone genérico com a cor personalizada pelo usuário (ou cinza padrão)
  return (
    <div
      className={`${sizeClasses[size]} shrink-0 flex items-center justify-center shadow-sm`}
      style={{
        backgroundColor: color ? `${color}15` : '#94a3b815',
        color: color || '#64748b'
      }}
    >
      <Building2 size={iconSize} />
    </div>
  );
}
