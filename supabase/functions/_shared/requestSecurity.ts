export function secureEqual(candidate: string | null | undefined, expected: string | null | undefined): boolean {
  if (!candidate || !expected || candidate.length !== expected.length) return false
  let difference = 0
  for (let i = 0; i < expected.length; i++) difference |= candidate.charCodeAt(i) ^ expected.charCodeAt(i)
  return difference === 0
}

export function trustedWebhook(req: Request, body: any, secret?: string, evolutionKey?: string): boolean {
  return secureEqual(req.headers.get('x-dfl-webhook-token'), secret) ||
    secureEqual(req.headers.get('apikey'), evolutionKey) ||
    secureEqual(typeof body?.apikey === 'string' ? body.apikey : null, evolutionKey)
}

export async function readBoundedJson(req: Request, maxBytes = 512 * 1024): Promise<any> {
  if (!req.body) throw new Error('Missing body')
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.length
      if (size > maxBytes) throw new Error('Body too large')
      chunks.push(part.value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return JSON.parse(new TextDecoder().decode(bytes))
}

export function receiptMimeMatches(bytes: Uint8Array, mime: string): boolean {
  if (mime === 'application/pdf') return new TextDecoder().decode(bytes.slice(0,5)) === '%PDF-'
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === 'image/png') return [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n)
  if (mime === 'image/webp') return new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP'
  return false
}
