// lib/bankIcons.ts
const BANK_LOGOS: Record<string, { url: string; color: string }> = {
  'itaú': { url: 'https://logo.clearbit.com/itau.com.br', color: '#EC7000' },
  'itau': { url: 'https://logo.clearbit.com/itau.com.br', color: '#EC7000' },
  'bradesco': { url: 'https://logo.clearbit.com/bradesco.com.br', color: '#CC092F' },
  'santander': { url: 'https://logo.clearbit.com/santander.com.br', color: '#EC0000' },
  'caixa': { url: 'https://logo.clearbit.com/caixa.gov.br', color: '#006BA6' },
  'caixa econômica': { url: 'https://logo.clearbit.com/caixa.gov.br', color: '#006BA6' },
  'nubank': { url: 'https://logo.clearbit.com/nubank.com.br', color: '#820AD1' },
  'inter': { url: 'https://logo.clearbit.com/bancointer.com.br', color: '#FF7A00' },
  'banco inter': { url: 'https://logo.clearbit.com/bancointer.com.br', color: '#FF7A00' },
  'c6 bank': { url: 'https://logo.clearbit.com/c6bank.com.br', color: '#000000' },
  'c6': { url: 'https://logo.clearbit.com/c6bank.com.br', color: '#000000' },
  'picpay': { url: 'https://logo.clearbit.com/picpay.com', color: '#21C25E' },
  'mercado pago': { url: 'https://logo.clearbit.com/mercadopago.com.br', color: '#00B1EA' },
  'will bank': { url: 'https://logo.clearbit.com/willbank.com.br', color: '#000000' },
  'next': { url: 'https://logo.clearbit.com/next.com.br', color: '#00FF00' },
  'bs2': { url: 'https://logo.clearbit.com/bs2.com', color: '#0033A0' },
  'safra': { url: 'https://logo.clearbit.com/safra.com.br', color: '#002D72' },
  'banco safra': { url: 'https://logo.clearbit.com/safra.com.br', color: '#002D72' },
  'banco do brasil': { url: 'https://logo.clearbit.com/bb.com.br', color: '#FCFC30' },
  'bb': { url: 'https://logo.clearbit.com/bb.com.br', color: '#FCFC30' },
  'btg pactual': { url: 'https://logo.clearbit.com/btgpactual.com', color: '#0C2340' },
  'btg': { url: 'https://logo.clearbit.com/btgpactual.com', color: '#0C2340' },
  'pan': { url: 'https://logo.clearbit.com/bancopan.com.br', color: '#009BDE' },
  'banco pan': { url: 'https://logo.clearbit.com/bancopan.com.br', color: '#009BDE' },
  'sicoob': { url: 'https://logo.clearbit.com/sicoob.com.br', color: '#004B87' },
  'sicredi': { url: 'https://logo.clearbit.com/sicredi.com.br', color: '#008542' },
  'neon': { url: 'https://logo.clearbit.com/neon.com.br', color: '#00A9E0' },
  'pagseguro': { url: 'https://logo.clearbit.com/pagseguro.com.br', color: '#00B25C' },
  'pagbank': { url: 'https://logo.clearbit.com/pagbank.com.br', color: '#FF6B00' },
  'stone': { url: 'https://logo.clearbit.com/stone.com.br', color: '#00D47B' },
  'ton': { url: 'https://logo.clearbit.com/ton.com.br', color: '#00D47B' },
};

export function getBankLogoUrl(bankName: string): string | null {
  if (!bankName) return null;
  const normalized = bankName.trim().toLowerCase();
  return BANK_LOGOS[normalized]?.url || null;
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
  url: BANK_LOGOS[key].url,
}));