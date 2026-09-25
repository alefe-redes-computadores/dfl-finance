export type ReceiptKind = 'image' | 'pdf' | 'file'

const EXTENSION_RE = /\.[a-z0-9]{2,8}$/i
const TECH_PREFIX_RE = /^(?:\d{10,}[_-]|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}[_-]?)/i

export function getReceiptExtension(fileName?: string | null) {
  if (!fileName) return ''
  const match = fileName.match(EXTENSION_RE)
  return match?.[0]?.slice(1).toLowerCase() || ''
}

export function stripReceiptExtension(fileName?: string | null) {
  if (!fileName) return ''
  return fileName.replace(EXTENSION_RE, '')
}

export function normalizeReceiptDisplayName(
  fileName?: string | null,
  preferredName?: string | null,
) {
  const preferred = preferredName?.trim()
  if (preferred) return stripReceiptExtension(preferred).trim()

  const original = stripReceiptExtension(fileName)
    .replace(TECH_PREFIX_RE, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!original || /^(?:img|image|photo|foto|scan|document|comprovante)\s*\d*$/i.test(original)) {
    return 'Comprovante'
  }

  return original
}

export function getReceiptStoragePath(value?: string | null) {
  if (!value) return ''

  try {
    const decoded = decodeURIComponent(value)
    const marker = '/receipts/'
    const markerIndex = decoded.indexOf(marker)

    if (markerIndex >= 0) {
      return decoded.slice(markerIndex + marker.length).split('?')[0]
    }

    return decoded
      .replace(/^receipts\//, '')
      .replace(/^\/+/, '')
      .split('?')[0]
  } catch {
    return String(value)
      .replace(/^receipts\//, '')
      .replace(/^\/+/, '')
      .split('?')[0]
  }
}

export function buildReceiptStorageName(file: Pick<File, 'name' | 'type'>) {
  const fromName = getReceiptExtension(file.name)
  const fromMime =
    file.type === 'application/pdf'
      ? 'pdf'
      : file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : 'jpg'

  const extension = fromName || fromMime
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  return `${id}.${extension}`
}

export function getReceiptKind(fileName?: string | null): ReceiptKind {
  const ext = getReceiptExtension(fileName)
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'heif'].includes(ext)) {
    return 'image'
  }
  if (ext === 'pdf') return 'pdf'
  return 'file'
}

export function buildReceiptSmartName(input: {
  description?: string | null
  amount?: number | null
  date?: string | null
  fallbackFileName?: string | null
}) {
  const base = normalizeReceiptDisplayName(
    input.fallbackFileName,
    input.description,
  )

  const parts = [base]

  if (typeof input.amount === 'number' && Number.isFinite(input.amount)) {
    parts.push(
      Math.abs(input.amount).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
    )
  }

  if (input.date) {
    const [year, month, day] = input.date.slice(0, 10).split('-')
    if (year && month && day) parts.push(`${day}/${month}/${year}`)
  }

  return parts.filter(Boolean).join(' • ')
}
