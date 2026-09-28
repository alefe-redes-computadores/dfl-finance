import { resolveApiUrl } from '@/lib/runtime/apiUrl'
import { supabase } from '@/lib/supabase'
import {
  buildReceiptStorageName,
  getReceiptStoragePath,
  normalizeReceiptDisplayName,
} from '@/lib/receiptPresentation'

export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024

const RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

export interface ReceiptUploadResult {
  path: string
  url: string
  displayName: string
  kind: 'image' | 'pdf'
}

export interface ReceiptOcrData {
  amount?: number | null
  date?: string | null
  description?: string | null
  suggested_category?: string | null
  [key: string]: unknown
}

export function validateReceiptFile(file: Pick<File, 'type' | 'size'>) {
  if (!RECEIPT_MIME_TYPES.has(file.type)) {
    throw new Error('Use JPG, PNG, WEBP ou PDF.')
  }

  if (file.size > RECEIPT_MAX_BYTES) {
    throw new Error('O comprovante deve ter no máximo 10 MB.')
  }
}

export async function uploadReceiptFile({
  userId,
  file,
}: {
  userId: string
  file: File
}): Promise<ReceiptUploadResult> {
  if (!userId) throw new Error('Sessão expirada. Entre novamente.')

  validateReceiptFile(file)

  const path = `${userId}/${buildReceiptStorageName(file)}`
  const { error } = await supabase.storage.from('receipts').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (error) throw error

  const { data } = supabase.storage.from('receipts').getPublicUrl(path)
  if (!data?.publicUrl) {
    await supabase.storage.from('receipts').remove([path]).catch(() => undefined)
    throw new Error('Não foi possível gerar a URL do comprovante.')
  }

  return {
    path,
    url: data.publicUrl,
    displayName: normalizeReceiptDisplayName(file.name),
    kind: file.type === 'application/pdf' ? 'pdf' : 'image',
  }
}

export async function removeReceiptFile(value?: string | null) {
  const path = getReceiptStoragePath(value)
  if (!path) return false

  const { error } = await supabase.storage.from('receipts').remove([path])
  if (error) throw error
  return true
}

export async function removeReceiptFileQuiet(value?: string | null) {
  try {
    return await removeReceiptFile(value)
  } catch (error) {
    console.error('Falha ao limpar comprovante temporário:', error)
    return false
  }
}

export async function analyzeReceiptImage(imageUrl: string): Promise<ReceiptOcrData> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Sessão expirada. Entre novamente.')
  }

  const response = await fetch(resolveApiUrl('/api/ocr-receipt'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ imageUrl }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success || !payload?.data) {
    throw new Error(payload?.error || 'Não foi possível analisar a imagem.')
  }

  return payload.data as ReceiptOcrData
}

function normalizeSuggestion(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
}

export function findReceiptCategoryId(
  categories: any[],
  suggestion?: string | null,
  expectedType?: 'income' | 'expense',
  expectedContext?: 'dfl' | 'personal'
) {
  const target = normalizeSuggestion(suggestion)
  if (!target) return null

  const candidate = (categories || []).find((category: any) => {
    if (category?.is_archived === true) return false
    if (expectedType && category?.type !== expectedType) return false
    if (expectedContext && category?.context !== expectedContext) return false
    return normalizeSuggestion(category?.name) === target
  })

  return candidate?.id || null
}
