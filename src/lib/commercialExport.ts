export type CommercialExportRow = {
  type: 'organization' | 'store' | 'platform'
  id: string
  parentId: string
  name: string
  detail: string
  status: string
}

export function csvSafe(value: unknown): string {
  let text = String(value ?? '')

  // Evita execução de fórmulas ao abrir CSV em planilhas.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) {
    text = "'" + text
  }

  return `"${text.replace(/"/g, '""')}"`
}

export function commercialCsv(
  rows: CommercialExportRow[]
): string {
  const header = [
    'tipo',
    'id',
    'id_pai',
    'nome',
    'detalhe',
    'situacao'
  ]

  const lines = rows.map(row => [
    row.type,
    row.id,
    row.parentId,
    row.name,
    row.detail,
    row.status
  ].map(csvSafe).join(';'))

  return '\uFEFF' + [
    header.join(';'),
    ...lines
  ].join('\r\n')
}

export function downloadCommercialCsv(
  rows: CommercialExportRow[]
): void {
  if (typeof document === 'undefined') return

  const content = commercialCsv(rows)
  const blob = new Blob([content], {
    type: 'text/csv;charset=utf-8'
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  try {
    anchor.href = url
    anchor.download = 'dfl-central-comercial.csv'
    document.body.appendChild(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    URL.revokeObjectURL(url)
  }
}
