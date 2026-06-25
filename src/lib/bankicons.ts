// Mapeamento de bancos conhecidos para URLs de logos (SVG ou PNG)
// As URLs usam o serviço da Clearbit, que retorna o logo oficial do banco.
const BANK_LOGOS: Record<string, string> = {
  'itaú': 'https://logo.clearbit.com/itau.com.br',
  'itau': 'https://logo.clearbit.com/itau.com.br',
  'bradesco': 'https://logo.clearbit.com/bradesco.com.br',
  'santander': 'https://logo.clearbit.com/santander.com.br',
  'caixa': 'https://logo.clearbit.com/caixa.gov.br',
  'caixa econômica': 'https://logo.clearbit.com/caixa.gov.br',
  'nubank': 'https://logo.clearbit.com/nubank.com.br',
  'inter': 'https://logo.clearbit.com/bancointer.com.br',
  'banco inter': 'https://logo.clearbit.com/bancointer.com.br',
  'c6 bank': 'https://logo.clearbit.com/c6bank.com.br',
  'c6': 'https://logo.clearbit.com/c6bank.com.br',
  'picpay': 'https://logo.clearbit.com/picpay.com',
  'mercado pago': 'https://logo.clearbit.com/mercadopago.com.br',
  'will bank': 'https://logo.clearbit.com/willbank.com.br',
  'next': 'https://logo.clearbit.com/next.com.br',
  'bs2': 'https://logo.clearbit.com/bs2.com',
  'safra': 'https://logo.clearbit.com/safra.com.br',
  'banco safra': 'https://logo.clearbit.com/safra.com.br',
  'banco do brasil': 'https://logo.clearbit.com/bb.com.br',
  'bb': 'https://logo.clearbit.com/bb.com.br',
  'btg pactual': 'https://logo.clearbit.com/btgpactual.com',
  'btg': 'https://logo.clearbit.com/btgpactual.com',
  'pan': 'https://logo.clearbit.com/bancopan.com.br',
  'banco pan': 'https://logo.clearbit.com/bancopan.com.br',
  'sicoob': 'https://logo.clearbit.com/sicoob.com.br',
  'sicredi': 'https://logo.clearbit.com/sicredi.com.br',
  'neon': 'https://logo.clearbit.com/neon.com.br',
  'pagseguro': 'https://logo.clearbit.com/pagseguro.com.br',
  'pagbank': 'https://logo.clearbit.com/pagbank.com.br',
  'stone': 'https://logo.clearbit.com/stone.com.br',
  'ton': 'https://logo.clearbit.com/ton.com.br',
};

/**
 * Retorna a URL do logo do banco ou null se não for conhecido.
 * A comparação ignora case e espaços extras.
 */
export function getBankLogoUrl(bankName: string): string | null {
  if (!bankName) return null;
  const normalized = bankName.trim().toLowerCase();
  return BANK_LOGOS[normalized] || null;
}