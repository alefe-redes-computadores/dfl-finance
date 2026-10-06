import {
  getBankIcon,
  hasBrandedBankIcon,
} from '@/lib/BankIcons'
import {
  canonicalizeBankName,
  findBankIdentity,
} from '@/lib/bankRegistry'
import {
  BANK_LOGO_CONTAINER_CLASS,
  BANK_LOGO_FALLBACK_CLASS,
  BANK_LOGO_SIZE_CLASSES,
  getBankOpticalProfile,
} from '@/lib/bankIdentityPresentation'

interface BankLogoProps {
  name: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
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

  const identity =
    findBankIdentity(canonicalName)

  const asset =
    identity?.asset

  const optical =
    getBankOpticalProfile(
      identity?.id,
    )

  /*
   * Os quatro assets abaixo são arquivos SVG
   * locais reais do projeto.
   */
  if (asset) {
    return (
      <div
        className={`${BANK_LOGO_SIZE_CLASSES[size]} ${BANK_LOGO_CONTAINER_CLASS} bg-white`}
        style={{
          backgroundColor:
            asset.background,
        }}
        title={canonicalName}
      >
        <img
          src={asset.src}
          alt={`${canonicalName} logo`}
          className={asset.imageClassName}
          style={{
            transform: `translate(${optical.x ?? 0}px, ${optical.y ?? 0}px) scale(${optical.scale})`,
            transformOrigin: 'center center',
          }}
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
        className={`${BANK_LOGO_SIZE_CLASSES[size]} ${BANK_LOGO_CONTAINER_CLASS}`}
        title={canonicalName}
      >
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            transform: `translate(${optical.x ?? 0}px, ${optical.y ?? 0}px) scale(${optical.scale})`,
            transformOrigin:
              'center center',
          }}
          aria-hidden="true"
        >
          {getBankIcon(
            canonicalName,
            color
          )}
        </div>
      </div>
    )
  }

  /*
   * Somente instituição realmente desconhecida
   * cai no fallback neutro.
   */
  return (
    <div
      className={`${BANK_LOGO_SIZE_CLASSES[size]} ${BANK_LOGO_CONTAINER_CLASS} ${BANK_LOGO_FALLBACK_CLASS}`}
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
