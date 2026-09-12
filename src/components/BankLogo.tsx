import { canonicalizeBankName } from '@/lib/accountPresentation'

interface BankLogoProps {
  name: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
}

type AssetMode =
  | 'contain'
  | 'left-mark'

interface BrandAsset {
  src: string
  background: string
  mode: AssetMode
  imageClassName?: string
}

const BRAND_ASSETS: Record<string, BrandAsset> = {
  PagBank: {
    src: '/banks/pagbank.svg',
    background: '#FFFFFF',
    mode: 'left-mark',
    imageClassName: 'h-[84%]',
  },
  PicPay: {
    src: '/banks/picpay.svg',
    background: '#FFFFFF',
    mode: 'left-mark',
    imageClassName: 'h-[78%]',
  },
  'Mercado Pago': {
    src: '/banks/mercado-pago.svg',
    background: '#00AEEF',
    mode: 'contain',
    imageClassName:
      'h-[62%] w-[62%] brightness-0 invert',
  },
  Stone: {
    src: '/banks/stone.svg',
    background: '#00A868',
    mode: 'left-mark',
    imageClassName: 'h-[74%]',
  },
}

const BRAND_COLORS: Record<
  string,
  {
    background: string
    foreground: string
  }
> = {
  Nubank: {
    background: '#820AD1',
    foreground: '#FFFFFF',
  },
  Inter: {
    background: '#FF7A00',
    foreground: '#FFFFFF',
  },
  'Itaú': {
    background: '#EC7000',
    foreground: '#FFFFFF',
  },
  Bradesco: {
    background: '#CC092F',
    foreground: '#FFFFFF',
  },
  Santander: {
    background: '#EC0000',
    foreground: '#FFFFFF',
  },
  Caixa: {
    background: '#005CA9',
    foreground: '#FFFFFF',
  },
  'Banco do Brasil': {
    background: '#FFED00',
    foreground: '#003D7C',
  },
  'C6 Bank': {
    background: '#151515',
    foreground: '#FFFFFF',
  },
  'iFood Pago': {
    background: '#EA1D2C',
    foreground: '#FFFFFF',
  },
  InfinitePay: {
    background: '#111827',
    foreground: '#FFFFFF',
  },
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

  const canonicalName =
    canonicalizeBankName(name)

  const asset =
    BRAND_ASSETS[canonicalName]

  const brandColor =
    BRAND_COLORS[canonicalName]

  const fallbackLabel =
    (canonicalName || name || 'Banco')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part[0]?.toUpperCase()
      )
      .join('') || 'B'

  return (
    <div
      className={`${sizeClasses[size]} relative flex shrink-0 items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/10`}
      style={
        asset
          ? {
              backgroundColor:
                asset.background,
            }
          : {
              backgroundColor:
                brandColor?.background ||
                color ||
                '#E5E7EB',
              color:
                brandColor?.foreground ||
                '#475569',
            }
      }
      title={
        canonicalName ||
        name ||
        'Instituição financeira'
      }
    >
      {asset ? (
        asset.mode === 'left-mark' ? (
          <div className="absolute inset-[7%] overflow-hidden">
            <img
              src={asset.src}
              alt={`${canonicalName} logo`}
              className={`${asset.imageClassName || 'h-full'} w-auto max-w-none object-contain object-left`}
              draggable={false}
            />
          </div>
        ) : (
          <img
            src={asset.src}
            alt={`${canonicalName} logo`}
            className={`${asset.imageClassName || 'h-[70%] w-[70%]'} object-contain`}
            draggable={false}
          />
        )
      ) : (
        <span
          className="select-none text-[10px] font-black tracking-[-0.04em]"
          aria-hidden="true"
        >
          {fallbackLabel}
        </span>
      )}
    </div>
  )
}
