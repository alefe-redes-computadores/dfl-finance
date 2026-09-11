// src/lib/server/aiSafety.ts
export const AI_MODEL = 'gemini-3.6-flash'
export const MAX_AI_FILE_BYTES = 10 * 1024 * 1024
export const MAX_EXTRACTED_TRANSACTIONS = 5000
export const AI_GENERATION_TIMEOUT_MS = 30000
export const REMOTE_FILE_TIMEOUT_MS = 15000

export const ALLOWED_RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export const RECEIPT_CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Lazer',
  'Saúde',
  'Educação',
  'Assinaturas',
  'Outros',
] as const

export class AiProviderTimeoutError extends Error {
  constructor() {
    super('O provedor de IA demorou mais que o esperado.')
    this.name = 'AiProviderTimeoutError'
  }
}

export function normalizeCivilDate(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1
  ) {
    return null
  }

  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day > maxDay) return null

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')
}

export function normalizeAiText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

export function normalizePositiveAmount(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  const amount = Math.abs(parsed)
  return amount > 0 ? amount : null
}

export function normalizeReceiptCategory(value: unknown): string {
  const normalized = normalizeAiText(value, 80)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')

  const match = RECEIPT_CATEGORIES.find(
    (category) =>
      category
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR') === normalized
  )

  return match || 'Outros'
}

function extractBalancedJson(
  text: string,
  open: '[' | '{',
  close: ']' | '}'
): string | null {
  let depth = 0
  let start = -1
  let inString = false
  let escaping = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      if (escaping) {
        escaping = false
      } else if (char === '\\') {
        escaping = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === open) {
      if (depth === 0) start = index
      depth += 1
      continue
    }

    if (char === close && depth > 0) {
      depth -= 1
      if (depth === 0 && start >= 0) {
        return text.slice(start, index + 1)
      }
    }
  }

  return null
}

export function extractJsonArray(text: string): string | null {
  return extractBalancedJson(text, '[', ']')
}

export function extractJsonObject(text: string): string | null {
  return extractBalancedJson(text, '{', '}')
}

export async function withAiTimeout<T>(
  promise: Promise<T>,
  timeoutMs = AI_GENERATION_TIMEOUT_MS
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new AiProviderTimeoutError()),
          timeoutMs
        )
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = REMOTE_FILE_TIMEOUT_MS
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

export function isAiTimeoutError(error: unknown) {
  return error instanceof AiProviderTimeoutError
}

export function logServerFailure(scope: string, error: unknown) {
  const errorName = error instanceof Error ? error.name : 'UnknownError'
  console.error(`[${scope}] falha`, { name: errorName })
}
