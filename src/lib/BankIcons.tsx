// lib/BankIcons.tsx
// SVGs inline padronizados - 40x40, rx=8, contraste automático
// 100+ bancos brasileiros mapeados
import React from 'react'

// Cores que precisam de texto escuro (cores claras)
const LIGHT_COLORS = ['#F9D308', '#00FF5F', '#00E4DE', '#FCFC30', '#00FF00', '#FFD700', '#FFF200', '#ADFF2F', '#7FFF00', '#00FA9A']

interface BankData {
  color: string
  sigla: string
}

const BANK_MAP: Record<string, BankData> = {
  // ==========================================
  // BANCOS DIGITAIS / FINTECHS
  // ==========================================
  'nubank': { color: '#8A05BE', sigla: 'NU' },
  'nu': { color: '#8A05BE', sigla: 'NU' },
  'c6 bank': { color: '#242424', sigla: 'C6' },
  'c6': { color: '#242424', sigla: 'C6' },
  'inter': { color: '#FF7A00', sigla: 'IN' },
  'banco inter': { color: '#FF7A00', sigla: 'IN' },
  'picpay': { color: '#11C76F', sigla: 'PIC' },
  'pagbank': { color: '#13B821', sigla: 'PAG' },
  'pagseguro': { color: '#13B821', sigla: 'PAG' },
  'mercado pago': { color: '#009EE3', sigla: 'MP' },
  'stone': { color: '#00A868', sigla: 'STN' },
  'infinitpay': { color: '#1A1A1A', sigla: 'INF' },
  'infinit pay': { color: '#1A1A1A', sigla: 'INF' },
  'cora': { color: '#E63888', sigla: 'COR' },
  'ifood pago': { color: '#EA1D2C', sigla: 'IFO' },
  'ifood': { color: '#EA1D2C', sigla: 'IFO' },
  'will bank': { color: '#000000', sigla: 'WB' },
  'will': { color: '#000000', sigla: 'WB' },
  'next': { color: '#00FF5F', sigla: 'NX' },
  'neon': { color: '#00E4DE', sigla: 'NE' },
  'bs2': { color: '#0033A0', sigla: 'BS' },
  'original': { color: '#00D766', sigla: 'ORI' },
  'banco original': { color: '#00D766', sigla: 'ORI' },
  'digio': { color: '#FF5722', sigla: 'DG' },
  'digio bank': { color: '#FF5722', sigla: 'DG' },
  'sofisa': { color: '#003DA5', sigla: 'SOF' },
  'sofisa direto': { color: '#003DA5', sigla: 'SOF' },
  'bmw bank': { color: '#1C69D4', sigla: 'BMW' },
  'superdigital': { color: '#000000', sigla: 'SD' },
  'creditas': { color: '#00D4AA', sigla: 'CRE' },
  'portocred': { color: '#00A3E0', sigla: 'POR' },
  'z1': { color: '#6E42D5', sigla: 'Z1' },
  '99pay': { color: '#FFCC00', sigla: '99' },
  'mercado bitcoin': { color: '#F7931A', sigla: 'MB' },
  'bip': { color: '#00C853', sigla: 'BIP' },
  'iti': { color: '#EC7000', sigla: 'IT' },
  'iti itaú': { color: '#EC7000', sigla: 'IT' },

  // ==========================================
  // BANCOS TRADICIONAIS (BANCÃO)
  // ==========================================
  'itaú': { color: '#EC7000', sigla: 'IT' },
  'itau': { color: '#EC7000', sigla: 'IT' },
  'bradesco': { color: '#CC092F', sigla: 'BRA' },
  'santander': { color: '#EC0000', sigla: 'SAN' },
  'caixa': { color: '#005CA9', sigla: 'CEF' },
  'caixa econômica': { color: '#005CA9', sigla: 'CEF' },
  'caixa federal': { color: '#005CA9', sigla: 'CEF' },
  'banco do brasil': { color: '#F9D308', sigla: 'BB' },
  'bb': { color: '#F9D308', sigla: 'BB' },
  'safra': { color: '#000033', sigla: 'SAF' },
  'banco safra': { color: '#000033', sigla: 'SAF' },
  'btg': { color: '#002B49', sigla: 'BTG' },
  'btg pactual': { color: '#002B49', sigla: 'BTG' },
  'pan': { color: '#00A3E0', sigla: 'PAN' },
  'banco pan': { color: '#00A3E0', sigla: 'PAN' },
  'banrisul': { color: '#003DA5', sigla: 'BRS' },
  'bmg': { color: '#FF6600', sigla: 'BMG' },
  'daycoval': { color: '#003DA5', sigla: 'DAY' },
  'pine': { color: '#005030', sigla: 'PINE' },
  'abc brasil': { color: '#003DA5', sigla: 'ABC' },
  'fibra': { color: '#FF6600', sigla: 'FIB' },
  'industrial': { color: '#003DA5', sigla: 'IND' },
  'volkswagen': { color: '#003DA5', sigla: 'VW' },
  'renner': { color: '#E31837', sigla: 'REN' },
  'cedula': { color: '#003399', sigla: 'CED' },

  // ==========================================
  // COOPERATIVAS
  // ==========================================
  'sicredi': { color: '#32A041', sigla: 'SIC' },
  'sicoob': { color: '#003641', sigla: 'SCO' },
  'unicred': { color: '#003DA5', sigla: 'UNI' },
  'cresol': { color: '#003DA5', sigla: 'CRE' },
  'siccob': { color: '#008542', sigla: 'SCO' },
  'uniprime': { color: '#003DA5', sigla: 'UPR' },
  'credisis': { color: '#003DA5', sigla: 'CSIS' },
  'ailos': { color: '#003DA5', sigla: 'AIL' },

  // ==========================================
  // BANCOS REGIONAIS / ESTADUAIS
  // ==========================================
  'brb': { color: '#003DA5', sigla: 'BRB' },
  'banco de brasília': { color: '#003DA5', sigla: 'BRB' },
  'banese': { color: '#FF6600', sigla: 'BSE' },
  'bandes': { color: '#003DA5', sigla: 'BDS' },
  'basa': { color: '#003DA5', sigla: 'BSA' },
  'banco da amazônia': { color: '#003DA5', sigla: 'BDA' },
  'bneb': { color: '#003DA5', sigla: 'BNB' },
  'banco do nordeste': { color: '#003DA5', sigla: 'BNB' },
  'badesul': { color: '#003DA5', sigla: 'BDS' },
  'bdmg': { color: '#003DA5', sigla: 'BDM' },
  'desenbahia': { color: '#003DA5', sigla: 'DES' },
  'agefaz': { color: '#003DA5', sigla: 'AGE' },

  // ==========================================
  // BANCOS DE INVESTIMENTO / CORRETORAS
  // ==========================================
  'xp': { color: '#000000', sigla: 'XP' },
  'xp investimentos': { color: '#000000', sigla: 'XP' },
  'rico': { color: '#FF5C00', sigla: 'RC' },
  'clear': { color: '#000000', sigla: 'CL' },
  'modal mais': { color: '#003DA5', sigla: 'MOD' },
  'modal': { color: '#003DA5', sigla: 'MOD' },
  'necton': { color: '#003DA5', sigla: 'NEC' },
  'genial': { color: '#6C3', sigla: 'GEN' },
  'genial investimentos': { color: '#6C3', sigla: 'GEN' },
  'avenue': { color: '#000000', sigla: 'AVE' },
  'inter invest': { color: '#FF7A00', sigla: 'IN' },
  'warren': { color: '#E84D8A', sigla: 'WAR' },
  'toro': { color: '#00C853', sigla: 'TOR' },
  'toro investimentos': { color: '#00C853', sigla: 'TOR' },

  // ==========================================
  // CARTEIRAS DIGITAIS / DINHEIRO FÍSICO
  // ==========================================
  'carteira': { color: '#475569', sigla: '$$' },
  'dinheiro': { color: '#475569', sigla: '$$' },
  'dinheiro físico': { color: '#475569', sigla: '$$' },
  'espécie': { color: '#475569', sigla: '$$' },
  'paypal': { color: '#00457C', sigla: 'PP' },
  'google pay': { color: '#4285F4', sigla: 'GP' },
  'apple pay': { color: '#000000', sigla: 'AP' },
  'samsung pay': { color: '#1428A0', sigla: 'SP' },

  // ==========================================
  // OUTROS BANCOS E INSTITUIÇÕES
  // ==========================================
  'agibank': { color: '#033333', sigla: 'AGI' },
  'mercantil': { color: '#003366', sigla: 'MER' },
  'banco mercantil': { color: '#003366', sigla: 'MER' },
  'mercantil do brasil': { color: '#003366', sigla: 'MER' },
  'bari': { color: '#003DA5', sigla: 'BARI' },
  'bocom bbm': { color: '#003DA5', sigla: 'BBM' },
  'bradesco cartões': { color: '#CC092F', sigla: 'BRA' },
  'carrefour': { color: '#003DA5', sigla: 'CAR' },
  'carrefour banco': { color: '#003DA5', sigla: 'CAR' },
  'cetelem': { color: '#4CAF50', sigla: 'CET' },
  'crefisa': { color: '#003DA5', sigla: 'CRE' },
  'facta financeira': { color: '#003DA5', sigla: 'FAC' },
  'ibank': { color: '#003DA5', sigla: 'IBK' },
  'intermedium': { color: '#FF7A00', sigla: 'IN' },
  'itaú unibanco': { color: '#EC7000', sigla: 'IT' },
  'jeitto': { color: '#00C853', sigla: 'JEI' },
  'losango': { color: '#003DA5', sigla: 'LOS' },
  'lojas americanas': { color: '#E31837', sigla: 'LA' },
  'magazine luiza': { color: '#00A650', sigla: 'ML' },
  'master': { color: '#FF6600', sigla: 'MAS' },
  'maxima': { color: '#003DA5', sigla: 'MAX' },
  'omni': { color: '#003DA5', sigla: 'OMN' },
  'parana banco': { color: '#003DA5', sigla: 'PAR' },
  'pecunia': { color: '#003DA5', sigla: 'PEC' },
  'portoseg': { color: '#00A3E0', sigla: 'PTS' },
  'porto seguro': { color: '#00A3E0', sigla: 'PTS' },
  'positiva': { color: '#4CAF50', sigla: 'POS' },
  'qi tech': { color: '#003DA5', sigla: 'QI' },
  'rb capital': { color: '#003DA5', sigla: 'RB' },
  'santander brasil': { color: '#EC0000', sigla: 'SAN' },
  'semear': { color: '#003DA5', sigla: 'SEM' },
  'socinal': { color: '#003DA5', sigla: 'SOC' },
  'topázio': { color: '#003DA5', sigla: 'TOP' },
  'tribanco': { color: '#003DA5', sigla: 'TRI' },
  'unicard': { color: '#003DA5', sigla: 'UNI' },
  'vr': { color: '#003DA5', sigla: 'VR' },
  'zema': { color: '#003DA5', sigla: 'ZEM' },
  'ton': { color: '#00D47B', sigla: 'TN' },
}

export function getBankIcon(bankName: string): React.ReactElement {
  const normalized = bankName?.trim().toLowerCase() || ''
  const bank = BANK_MAP[normalized]
  
  const bgColor = bank?.color || '#94A3B8'
  const sigla = bank?.sigla || (bankName ? bankName.substring(0, 2).toUpperCase() : 'BK')
  const isLight = LIGHT_COLORS.includes(bgColor)
  const textColor = isLight ? '#000000' : '#FFFFFF'
  
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
