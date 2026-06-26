// lib/BankIcons.ts
// SVGs inline dos principais bancos brasileiros
// Totalmente offline, sem dependência externa

const BANK_LOGOS: Record<string, { svg: string; color: string }> = {
  'nubank': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7v10l10 5 10-5V7L12 2z" fill="#820AD1"/><path d="M12 5L5 8.5v7L12 19l7-3.5v-7L12 5z" fill="white"/></svg>`,
    color: '#820AD1'
  },
  'itaú': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#EC7000"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="Arial">IT</text></svg>`,
    color: '#EC7000'
  },
  'itau': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#EC7000"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="Arial">IT</text></svg>`,
    color: '#EC7000'
  },
  'bradesco': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#CC092F"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial">BRA</text></svg>`,
    color: '#CC092F'
  },
  'santander': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#EC0000"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">SAN</text></svg>`,
    color: '#EC0000'
  },
  'caixa': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#006BA6"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial">CEF</text></svg>`,
    color: '#006BA6'
  },
  'caixa econômica': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#006BA6"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial">CEF</text></svg>`,
    color: '#006BA6'
  },
  'inter': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#FF7A00"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="Arial">IN</text></svg>`,
    color: '#FF7A00'
  },
  'banco inter': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#FF7A00"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="Arial">IN</text></svg>`,
    color: '#FF7A00'
  },
  'c6 bank': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#000000"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="Arial">C6</text></svg>`,
    color: '#000000'
  },
  'c6': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#000000"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="Arial">C6</text></svg>`,
    color: '#000000'
  },
  'picpay': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#21C25E"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial">PP</text></svg>`,
    color: '#21C25E'
  },
  'mercado pago': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#00B1EA"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">MP</text></svg>`,
    color: '#00B1EA'
  },
  'will bank': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#000000"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial">WB</text></svg>`,
    color: '#000000'
  },
  'next': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#00FF00"/><text x="12" y="17" text-anchor="middle" fill="black" font-size="12" font-weight="bold" font-family="Arial">NX</text></svg>`,
    color: '#00FF00'
  },
  'bs2': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#0033A0"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial">BS</text></svg>`,
    color: '#0033A0'
  },
  'safra': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#002D72"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">SAF</text></svg>`,
    color: '#002D72'
  },
  'banco safra': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#002D72"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">SAF</text></svg>`,
    color: '#002D72'
  },
  'banco do brasil': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#FCFC30"/><text x="12" y="17" text-anchor="middle" fill="#0033A0" font-size="11" font-weight="bold" font-family="Arial">BB</text></svg>`,
    color: '#FCFC30'
  },
  'bb': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#FCFC30"/><text x="12" y="17" text-anchor="middle" fill="#0033A0" font-size="11" font-weight="bold" font-family="Arial">BB</text></svg>`,
    color: '#FCFC30'
  },
  'btg pactual': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#0C2340"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">BTG</text></svg>`,
    color: '#0C2340'
  },
  'btg': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#0C2340"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">BTG</text></svg>`,
    color: '#0C2340'
  },
  'pan': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#009BDE"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">PAN</text></svg>`,
    color: '#009BDE'
  },
  'banco pan': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#009BDE"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">PAN</text></svg>`,
    color: '#009BDE'
  },
  'sicoob': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#004B87"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">SCO</text></svg>`,
    color: '#004B87'
  },
  'sicredi': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#008542"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial">SC</text></svg>`,
    color: '#008542'
  },
  'neon': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#00A9E0"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="Arial">NE</text></svg>`,
    color: '#00A9E0'
  },
  'pagseguro': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#00B25C"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial">PS</text></svg>`,
    color: '#00B25C'
  },
  'pagbank': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#FF6B00"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial">PB</text></svg>`,
    color: '#FF6B00'
  },
  'stone': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#00D47B"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial">ST</text></svg>`,
    color: '#00D47B'
  },
  'ton': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#00D47B"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial">TN</text></svg>`,
    color: '#00D47B'
  },
  // NOVOS BANCOS QUE VOCÊ PEDIU
  'carteira': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#8B4513"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">💰</text></svg>`,
    color: '#8B4513'
  },
  'dinheiro': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#228B22"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">💵</text></svg>`,
    color: '#228B22'
  },
  'infinitepay': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#6C63FF"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">INF</text></svg>`,
    color: '#6C63FF'
  },
  'infinit pay': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#6C63FF"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">INF</text></svg>`,
    color: '#6C63FF'
  },
  'ifood': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#EA1D2C"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">IFD</text></svg>`,
    color: '#EA1D2C'
  },
  'ifood pago': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#EA1D2C"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">IFD</text></svg>`,
    color: '#EA1D2C'
  },
  'brb': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#003DA5"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="Arial">BRB</text></svg>`,
    color: '#003DA5'
  },
};

export function getBankLogoSvg(bankName: string): string | null {
  if (!bankName) return null;
  const normalized = bankName.trim().toLowerCase();
  return BANK_LOGOS[normalized]?.svg || null;
}

export function getBankColor(bankName: string): string | null {
  if (!bankName) return null;
  const normalized = bankName.trim().toLowerCase();
  return BANK_LOGOS[normalized]?.color || null;
}

export const BANK_LIST = Object.keys(BANK_LOGOS).map(key => ({
  name: key.charAt(0).toUpperCase() + key.slice(1),
  key,
  color: BANK_LOGOS[key].color,
  svg: BANK_LOGOS[key].svg,
}));