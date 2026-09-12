import {
  getBankIcon,
  hasBrandedBankIcon,
} from '@/lib/BankIcons'
import {
  canonicalizeBankName,
} from '@/lib/accountPresentation'

interface BankLogoProps {
  name: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
}

interface BrandAsset {
  src: string
  background: string
  imageClassName: string
}

const BRAND_ASSETS: Record<
  string,
  BrandAsset
> = {
  PagBank: {
    src: '/banks/pagbank.svg',
    background: '#FFFFFF',
    imageClassName:
      'h-[72%] w-[72%] object-cover object-left',
  },

  PicPay: {
    src: '/banks/picpay.svg',
    background: '#FFFFFF',
    imageClassName:
      'h-[68%] w-[72%] object-cover object-left',
  },

  'Mercado Pago': {
    src: '/banks/mercado-pago.svg',
    background: '#00AEEF',
    imageClassName:
      'h-[58%] w-[58%] object-contain brightness-0 invert',
  },

  Stone: {
    src: '/banks/stone.svg',
    background: '#FFFFFF',
    imageClassName:
      'h-[64%] w-[78%] object-cover object-left',
  },
}

function getFallbackLabel(
  name: string
) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return 'B'
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase()
  }

  return parts
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join('')
}

export default function BankLogo({
  name,
  color,
  size = 'md',
}: BankLogoProps) {
  const canonicalName =
    canonicalizeBankName(name)

  const asset =
    BRAND_ASSETS[canonicalName]

  const sizeClasses = {
    sm: 'h-7 w-7 rounded-[9px]',
    md: 'h-10 w-10 rounded-[13px]',
    lg: 'h-12 w-12 rounded-[15px]',
  }

  /*
   * Os quatro assets abaixo são arquivos SVG
   * locais reais do projeto.
   */
  if (asset) {
    return (
      <div
        className={`${sizeClasses[size]} relative flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-sm ring-1 ring-black/5 dark:ring-white/10`}
        style={{
          backgroundColor:
            asset.background,
        }}
        title={canonicalName}
      >
        <img
          src={asset.src}
          alt={`${canonicalName} logo`}
          className={
            asset.imageClassName
          }
          draggable={false}
        />
      </div>
    )
  }

  /*
   * Para instituições para as quais o projeto
   * já possui uma identidade específica no
   * BankIcons, preservamos essa representação.
   *
   * Isso recupera, entre outros:
   * - iFood Pago
   * - InfinitePay
   * - Carteira
   * - Nubank
   * - Inter
   * - Itaú
   * - Bradesco
   * - Santander
   * - BB
   * - Caixa
   * - C6
   */
  if (
    hasBrandedBankIcon(canonicalName)
  ) {
    return (
      <div
        className={`${sizeClasses[size]} relative flex shrink-0 items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/10`}
        title={canonicalName}
      >
        {getBankIcon(
          canonicalName,
          color
        )}
      </div>
    )
  }

  /*
   * Somente instituição realmente desconhecida
   * cai no fallback neutro.
   */
  return (
    <div
      className={`${sizeClasses[size]} relative flex shrink-0 items-center justify-center overflow-hidden bg-slate-100 shadow-sm ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10`}
      title={
        canonicalName ||
        name ||
        'Instituição financeira'
      }
    >
      <span
        className="select-none text-[9px] font-black uppercase tracking-[-0.03em] text-slate-600 dark:text-slate-300"
        aria-hidden="true"
      >
        {getFallbackLabel(
          canonicalName || name
        )}
      </span>
    </div>
  )
}
