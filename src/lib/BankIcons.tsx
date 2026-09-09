// src/lib/BankIcons.tsx
import React from 'react'

type BrandKind =
  | 'nubank'
  | 'inter'
  | 'itau'
  | 'bradesco'
  | 'santander'
  | 'caixa'
  | 'bb'
  | 'c6'
  | 'picpay'
  | 'pagbank'
  | 'mercadopago'
  | 'stone'
  | 'ifood'
  | 'cloudwalk'
  | 'wallet'
  | 'wordmark'

interface BankData {
  color: string
  foreground?: string
  sigla: string
  kind: BrandKind
}

const BANK_MAP: Record<string, BankData> = {
  nubank: { color: '#820AD1', foreground: '#FFFFFF', sigla: 'nu', kind: 'nubank' },
  nu: { color: '#820AD1', foreground: '#FFFFFF', sigla: 'nu', kind: 'nubank' },

  inter: { color: '#FF7A00', foreground: '#FFFFFF', sigla: 'inter', kind: 'inter' },
  'banco inter': { color: '#FF7A00', foreground: '#FFFFFF', sigla: 'inter', kind: 'inter' },

  itau: { color: '#EC7000', foreground: '#FFFFFF', sigla: 'itaú', kind: 'itau' },
  'itaú': { color: '#EC7000', foreground: '#FFFFFF', sigla: 'itaú', kind: 'itau' },
  'itaú unibanco': { color: '#EC7000', foreground: '#FFFFFF', sigla: 'itaú', kind: 'itau' },

  bradesco: { color: '#CC092F', foreground: '#FFFFFF', sigla: 'bra', kind: 'bradesco' },
  santander: { color: '#EC0000', foreground: '#FFFFFF', sigla: 'san', kind: 'santander' },
  'santander brasil': { color: '#EC0000', foreground: '#FFFFFF', sigla: 'san', kind: 'santander' },

  caixa: { color: '#005CA9', foreground: '#FFFFFF', sigla: 'CEF', kind: 'caixa' },
  'caixa econômica': { color: '#005CA9', foreground: '#FFFFFF', sigla: 'CEF', kind: 'caixa' },
  'caixa economica federal': { color: '#005CA9', foreground: '#FFFFFF', sigla: 'CEF', kind: 'caixa' },
  'caixa econômica federal': { color: '#005CA9', foreground: '#FFFFFF', sigla: 'CEF', kind: 'caixa' },

  'banco do brasil': { color: '#FFED00', foreground: '#003D7C', sigla: 'BB', kind: 'bb' },
  bb: { color: '#FFED00', foreground: '#003D7C', sigla: 'BB', kind: 'bb' },

  'c6 bank': { color: '#151515', foreground: '#FFFFFF', sigla: 'C6', kind: 'c6' },
  c6: { color: '#151515', foreground: '#FFFFFF', sigla: 'C6', kind: 'c6' },

  picpay: { color: '#21C25E', foreground: '#FFFFFF', sigla: 'P', kind: 'picpay' },

  pagbank: { color: '#12B886', foreground: '#FFFFFF', sigla: 'pag', kind: 'pagbank' },
  'pag bank': { color: '#12B886', foreground: '#FFFFFF', sigla: 'pag', kind: 'pagbank' },
  pagseguro: { color: '#12B886', foreground: '#FFFFFF', sigla: 'pag', kind: 'pagbank' },

  'mercado pago': { color: '#00AEEF', foreground: '#FFFFFF', sigla: 'MP', kind: 'mercadopago' },
  mercadopago: { color: '#00AEEF', foreground: '#FFFFFF', sigla: 'MP', kind: 'mercadopago' },

  stone: { color: '#00A868', foreground: '#FFFFFF', sigla: 'stone', kind: 'stone' },

  ifood: { color: '#EA1D2C', foreground: '#FFFFFF', sigla: 'iFood', kind: 'ifood' },
  'ifood pago': { color: '#EA1D2C', foreground: '#FFFFFF', sigla: 'iFood', kind: 'ifood' },

  cloudwalk: { color: '#101827', foreground: '#FFFFFF', sigla: '∞', kind: 'cloudwalk' },
  infinitepay: { color: '#101827', foreground: '#FFFFFF', sigla: '∞', kind: 'cloudwalk' },
  infinitypay: { color: '#101827', foreground: '#FFFFFF', sigla: '∞', kind: 'cloudwalk' },
  infinitpay: { color: '#101827', foreground: '#FFFFFF', sigla: '∞', kind: 'cloudwalk' },

  carteira: { color: '#475569', foreground: '#FFFFFF', sigla: '$', kind: 'wallet' },
  dinheiro: { color: '#475569', foreground: '#FFFFFF', sigla: '$', kind: 'wallet' },
  'dinheiro físico': { color: '#475569', foreground: '#FFFFFF', sigla: '$', kind: 'wallet' },

  safra: { color: '#0B1836', foreground: '#FFFFFF', sigla: 'SAF', kind: 'wordmark' },
  original: { color: '#00A651', foreground: '#FFFFFF', sigla: 'ORI', kind: 'wordmark' },
  next: { color: '#101010', foreground: '#00FF5F', sigla: 'next', kind: 'wordmark' },
  'will bank': { color: '#F7DF1E', foreground: '#121212', sigla: 'will', kind: 'wordmark' },
  agibank: { color: '#003D3B', foreground: '#FFFFFF', sigla: 'agi', kind: 'wordmark' },
  'digio bank': { color: '#4756FF', foreground: '#FFFFFF', sigla: 'digio', kind: 'wordmark' },
  digio: { color: '#4756FF', foreground: '#FFFFFF', sigla: 'digio', kind: 'wordmark' },
  btg: { color: '#002B49', foreground: '#FFFFFF', sigla: 'BTG', kind: 'wordmark' },
  'btg pactual': { color: '#002B49', foreground: '#FFFFFF', sigla: 'BTG', kind: 'wordmark' },
  sicoob: { color: '#003641', foreground: '#FFFFFF', sigla: 'SCO', kind: 'wordmark' },
  sicredi: { color: '#32A041', foreground: '#FFFFFF', sigla: 'SIC', kind: 'wordmark' },
  xp: { color: '#111111', foreground: '#FFFFFF', sigla: 'XP', kind: 'wordmark' },
  paypal: { color: '#003087', foreground: '#FFFFFF', sigla: 'Pay', kind: 'wordmark' },

  neon: { color: '#00E4DE', foreground: '#062E35', sigla: 'neon', kind: 'wordmark' },
  bs2: { color: '#0B2A5B', foreground: '#FFFFFF', sigla: 'BS2', kind: 'wordmark' },
  superdigital: { color: '#101010', foreground: '#FFFFFF', sigla: 'SD', kind: 'wordmark' },
  creditas: { color: '#00BFA5', foreground: '#FFFFFF', sigla: 'CRE', kind: 'wordmark' },
  '99pay': { color: '#FFD000', foreground: '#111111', sigla: '99', kind: 'wordmark' },
  iti: { color: '#FF6F00', foreground: '#FFFFFF', sigla: 'iti', kind: 'wordmark' },
  'iti itau': { color: '#FF6F00', foreground: '#FFFFFF', sigla: 'iti', kind: 'wordmark' },
  'iti itaú': { color: '#FF6F00', foreground: '#FFFFFF', sigla: 'iti', kind: 'wordmark' },
  cora: { color: '#E83E8C', foreground: '#FFFFFF', sigla: 'cora', kind: 'wordmark' },
  ton: { color: '#00D47B', foreground: '#07382B', sigla: 'ton', kind: 'wordmark' },
  z1: { color: '#6E42D5', foreground: '#FFFFFF', sigla: 'Z1', kind: 'wordmark' },
  jeitto: { color: '#00C853', foreground: '#FFFFFF', sigla: 'J', kind: 'wordmark' },

  pan: { color: '#00A3E0', foreground: '#FFFFFF', sigla: 'PAN', kind: 'wordmark' },
  'banco pan': { color: '#00A3E0', foreground: '#FFFFFF', sigla: 'PAN', kind: 'wordmark' },
  banrisul: { color: '#004B87', foreground: '#FFFFFF', sigla: 'BRS', kind: 'wordmark' },
  bmg: { color: '#FF6900', foreground: '#FFFFFF', sigla: 'BMG', kind: 'wordmark' },
  daycoval: { color: '#0B3A82', foreground: '#FFFFFF', sigla: 'DAY', kind: 'wordmark' },
  pine: { color: '#00533C', foreground: '#FFFFFF', sigla: 'PINE', kind: 'wordmark' },
  'abc brasil': { color: '#0B4EA2', foreground: '#FFFFFF', sigla: 'ABC', kind: 'wordmark' },
  fibra: { color: '#E86A13', foreground: '#FFFFFF', sigla: 'FIB', kind: 'wordmark' },
  brb: { color: '#005AA9', foreground: '#FFFFFF', sigla: 'BRB', kind: 'wordmark' },
  'banco de brasilia': { color: '#005AA9', foreground: '#FFFFFF', sigla: 'BRB', kind: 'wordmark' },
  'banco de brasília': { color: '#005AA9', foreground: '#FFFFFF', sigla: 'BRB', kind: 'wordmark' },
  banese: { color: '#F58220', foreground: '#FFFFFF', sigla: 'BSE', kind: 'wordmark' },
  basa: { color: '#007A4D', foreground: '#FFFFFF', sigla: 'BASA', kind: 'wordmark' },
  'banco da amazonia': { color: '#007A4D', foreground: '#FFFFFF', sigla: 'BASA', kind: 'wordmark' },
  'banco da amazônia': { color: '#007A4D', foreground: '#FFFFFF', sigla: 'BASA', kind: 'wordmark' },
  bnb: { color: '#00569C', foreground: '#FFFFFF', sigla: 'BNB', kind: 'wordmark' },
  'banco do nordeste': { color: '#00569C', foreground: '#FFFFFF', sigla: 'BNB', kind: 'wordmark' },
  bdmg: { color: '#005CA9', foreground: '#FFFFFF', sigla: 'BDMG', kind: 'wordmark' },

  unicred: { color: '#185A3B', foreground: '#FFFFFF', sigla: 'UNI', kind: 'wordmark' },
  cresol: { color: '#F28C00', foreground: '#FFFFFF', sigla: 'CRE', kind: 'wordmark' },
  ailos: { color: '#005CAB', foreground: '#FFFFFF', sigla: 'AIL', kind: 'wordmark' },
  uniprime: { color: '#1C5D3A', foreground: '#FFFFFF', sigla: 'UP', kind: 'wordmark' },

  rico: { color: '#FF5C00', foreground: '#FFFFFF', sigla: 'RICO', kind: 'wordmark' },
  clear: { color: '#111111', foreground: '#FFFFFF', sigla: 'CLR', kind: 'wordmark' },
  modal: { color: '#003DA5', foreground: '#FFFFFF', sigla: 'MOD', kind: 'wordmark' },
  'modal mais': { color: '#003DA5', foreground: '#FFFFFF', sigla: 'MOD', kind: 'wordmark' },
  genial: { color: '#6CB33F', foreground: '#FFFFFF', sigla: 'GEN', kind: 'wordmark' },
  'genial investimentos': { color: '#6CB33F', foreground: '#FFFFFF', sigla: 'GEN', kind: 'wordmark' },
  avenue: { color: '#111111', foreground: '#FFFFFF', sigla: 'AVE', kind: 'wordmark' },
  warren: { color: '#E84D8A', foreground: '#FFFFFF', sigla: 'WAR', kind: 'wordmark' },
  toro: { color: '#00A86B', foreground: '#FFFFFF', sigla: 'TORO', kind: 'wordmark' },
  'toro investimentos': { color: '#00A86B', foreground: '#FFFFFF', sigla: 'TORO', kind: 'wordmark' },

  mercantil: { color: '#0B3A6D', foreground: '#FFFFFF', sigla: 'MB', kind: 'wordmark' },
  'banco mercantil': { color: '#0B3A6D', foreground: '#FFFFFF', sigla: 'MB', kind: 'wordmark' },
  'mercantil do brasil': { color: '#0B3A6D', foreground: '#FFFFFF', sigla: 'MB', kind: 'wordmark' },
  bari: { color: '#1B365D', foreground: '#FFFFFF', sigla: 'BARI', kind: 'wordmark' },
  crefisa: { color: '#0A4A8A', foreground: '#FFFFFF', sigla: 'CRE', kind: 'wordmark' },
  master: { color: '#F58220', foreground: '#FFFFFF', sigla: 'MAS', kind: 'wordmark' },
  omni: { color: '#173E77', foreground: '#FFFFFF', sigla: 'OMNI', kind: 'wordmark' },
  topazio: { color: '#0078BE', foreground: '#FFFFFF', sigla: 'TOP', kind: 'wordmark' },
  'topázio': { color: '#0078BE', foreground: '#FFFFFF', sigla: 'TOP', kind: 'wordmark' },
  tribanco: { color: '#006BB6', foreground: '#FFFFFF', sigla: 'TRI', kind: 'wordmark' },
  carrefour: { color: '#00529B', foreground: '#FFFFFF', sigla: 'CAR', kind: 'wordmark' },
  'carrefour banco': { color: '#00529B', foreground: '#FFFFFF', sigla: 'CAR', kind: 'wordmark' },
  cetelem: { color: '#54B948', foreground: '#FFFFFF', sigla: 'CET', kind: 'wordmark' },
  'porto seguro': { color: '#00A3E0', foreground: '#FFFFFF', sigla: 'PORTO', kind: 'wordmark' },
  portoseg: { color: '#00A3E0', foreground: '#FFFFFF', sigla: 'PORTO', kind: 'wordmark' },
  sofisa: { color: '#003DA5', foreground: '#FFFFFF', sigla: 'SOF', kind: 'wordmark' },
  'sofisa direto': { color: '#003DA5', foreground: '#FFFFFF', sigla: 'SOF', kind: 'wordmark' },
  'banco original': { color: '#00A651', foreground: '#FFFFFF', sigla: 'ORI', kind: 'wordmark' },
}

function normalizeBankName(value?: string | null) {
  return (value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function findBank(bankName?: string | null) {
  const normalized = normalizeBankName(bankName)

  if (!normalized) return null

  if (BANK_MAP[normalized]) {
    return BANK_MAP[normalized]
  }

  const matchedKey = Object.keys(BANK_MAP)
    .sort((a, b) => b.length - a.length)
    .find((key) => normalized.includes(key))

  return matchedKey
    ? BANK_MAP[matchedKey]
    : null
}

function renderMark(bank: BankData) {
  const foreground = bank.foreground || '#FFFFFF'

  switch (bank.kind) {
    case 'nubank':
      return (
        <g fill="none" stroke={foreground} strokeWidth="2.8" strokeLinecap="round">
          <path d="M8 25V16.5c0-3.7 2.3-6.5 5.7-6.5 3.6 0 5.8 2.8 5.8 6.5V25" />
          <path d="M20.5 15v8.5c0 3.7 2.3 6.5 5.8 6.5 3.4 0 5.7-2.8 5.7-6.5V15" />
        </g>
      )

    case 'inter':
      return (
        <text x="20" y="21.5" textAnchor="middle" dominantBaseline="central" fill={foreground} fontSize="10.5" fontWeight="800" fontFamily="Arial, sans-serif">
          inter
        </text>
      )

    case 'itau':
      return (
        <>
          <rect x="7" y="8" width="26" height="24" rx="7" fill="#073B8C" />
          <text x="20" y="21" textAnchor="middle" dominantBaseline="central" fill="#F8D130" fontSize="10" fontWeight="900" fontFamily="Arial, sans-serif">
            itaú
          </text>
        </>
      )

    case 'bradesco':
      return (
        <g fill="none" stroke={foreground} strokeWidth="2.4" strokeLinecap="round">
          <path d="M10 24c4.5-5.5 8-8.2 10-8.2 2 0 5.5 2.7 10 8.2" />
          <path d="M14 28c2.6-3 4.6-4.5 6-4.5s3.4 1.5 6 4.5" />
          <path d="M20 10v6" />
        </g>
      )

    case 'santander':
      return (
        <path
          d="M20 7c1.2 4.7 5 6.4 5 10.1 0 2.1-1 3.6-2.3 4.7.2-3.6-2.3-5.2-2.7-8.1-1.8 3.5-5.6 5.2-5.6 9.2 0 3.7 2.7 6.1 5.9 6.1 4.4 0 7.3-3.2 7.3-7.2C27.6 15.9 22.2 13.7 20 7Z"
          fill={foreground}
        />
      )

    case 'caixa':
      return (
        <g fill="none" strokeWidth="4.2" strokeLinecap="round">
          <path d="M11 10l18 20" stroke="#FFFFFF" />
          <path d="M29 10L11 30" stroke="#F6A800" />
        </g>
      )

    case 'bb':
      return (
        <g fill="none" stroke={foreground} strokeWidth="2.6" strokeLinejoin="round">
          <path d="M10 14h12l8 6-8 6H10l8-6-8-6Z" />
          <path d="M30 14H18l-8 6 8 6h12l-8-6 8-6Z" />
        </g>
      )

    case 'c6':
      return (
        <text x="20" y="21" textAnchor="middle" dominantBaseline="central" fill={foreground} fontSize="15" fontWeight="900" fontFamily="Arial, sans-serif">
          C6
        </text>
      )

    case 'picpay':
      return (
        <g fill="none" stroke={foreground} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="11" y="9" width="18" height="22" rx="7" />
          <path d="M16 15h6.5a4 4 0 0 1 0 8H16V15Z" />
        </g>
      )

    case 'pagbank':
      return (
        <>
          <circle cx="20" cy="20" r="11" fill="none" stroke={foreground} strokeWidth="2.7" />
          <path d="M13 20h14M20 13v14" stroke={foreground} strokeWidth="2.3" strokeLinecap="round" />
        </>
      )

    case 'mercadopago':
      return (
        <g fill="none" stroke={foreground} strokeWidth="2.2" strokeLinecap="round">
          <path d="M9 18c3-3.2 6-4.8 9-4.8 2.2 0 3.6 1.2 5.1 2.3 1.5 1.2 3.1 2.2 6 2.5" />
          <path d="M11 22c2.2 2.8 5.2 4.2 9 4.2 3.7 0 6.8-1.4 9-4.2" />
          <path d="M16 19l4 3 4-3" />
        </g>
      )

    case 'stone':
      return (
        <>
          <path d="M10 14h20v12H10z" fill="none" stroke={foreground} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M14 18h12M14 22h8" stroke={foreground} strokeWidth="2.2" strokeLinecap="round" />
        </>
      )

    case 'ifood':
      return (
        <text x="20" y="21" textAnchor="middle" dominantBaseline="central" fill={foreground} fontSize="10.8" fontWeight="900" fontFamily="Arial, sans-serif">
          iFood
        </text>
      )

    case 'cloudwalk':
      return (
        <text x="20" y="21" textAnchor="middle" dominantBaseline="central" fill={foreground} fontSize="25" fontWeight="500" fontFamily="Arial, sans-serif">
          ∞
        </text>
      )

    case 'wallet':
      return (
        <g fill="none" stroke={foreground} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="12" width="22" height="17" rx="4" />
          <path d="M24 17h7v7h-7a3.5 3.5 0 0 1 0-7Z" />
        </g>
      )

    default:
      return (
        <text x="20" y="21" textAnchor="middle" dominantBaseline="central" fill={foreground} fontSize={bank.sigla.length > 4 ? '8.5' : '11.5'} fontWeight="800" fontFamily="Arial, sans-serif">
          {bank.sigla}
        </text>
      )
  }
}

export function getBankIcon(
  bankName: string,
  fallbackColor?: string | null
): React.ReactElement {
  const bank = findBank(bankName)

  const fallbackName =
    (bankName || 'BK')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase() || 'BK'

  const resolved: BankData =
    bank || {
      color: fallbackColor || '#64748B',
      foreground: '#FFFFFF',
      sigla: fallbackName,
      kind: 'wordmark',
    }

  return (
    <svg
      viewBox="0 0 40 40"
      width="100%"
      height="100%"
      role="img"
      aria-label={bankName || 'Instituição financeira'}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" rx="11" fill={resolved.color} />
      {renderMark(resolved)}
    </svg>
  )
}

export function getBankColor(
  bankName: string
): string | null {
  return findBank(bankName)?.color || null
}

export function hasBrandedBankIcon(
  bankName: string
) {
  return Boolean(findBank(bankName))
}

export const BANK_LIST = Array.from(
  new Map(
    Object.entries(BANK_MAP).map(
      ([key, value]) => [
        `${value.kind}:${value.color}`,
        {
          name:
            key.charAt(0).toUpperCase() +
            key.slice(1),
          key,
          color: value.color,
          sigla: value.sigla,
        },
      ]
    )
  ).values()
)
