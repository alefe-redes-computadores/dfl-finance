/** @jest-environment node */
import { validateOwnSignedReceiptUrl } from '@/lib/server/receiptUrlSecurity'
import { assistantNativePreflight, withAssistantNativeCors } from '@/lib/server/assistantNativeCors'

const owner = '11111111-2222-4333-8444-555555555555'
const stranger = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const origin = 'https://bwggczkzsqcdeayyysmx.supabase.co'
const token = 'signed-token-example-valid-length'
const own = `${origin}/storage/v1/object/sign/receipts/${owner}/4ad1108a-199c-4f2a-ab2d-303ad461d123.jpg?token=${token}`

const preflight = (source: string, method = 'POST', headers = 'authorization, content-type') =>
  new Request('https://dfl-finance.vercel.app/api/ocr-receipt', {
    method: 'OPTIONS',
    headers: {
      Origin: source,
      'Access-Control-Request-Method': method,
      'Access-Control-Request-Headers': headers,
    },
  })

describe('R461 — OCR e isolamento do proprietário', () => {
  test('aceita somente URL assinada de imagem própria', () => {
    expect(validateOwnSignedReceiptUrl(own, origin, owner)).toBe(own)
  })
  test('nega URL de outro proprietário, mesmo com assinatura aparente', () => {
    expect(() => validateOwnSignedReceiptUrl(own, origin, stranger)).toThrow()
  })
  test('nega URL pública de bucket privado', () => {
    expect(() => validateOwnSignedReceiptUrl(own.replace('/sign/', '/public/'), origin, owner)).toThrow()
  })
  test('nega origem externa e protocolo inseguro', () => {
    expect(() => validateOwnSignedReceiptUrl(own.replace(origin, 'https://attacker.example'), origin, owner)).toThrow()
    expect(() => validateOwnSignedReceiptUrl(own.replace('https:', 'http:'), origin, owner)).toThrow()
  })
  test('nega traversal, subpastas e assinatura ausente', () => {
    expect(() => validateOwnSignedReceiptUrl(own.replace('4ad1108a-199c-4f2a-ab2d-303ad461d123.jpg', 'nested%2Ffile.jpg'), origin, owner)).toThrow()
    expect(() => validateOwnSignedReceiptUrl(own.split('?')[0], origin, owner)).toThrow()
    expect(() => validateOwnSignedReceiptUrl(`${own}&download=1`, origin, owner)).toThrow()
    expect(() => validateOwnSignedReceiptUrl(own.replace('.jpg', '.pdf'), origin, owner)).toThrow()
  })
  test('nenhum usuário ou link inválido é aceito', () => {
    expect(() => validateOwnSignedReceiptUrl('', origin, owner)).toThrow()
    expect(() => validateOwnSignedReceiptUrl(own, origin, 'qualquer')).toThrow()
  })
})

describe('R461 — preflight CORS Android com autenticação no POST', () => {
  test('origem nativa e Authorization/Content-Type são explicitamente permitidos', () => {
    const r = assistantNativePreflight(preflight('https://localhost'))
    expect(r.status).toBe(204)
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost')
    expect(r.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
  })
  test('origens e métodos estranhos são negados', () => {
    expect(assistantNativePreflight(preflight('https://attacker.example')).status).toBe(403)
    expect(assistantNativePreflight(preflight('https://localhost', 'DELETE')).status).toBe(405)
    expect(assistantNativePreflight(preflight('https://localhost', 'POST', 'authorization,x-evil')).status).toBe(400)
  })
  test('401 preserva corpo e status sem expor CORS a terceiros', async () => {
    const res = withAssistantNativeCors(preflight('https://localhost'), new Response('auth', { status: 401 }))
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('auth')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost')
    const denied = withAssistantNativeCors(preflight('https://attacker.example'), new Response('no'))
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})
