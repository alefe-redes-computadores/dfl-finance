// src/lib/importUtils.ts

export type ImportDelimiter = ',' | ';' | '\t'

export type ParsedDelimitedFile = {
  delimiter: ImportDelimiter
  headers: string[]
  rows: Record<string, string>[]
}

function countDelimiterOutsideQuotes(
  line: string,
  delimiter: ImportDelimiter
) {
  let count = 0
  let quoted = false

  for (let index = 0; index < line.length; index++) {
    const char = line[index]

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        index++
        continue
      }

      quoted = !quoted
      continue
    }

    if (!quoted && char === delimiter) count++
  }

  return count
}

export function detectDelimitedSeparator(content: string): ImportDelimiter {
  const firstLine =
    content
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .find((line) => line.trim().length > 0) || ''

  const candidates: ImportDelimiter[] = [',', ';', '\t']

  return candidates
    .map((delimiter) => ({
      delimiter,
      count: countDelimiterOutsideQuotes(firstLine, delimiter),
    }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ','
}

export function parseDelimitedRows(
  content: string,
  delimiter: ImportDelimiter
): string[][] {
  const source = content.replace(/^\uFEFF/, '')
  const rows: string[][] = []

  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < source.length; index++) {
    const char = source[index]

    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"'
        index++
      } else {
        quoted = !quoted
      }
      continue
    }

    if (!quoted && char === delimiter) {
      row.push(field.trim())
      field = ''
      continue
    }

    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[index + 1] === '\n') index++

      row.push(field.trim())
      field = ''

      if (row.some((value) => value.length > 0)) rows.push(row)
      row = []
      continue
    }

    field += char
  }

  row.push(field.trim())
  if (row.some((value) => value.length > 0)) rows.push(row)

  return rows
}

export function parseDelimitedFile(content: string): ParsedDelimitedFile {
  const delimiter = detectDelimitedSeparator(content)
  const matrix = parseDelimitedRows(content, delimiter)

  if (matrix.length < 2) {
    throw new Error('Arquivo vazio ou sem linhas de dados.')
  }

  const headers = matrix[0].map((header) => header.trim())

  if (headers.every((header) => header.length === 0)) {
    throw new Error('Cabeçalho do arquivo não foi reconhecido.')
  }

  const rows = matrix.slice(1).map((values) => {
    const record: Record<string, string> = {}

    headers.forEach((header, index) => {
      record[header] = values[index] ?? ''
    })

    return record
  })

  return { delimiter, headers, rows }
}

export function normalizeImportHeader(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function findImportColumn(
  headers: string[],
  possibleNames: string[]
): number {
  const normalizedHeaders = headers.map(normalizeImportHeader)
  const normalizedNames = possibleNames.map(normalizeImportHeader)

  for (const name of normalizedNames) {
    const index = normalizedHeaders.findIndex((header) => header === name)
    if (index !== -1) return index
  }

  return -1
}

export function parseFlexibleAmount(rawValue: string): number | null {
  let value = String(rawValue || '').trim()
  if (!value) return null

  const negativeByParentheses = /^\(.*\)$/.test(value)

  value = value
    .replace(/[R$\s\u00A0]/g, '')
    .replace(/[()]/g, '')

  const commaIndex = value.lastIndexOf(',')
  const dotIndex = value.lastIndexOf('.')

  if (commaIndex !== -1 && dotIndex !== -1) {
    if (commaIndex > dotIndex) {
      value = value.replace(/\./g, '').replace(',', '.')
    } else {
      value = value.replace(/,/g, '')
    }
  } else if (commaIndex !== -1) {
    const decimalPlaces = value.length - commaIndex - 1

    value =
      decimalPlaces === 1 || decimalPlaces === 2
        ? value.replace(/\./g, '').replace(',', '.')
        : value.replace(/,/g, '')
  } else if (
    dotIndex !== -1 &&
    /^\-?\d{1,3}(\.\d{3})+$/.test(value)
  ) {
    value = value.replace(/\./g, '')
  }

  value = value.replace(/[^0-9.+-]/g, '')

  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed === 0) return null

  return negativeByParentheses ? -Math.abs(parsed) : parsed
}

function isValidCivilDate(year: number, month: number, day: number) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    year > 2200 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false
  }

  const date = new Date(year, month - 1, day)

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function toISO(year: number, month: number, day: number) {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')
}

export function parseCivilDateISO(rawValue: string): string | null {
  const value = String(rawValue || '').trim()
  if (!value) return null

  let match = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)

  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])

    return isValidCivilDate(year, month, day)
      ? toISO(year, month, day)
      : null
  }

  match = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)

  if (match) {
    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])

    return isValidCivilDate(year, month, day)
      ? toISO(year, month, day)
      : null
  }

  return null
}
