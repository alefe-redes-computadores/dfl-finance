// lib/BankIcons.tsx
// SVGs inline padronizados - 40x40, rx=8, contraste automático
import React from 'react'

// Cores que precisam de texto escuro (cores claras)
const LIGHT_COLORS = ['#F9D308', '#00FF5F', '#00E4DE', '#FCFC30', '#00FF00']

interface BankData {
  color: string
  sigla: string
}

const BANK_MAP: Record<string, BankData> = {
  'nubank': { color: '#8A05BE', sigla: 'NU' },
  'nu': { color: '#8A05BE', sigla: 'NU' },
  'c6 bank': { color: '#242424', sigla: 'C6' },
  'c6': { color: '#242424', sigla: 'C6' },
  'banco inter': { color: '#FF7A00', sigla: 'IN' },
  'inter': { color: '#FF7A00', sigla: 'IN' },
  'picpay': { color: '#11C76F', sigla: 'PIC' },
  'pagbank': { color: '#13B821', sigla: 'PAG' },
  'pagseguro': { color: '#13B821', sigla: 'PAG' },
  'stone': { color: '#00A868', sigla: 'STN' },
  'infinitpay': { color: '#1A1A1A', sigla: 'INF' },
  'infinit pay': { color: '#1A1A1A', sigla: 'INF' },
  'cora': { color: '#E63888', sigla: 'COR' },
  'ifood pago': { color: '#EA1D2C', sigla: 'IFO' },
  'ifood': { color: '#EA1D2C', sigla: 'IFO' },
  'agibank': { color: '#033333', sigla: 'AGI' },
  'mercantil': { color: '#003366', sigla: 'MER' },
  'carteira': { color: '#475569', sigla: '$$' },
  'dinheiro': { color: '#475569', sigla: '$$' },
  'dinheiro físico': { color: '#475569', sigla: '$$' },
  'itaú': { color: '#EC7000', sigla: 'IT' },
  'itau': { color: '#EC7000', sigla: 'IT' },
  'iti': { color: '#EC7000', sigla: 'IT' },
  'bradesco': { color: '#CC092F', sigla: 'BRA' },
  'caixa': { color: '#005CA9', sigla: 'CEF' },
  'caixa econômica': { color: '#005CA9', sigla: 'CEF' },
  'banco do brasil': { color: '#F9D308', sigla: 'BB' },
  'bb': { color: '#F9D308', sigla: 'BB' },
  'santander': { color: '#EC0000', sigla: 'SAN' },
  'sicredi': { color: '#32A041', sigla: 'SIC' },
  'sicoob': { color: '#003641', sigla: 'SCO' },
  'btg': { color: '#002B49', sigla: 'BTG' },
  'btg pactual': { color: '#002B49', sigla: 'BTG' },
  'pan': { color: '#00A3E0', sigla: 'PAN' },
  'banco pan': { color: '#00A3E0', sigla: 'PAN' },
  'safra': { color: '#000033', sigla: 'SAF' },
  'banco safra': { color: '#000033', sigla: 'SAF' },
  'xp': { color: '#000000', sigla: 'XP' },
  'xp investimentos': { color: '#000000', sigla: 'XP' },
  'rico': { color: '#FF5C00', sigla: 'RC' },
  'clear': { color: '#000000', sigla: 'CL' },
  'neon': { color: '#00E4DE', sigla: 'NE' },
  'next': { color: '#00FF5F', sigla: 'NX' },
  'mercado pago': { color: '#009EE3', sigla: 'MP' },
  'banco original': { color: '#00D766', sigla: 'ORI' },
  'original': { color: '#00D766', sigla: 'ORI' },
  'will bank': { color: '#000000', sigla: 'WB' },
  'bs2': { color: '#0033A0', sigla: 'BS' },
  'brb': { color: '#003DA5', sigla: 'BRB' },
  'ton': { color: '#00D47B', sigla: 'TN' },
}

export function getBankIcon(bankName: string): React.ReactElement {
  const normalized = bankName?.trim().toLowerCase() || ''
  const bank = BANK_MAP[normalized]
  
  const bgColor = bank?.color || '#94A3B8'
  const sigla = bank?.sigla || (bankName ? bankName.substring(0, 2).toUpperCase() : 'BK')
  const isLight = LIGHT_COLORS.includes(bgColor)
  const textColor = isLight ? '#000000' : '#FFFFFF'
  
  // Ajusta tamanho da fonte baseado no número de caracteres
  const fontSize = sigla.length <= 2 ? 16 : sigla.length === 3 ? 12 : 10

  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill={bgColor} />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fill={textColor}
        fontSize={fontSize}
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        {sigla}
      </text>
    </svg>
  )
}

export function getBankColor(bankName: string): string | null {
  if (!bankName) return null
  const normalized = bankName.trim().toLowerCase()
  return BANK_MAP[normalized]?.color || null
}

export const BANK_LIST = Object.keys(BANK_MAP).map(key => ({
  name: key.charAt(0).toUpperCase() + key.slice(1),
  key,
  color: BANK_MAP[key].color,
  sigla: BANK_MAP[key].sigla,
}))