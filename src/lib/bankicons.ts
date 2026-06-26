// lib/bankIcons.ts
// SVGs inline dos principais bancos brasileiros
// Totalmente offline, sem dependência externa

const BANK_LOGOS: Record<string, { svg: string; color: string }> = {
  'nubank': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7v10l10 5 10-5V7L12 2z" fill="#820AD1"/><path d="M12 5L5 8.5v7L12 19l7-3.5v-7L12 5z" fill="white"/></svg>`,
    color: '#820AD1'
  },
  'itaú': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#EC7000"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="14" font-weight="bold">IT</text></svg>`,
    color: '#EC7000'
  },
  'itau': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#EC7000"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="14" font-weight="bold">IT</text></svg>`,
    color: '#EC7000'
  },
  'bradesco': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#CC092F"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">BR</text></svg>`,
    color: '#CC092F'
  },
  'santander': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#EC0000"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="11" font-weight="bold">SAN</text></svg>`,
    color: '#EC0000'
  },
  'caixa': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#006BA6"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">CEF</text></svg>`,
    color: '#006BA6'
  },
  'caixa econômica': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#006BA6"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">CEF</text></svg>`,
    color: '#006BA6'
  },
  'inter': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#FF7A00"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">IN</text></svg>`,
    color: '#FF7A00'
  },
  'banco inter': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#FF7A00"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">IN</text></svg>`,
    color: '#FF7A00'
  },
  'c6 bank': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#000000"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="11" font-weight="bold">C6</text></svg>`,
    color: '#000000'
  },
  'c6': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#000000"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="11" font-weight="bold">C6</text></svg>`,
    color: '#000000'
  },
  'picpay': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#21C25E"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="11" font-weight="bold">PP</text></svg>`,
    color: '#21C25E'
  },
  'mercado pago': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#00B1EA"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">MP</text></svg>`,
    color: '#00B1EA'
  },
  'will bank': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#000000"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="11" font-weight="bold">WB</text></svg>`,
    color: '#000000'
  },
  'next': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#00FF00"/><text x="12" y="16" text-anchor="middle" fill="black" font-size="12" font-weight="bold">NX</text></svg>`,
    color: '#00FF00'
  },
  'bs2': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#0033A0"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="11" font-weight="bold">BS</text></svg>`,
    color: '#0033A0'
  },
  'safra': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#002D72"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">SAF</text></svg>`,
    color: '#002D72'
  },
  'banco safra': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#002D72"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">SAF</text></svg>`,
    color: '#002D72'
  },
  'banco do brasil': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#FCFC30"/><text x="12" y="16" text-anchor="middle" fill="black" font-size="10" font-weight="bold">BB</text></svg>`,
    color: '#FCFC30'
  },
  'bb': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#FCFC30"/><text x="12" y="16" text-anchor="middle" fill="black" font-size="10" font-weight="bold">BB</text></svg>`,
    color: '#FCFC30'
  },
  'btg pactual': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#0C2340"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">BTG</text></svg>`,
    color: '#0C2340'
  },
  'btg': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#0C2340"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">BTG</text></svg>`,
    color: '#0C2340'
  },
  'pan': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#009BDE"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="11" font-weight="bold">PAN</text></svg>`,
    color: '#009BDE'
  },
  'banco pan': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#009BDE"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="11" font-weight="bold">PAN</text></svg>`,
    color: '#009BDE'
  },
  'sicoob': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#004B87"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">SCO</text></svg>`,
    color: '#004B87'
  },
  'sicredi': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#008542"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">SC</text></svg>`,
    color: '#008542'
  },
  'neon': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#00A9E0"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">NE</text></svg>`,
    color: '#00A9E0'
  },
  'pagseguro': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#00B25C"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="11" font-weight="bold">PS</text></svg>`,
    color: '#00B25C'
  },
  'pagbank': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#FF6B00"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="11" font-weight="bold">PB</text></svg>`,
    color: '#FF6B00'
  },
  'stone': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#00D47B"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">ST</text></svg>`,
    color: '#00D47B'
  },
  'ton': {
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#00D47B"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">TN</text></svg>`,
    color: '#00D47B'
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