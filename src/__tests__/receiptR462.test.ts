import { buildReceiptStorageName, getReceiptExtension, getReceiptKind } from '@/lib/receiptPresentation'
import { validateOwnSignedReceiptUrl } from '@/lib/server/receiptUrlSecurity'

const origin = 'https://example.supabase.co'
const owner = '11111111-1111-4111-8111-111111111111'
const foreign = '22222222-2222-4222-8222-222222222222'
const url = (user: string, name: string) =>
  `${origin}/storage/v1/object/sign/receipts/${user}/${name}?token=verylongsignedtoken123`

describe('R462 — compatibilidade do OCR e segurança privada', () => {
  test('JPEG com nome .jfif gera extensão física .jpg', () => {
    expect(buildReceiptStorageName({ name: 'foto.jfif', type: 'image/jpeg' })).toMatch(/\.jpg$/)
    expect(buildReceiptStorageName({ name: 'foto.jpeg', type: 'image/jpeg' })).toMatch(/\.jpg$/)
  })

  test('MIME prevalece sobre extensão original enganosa', () => {
    expect(buildReceiptStorageName({ name: 'imagem.jpg', type: 'image/png' })).toMatch(/\.png$/)
    expect(buildReceiptStorageName({ name: 'imagem.jfif', type: 'image/webp' })).toMatch(/\.webp$/)
    expect(buildReceiptStorageName({ name: 'documento.png', type: 'application/pdf' })).toMatch(/\.pdf$/)
  })

  test('arquivos JFIF e JPE antigos seguem elegíveis com URL assinada do dono', () => {
    expect(getReceiptExtension('foto.jfif')).toBe('jfif')
    expect(getReceiptKind('foto.jfif')).toBe('image')
    expect(getReceiptKind('foto.jpe')).toBe('image')
    expect(validateOwnSignedReceiptUrl(url(owner, 'antigo.jfif'), origin, owner)).toContain('antigo.jfif')
    expect(validateOwnSignedReceiptUrl(url(owner, 'antigo.jpe'), origin, owner)).toContain('antigo.jpe')
  })

  test('nega comprovante de outro usuário e URL pública/externa', () => {
    expect(() => validateOwnSignedReceiptUrl(url(foreign, 'antigo.jfif'), origin, owner)).toThrow()
    expect(() => validateOwnSignedReceiptUrl(url(owner, 'malware.exe'), origin, owner)).toThrow()
    expect(() => validateOwnSignedReceiptUrl('https://attacker.example/receipt.jpg?token=verylongsignedtoken123', origin, owner)).toThrow()
    expect(() => validateOwnSignedReceiptUrl(`${origin}/storage/v1/object/public/receipts/${owner}/antigo.jfif`, origin, owner)).toThrow()
  })
})
