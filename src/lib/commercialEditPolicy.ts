import { cleanCnpj, isValidCnpj } from './commercialIdentity'

type OrganizationEdit = { name: string; legalName: string; taxId: string }
type StoreEdit = { name: string; acronym: string; logoUrl: string }

/** Updates never rewrite owner_id, foreign keys, status or integration modes. */
export function prepareOrganizationEdit(input: OrganizationEdit) {
  const name = input.name.trim()
  if (name.length < 2 || name.length > 160) throw new Error('Informe o nome da organização (2 a 160 caracteres).')
  const legalName = input.legalName.trim()
  if (legalName.length > 160) throw new Error('A razão social pode ter até 160 caracteres.')
  if (input.taxId.trim() && !isValidCnpj(input.taxId)) {
    throw new Error('CNPJ inválido. Revise os caracteres e os dígitos verificadores.')
  }
  return { name, legal_name: legalName || null, tax_id: cleanCnpj(input.taxId) || null }
}

export function prepareStoreEdit(input: StoreEdit) {
  const name = input.name.trim()
  if (name.length < 2 || name.length > 160) throw new Error('Informe o nome da loja (2 a 160 caracteres).')
  const acronym = input.acronym.trim().toUpperCase()
  if (!/^[A-Z0-9]{1,12}$/.test(acronym)) throw new Error('A sigla deve conter de 1 a 12 letras ou números.')
  const logoUrl = input.logoUrl.trim()
  if (logoUrl) {
    let url: URL
    try { url = new URL(logoUrl) }
    catch { throw new Error('Informe uma URL HTTPS válida para o logotipo.') }
    if (url.protocol !== 'https:' || url.username || url.password || logoUrl.length > 500) {
      throw new Error('O logotipo precisa usar HTTPS e não conter credenciais.')
    }
  }
  return { name, acronym, logo_url: logoUrl || null }
}

export function preparePlatformReference(value: string) {
  const result = value.trim()
  if (result.length > 160) throw new Error('O identificador pode ter até 160 caracteres.')
  return { external_merchant_ref: result || null }
}
