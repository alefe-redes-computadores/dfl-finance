/**
 * R461 — URL assinada de comprovante privado e pertencente ao usuário autenticado.
 * O serviço de OCR nunca obtém acesso amplo ao Storage: só consome um link
 * temporário, de uma imagem da pasta do próprio usuário.
 */
const ALLOWED_RECEIPT_NAME = /^[a-z0-9][a-z0-9._-]{0,170}\.(?:jpg|jpeg|png|webp|heic|heif)$/i
const USER_ID_RE = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

export function validateOwnSignedReceiptUrl(
  rawUrl: unknown,
  allowedOrigin: string,
  authenticatedUserId: string,
): string {
  const deny = (): never => { throw new Error('Comprovante não autorizado ou endereço inválido.') }
  if (typeof rawUrl !== 'string' || rawUrl.length > 5000 || !USER_ID_RE.test(authenticatedUserId)) return deny()
  let url: URL
  let origin: URL
  try {
    url = new URL(rawUrl)
    origin = new URL(allowedOrigin)
  } catch { return deny() }

  if (url.protocol !== 'https:' || url.origin !== origin.origin || url.username || url.password || url.hash) return deny()
  const prefix = `/storage/v1/object/sign/receipts/${authenticatedUserId}/`
  let path: string
  try { path = decodeURIComponent(url.pathname) } catch { return deny() }
  if (!path.startsWith(prefix)) return deny()
  const name = path.slice(prefix.length)
  if (!ALLOWED_RECEIPT_NAME.test(name) || name.includes('..') || name.includes('%') || name.includes('\\')) return deny()

  const entries = Array.from(url.searchParams.keys())
  const token = url.searchParams.get('token')
  if (entries.length !== 1 || entries[0] !== 'token' || !token || token.length < 10 || token.length > 4096) return deny()

  return url.toString()
}
