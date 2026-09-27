// src/lib/BankIcons.tsx
import React from 'react'
import {
  BANK_REGISTRY,
  findBankIdentity,
} from '@/lib/bankRegistry'

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

function findBank(bankName?: string | null): BankData | null {
  const bank = findBankIdentity(bankName)
  if (!bank) return null

  return {
    color: bank.color,
    foreground: bank.foreground,
    sigla: bank.sigla,
    kind: (bank.kind || 'wordmark') as BrandKind,
  }
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


export const BANK_LIST = BANK_REGISTRY.map((bank) => ({
  name: bank.name,
  key: bank.id,
  color: bank.color,
  sigla: bank.sigla,
}))
