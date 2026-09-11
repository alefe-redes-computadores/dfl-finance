// src/components/BankLogo.tsx
import { getBankIcon } from '@/lib/BankIcons'
import { canonicalizeBankName } from '@/lib/accountPresentation'

interface BankLogoProps {
  name: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
}

type AssetMode = 'contain' | 'left-mark'

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
    imageClassName: 'h-[62%] w-[62%] brightness-0 invert',
  },
  Stone: {
    src: '/banks/stone.svg',
    background: '#00A868',
    mode: 'left-mark',
    imageClassName: 'h-[74%]',
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

  const canonicalName = canonicalizeBankName(name)
  const asset = BRAND_ASSETS[canonicalName]

  return (
    <div
      className={`${sizeClasses[size]} relative flex shrink-0 items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/10`}
      style={asset ? { backgroundColor: asset.background } : undefined}
      title={canonicalName || name || 'Instituição financeira'}
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
        getBankIcon(
          name,
          color
        )
      )}
    </div>
  )
}
