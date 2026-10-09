export type BankLogoSize =
  | 'sm'
  | 'md'
  | 'lg'

export interface BankOpticalProfile {
  scale: number
  x?: number
  y?: number
  radius?: string
}

/**
 * Ajustes exclusivamente ópticos.
 *
 * Não alteram identidade, nome, cor ou asset.
 * Servem para compensar diferenças visuais entre
 * símbolos/wordmarks dentro do mesmo container.
 */
const OPTICAL_PROFILES:
  Readonly<
    Record<
      string,
      BankOpticalProfile
    >
  > = {
    nubank: {
      scale: 0.88,
    },
    inter: {
      scale: 0.9,
    },
    itau: {
      scale: 0.9,
    },
    bradesco: {
      scale: 0.88,
    },
    santander: {
      scale: 0.88,
    },
    bb: {
      scale: 0.9,
    },
    caixa: {
      scale: 0.9,
    },
    c6: {
      scale: 0.88,
    },
    picpay: {
      scale: 0.92,
    },
    pagbank: {
      // V83: recupera presença óptica sem encostar nas bordas.
      // O perfil continua centralizado e vale para todo o app.
      scale: 0.8,
    },
    'mercado-pago': {
      scale: 0.9,
    },
    stone: {
      // V83: wordmark ganha presença semelhante aos demais bancos
      // sem abandonar o mesmo container compartilhado.
      scale: 0.8,
    },
    sicoob: {
      scale: 0.88,
    },
    sicredi: {
      scale: 0.88,
    },
    btg: {
      scale: 0.86,
    },
    xp: {
      scale: 0.86,
    },
  }

const DEFAULT_PROFILE:
  BankOpticalProfile = {
    scale: 0.9,
  }

export function getBankOpticalProfile(
  bankId?: string | null,
): BankOpticalProfile {
  if (!bankId) {
    return DEFAULT_PROFILE
  }

  return (
    OPTICAL_PROFILES[bankId] ??
    DEFAULT_PROFILE
  )
}

export const BANK_LOGO_SIZE_CLASSES:
  Record<BankLogoSize, string> = {
    sm: 'h-7 w-7 rounded-[9px]',
    md: 'h-10 w-10 rounded-[13px]',
    lg: 'h-12 w-12 rounded-[15px]',
  }

export const BANK_LOGO_CONTAINER_CLASS =
  'relative flex shrink-0 items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/10'

export const BANK_LOGO_FALLBACK_CLASS =
  'bg-slate-100 dark:bg-slate-800'
