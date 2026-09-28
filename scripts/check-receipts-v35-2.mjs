import fs from 'node:fs'

const read = (f) => fs.readFileSync(f, 'utf8')
const ok = (v, m) => {
  if (!v) throw new Error(`V35.2: ${m}`)
}

const presentation =
  read('src/lib/receiptPresentation.ts')

const ops =
  read('src/lib/receiptOperations.ts')

const gallery =
  read('src/app/(app)/receipts/page.tsx')

const txNew =
  read('src/app/(app)/transactions/new/page.tsx')

const txDetails =
  read('src/app/(app)/transactions/details/page.tsx')

const modal =
  read('src/components/ReceiptModal.tsx')

const exportService =
  read('src/lib/services/exportService.ts')

const exportData =
  read('src/components/reports/ExportData.tsx')

const pkg =
  JSON.parse(read('package.json'))

/* Helpers persistidos continuam sendo a autoridade de apresentação/path. */
ok(
  presentation.includes('getReceiptStoragePath'),
  'normalização central de path ausente'
)

ok(
  presentation.includes('buildReceiptStorageName'),
  'nome físico seguro central ausente'
)

ok(
  presentation.includes('normalizeReceiptDisplayName'),
  'nome visual central ausente'
)

/* Viewer premium permanece intacto. */
ok(
  gallery.includes('ReceiptViewer'),
  'viewer premium ausente'
)

ok(
  gallery.includes('onTouchMove'),
  'pinch zoom ausente'
)

ok(
  gallery.includes('object-cover'),
  'miniaturas reais ausentes'
)

/*
 * V57 — storage/OCR passa por receiptOperations.
 * O checker valida delegação centralizada em vez de exigir duplicação.
 */
ok(
  ops.includes(
    'export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024'
  ),
  'limite central de 10 MB ausente'
)

ok(
  ops.includes('buildReceiptStorageName(file)'),
  'storage name central não utilizado'
)

ok(
  ops.includes('getReceiptStoragePath(value)'),
  'path central não utilizado'
)

ok(
  ops.includes('normalizeReceiptDisplayName(file.name)'),
  'display name central não utilizado'
)

ok(
  ops.includes('uploadReceiptFile') &&
  ops.includes('removeReceiptFile') &&
  ops.includes('removeReceiptFileQuiet') &&
  ops.includes('analyzeReceiptImage'),
  'contrato compartilhado de comprovantes incompleto'
)

ok(
  gallery.includes('uploadReceiptFile') &&
  gallery.includes('removeReceiptFile'),
  'Central não usa operações compartilhadas'
)

ok(
  txNew.includes('uploadReceiptFile') &&
  txNew.includes('removeReceiptFileQuiet'),
  'Nova transação não usa ciclo de vida compartilhado'
)

ok(
  txDetails.includes('uploadReceiptFile') &&
  txDetails.includes('removeReceiptFileQuiet'),
  'Detalhes não usa ciclo de vida compartilhado'
)

ok(
  !txNew.includes("receiptUrl.split('/').slice(-2)"),
  'path frágil persiste em nova transação'
)

ok(
  !txDetails.includes("receiptUrl.split('/').slice(-2)"),
  'path frágil persiste em detalhes'
)

ok(
  modal.includes(
    'mantém o formato do arquivo automaticamente'
  ),
  'modal não comunica contrato de extensão'
)

ok(
  exportService.includes('NATIVE_EXPORT_AUDIT_V35_2'),
  'auditoria exportService ausente'
)

ok(
  exportData.includes('NATIVE_EXPORT_AUDIT_V35_2'),
  'auditoria ExportData ausente'
)

ok(
  Boolean(pkg.dependencies?.['@capacitor/browser']),
  'Browser nativo existente ausente'
)

ok(
  !pkg.dependencies?.['@capacitor/filesystem'],
  'Native Freeze furada por Filesystem'
)

ok(
  !pkg.dependencies?.['@capacitor/share'],
  'Native Freeze furada por Share'
)

console.log('DFL FINANCE V35.2 RECEIPTS FINAL: OK')
