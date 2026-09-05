// src/app/(app)/import-csv/page.tsx
'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Download,
  FileText,
  Loader2,
  Table,
  Upload,
  X,
} from 'lucide-react'

import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  findImportColumn,
  normalizeImportHeader,
  parseCivilDateISO,
  parseDelimitedFile,
  parseFlexibleAmount,
} from '@/lib/importUtils'
import { downloadCSV } from '@/lib/services/exportService'

const PreviewSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="h-4 w-28 rounded bg-gray-200 dark:bg-slate-700" />
      <div className="h-8 w-20 rounded-[14px] bg-gray-200 dark:bg-slate-700" />
    </div>

    <div className="overflow-hidden rounded-[18px] border border-gray-200/70 bg-gray-50 dark:border-slate-700 dark:bg-slate-900">
      {[1, 2, 3, 4, 5].map((row) => (
        <div
          key={row}
          className="grid grid-cols-4 gap-2 border-b border-gray-100 px-3 py-3 last:border-0 dark:border-slate-800"
        >
          {[1, 2, 3, 4].map((column) => (
            <div
              key={column}
              className="h-3 rounded bg-gray-100 dark:bg-slate-700/60"
            />
          ))}
        </div>
      ))}
    </div>
  </div>
)

export default function ImportCSVPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { effectiveContext } = useContext_()
  const { showToast } = useToast()
  const { safeAdd } = useSafeDb()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()

  const [file, setFile] = useState<File | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importedCount, setImportedCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [status, setStatus] = useState<
    'idle' | 'processing' | 'ready' | 'importing' | 'done' | 'error'
  >('idle')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: localCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context: effectiveContext },
  })

  const parseAndPreview = (content: string) => {
    const parsed = parseDelimitedFile(content)

    setHeaders(parsed.headers)
    setPreviewData(parsed.rows.slice(0, 10))
    setStatus('ready')
    setLoading(false)

    const delimiterLabel =
      parsed.delimiter === '\t' ? 'TAB' : parsed.delimiter

    showToast(
      `Arquivo carregado: ${Math.min(parsed.rows.length, 10)} linhas no preview, ${parsed.rows.length} no total. Separador: ${delimiterLabel}`,
      'success'
    )
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    const extension = selectedFile.name
      .substring(selectedFile.name.lastIndexOf('.'))
      .toLowerCase()

    if (!['.csv', '.tsv', '.txt'].includes(extension)) {
      errorHaptic()
      showToast('Selecione um arquivo CSV, TSV ou TXT.', 'warning')
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      errorHaptic()
      showToast('O arquivo deve ter no máximo 5 MB.', 'warning')
      return
    }

    vibrate([8])
    setFile(selectedFile)
    setStatus('processing')
    setLoading(true)

    const reader = new FileReader()

    reader.onload = (readerEvent) => {
      try {
        const content = String(readerEvent.target?.result || '')
        setFileContent(content)
        parseAndPreview(content)
      } catch (error: any) {
        errorHaptic()
        showToast(
          error?.message || 'Erro ao interpretar o arquivo.',
          'error'
        )
        setStatus('error')
        setLoading(false)
      }
    }

    reader.onerror = () => {
      errorHaptic()
      showToast('Erro ao ler o arquivo.', 'error')
      setStatus('error')
      setLoading(false)
    }

    reader.readAsText(selectedFile)
  }

  const handleReset = () => {
    vibrate([5])
    setFile(null)
    setFileContent('')
    setHeaders([])
    setPreviewData([])
    setStatus('idle')
    setImportProgress(0)
    setImportedCount(0)
    setErrorCount(0)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImport = async () => {
    if (!user?.id) {
      errorHaptic()
      showToast('Sessão expirada.', 'error')
      return
    }

    if (!fileContent) {
      errorHaptic()
      showToast('Nenhum arquivo pronto para importar.', 'warning')
      return
    }

    setImporting(true)
    setStatus('importing')
    setImportProgress(0)
    vibrate([8])

    try {
      const parsed = parseDelimitedFile(fileContent)
      const headerRow = parsed.headers
      const dataRows = parsed.rows

      const colMap = {
        date: findImportColumn(headerRow, ['Data', 'Dia', 'Date']),
        description: findImportColumn(headerRow, [
          'Descrição',
          'Descricao',
          'Description',
          'Histórico',
          'Historico',
        ]),
        amount: findImportColumn(headerRow, [
          'Valor',
          'Valor Total',
          'Amount',
          'Preço',
          'Preco',
        ]),
        type: findImportColumn(headerRow, [
          'Tipo',
          'Type',
          'Natureza',
          'Movimento',
        ]),
        category: findImportColumn(headerRow, [
          'Categoria',
          'Category',
          'Tag',
        ]),
        notes: findImportColumn(headerRow, [
          'Observação',
          'Observacao',
          'Observações',
          'Observacoes',
          'Notes',
        ]),
      }

      if (
        colMap.date === -1 ||
        colMap.description === -1 ||
        colMap.amount === -1
      ) {
        throw new Error(
          'O arquivo precisa ter colunas de Data, Descrição e Valor.'
        )
      }

      const categoryByName = new Map<string, string>(
        (localCategories || []).map((category: any) => [
          normalizeImportHeader(category.name),
          category.id,
        ])
      )

      let successCount = 0
      let failCount = 0

      for (let index = 0; index < dataRows.length; index++) {
        const row = dataRows[index]
        setImportProgress(((index + 1) / dataRows.length) * 100)

        try {
          const dateRaw = row[headerRow[colMap.date]] || ''
          const description =
            (row[headerRow[colMap.description]] || '').trim()
          const amountRaw = row[headerRow[colMap.amount]] || ''

          const typeRaw =
            colMap.type !== -1
              ? (row[headerRow[colMap.type]] || '').trim()
              : ''

          const categoryName =
            colMap.category !== -1
              ? (row[headerRow[colMap.category]] || '').trim()
              : ''

          const date = parseCivilDateISO(dateRaw)
          const parsedAmount = parseFlexibleAmount(amountRaw)

          if (!date || !description || parsedAmount === null) {
            failCount++
            continue
          }

          const normalizedType = normalizeImportHeader(typeRaw)

          if (
            normalizedType.includes('transfer') ||
            normalizedType.includes('transferencia')
          ) {
            failCount++
            continue
          }

          let type: 'income' | 'expense' = 'expense'

          if (
            normalizedType.includes('receita') ||
            normalizedType.includes('income') ||
            normalizedType.includes('entrada') ||
            normalizedType.includes('credito')
          ) {
            type = 'income'
          } else if (parsedAmount < 0) {
            type = 'expense'
          }

          const amount = Math.abs(parsedAmount)
          if (!(amount > 0)) {
            failCount++
            continue
          }

          const categoryId = categoryName
            ? categoryByName.get(normalizeImportHeader(categoryName)) || null
            : null

          const now = new Date().toISOString()

          const result = await safeAdd('transactions', {
            id: crypto.randomUUID(),
            user_id: user.id,
            context: effectiveContext,
            type,
            amount,
            description,
            date,
            status: 'done',
            affects_balance: true,
            category_id: categoryId,
            notes:
              colMap.notes !== -1
                ? row[headerRow[colMap.notes]] || null
                : null,
            created_at: now,
            updated_at: now,
            sync_status: 'pending',
            sync_attempts: 0,
          })

          if (!result.success) {
            failCount++
            console.error(
              `Erro ao importar linha ${index + 2}: ${result.error}`
            )
            continue
          }

          successCount++
        } catch (error) {
          failCount++
          console.error(`Erro ao importar linha ${index + 2}:`, error)
        }
      }

      setImportedCount(successCount)
      setErrorCount(failCount)
      setStatus('done')

      if (failCount === 0) {
        success()
        showToast(
          `${successCount} transações importadas com sucesso.`,
          'success'
        )
      } else {
        vibrate([20, 40, 20])
        showToast(
          `${successCount} importadas e ${failCount} ignoradas. Linhas inválidas ou transferências sem contas não foram criadas.`,
          'warning'
        )
      }
    } catch (error: any) {
      errorHaptic()
      showToast(
        error?.message || 'Erro durante a importação.',
        'error'
      )
      setStatus('error')
    } finally {
      setImporting(false)
    }
  }

  const getStatusColor = (value: string) => {
    switch (value) {
      case 'processing':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400'
      case 'ready':
        return 'text-teal-600 bg-teal-50 dark:bg-teal-900/20 dark:text-teal-400'
      case 'importing':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400'
      case 'done':
        return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400'
      case 'error':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
      default:
        return 'text-gray-400 bg-gray-100 dark:bg-slate-700'
    }
  }

  const getStatusLabel = (value: string) => {
    switch (value) {
      case 'processing':
        return 'Processando...'
      case 'ready':
        return 'Pronto para importar'
      case 'importing':
        return 'Importando...'
      case 'done':
        return 'Importação concluída'
      case 'error':
        return 'Erro no processamento'
      default:
        return 'Aguardando arquivo'
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#f8f9fa] pb-28 font-sans transition-colors duration-300 dark:bg-slate-900">
      <div className="sticky top-0 z-40 border-b border-gray-200/60 bg-[#f8f9fa]/92 px-4 pb-3 pt-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/92">
        <div className="rounded-[24px] border border-gray-200/70 bg-white/90 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-gray-200/70 bg-gray-50 text-gray-500 transition-colors active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900/40 dark:text-gray-300"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="text-[24px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  Importar CSV
                </h1>
                <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">
                  Adicione receitas e despesas em lote
                </p>
              </div>
            </div>

            <div
              className={`shrink-0 rounded-[16px] px-3 py-2 text-[11px] font-semibold ${getStatusColor(status)}`}
            >
              {getStatusLabel(status)}
            </div>
          </div>

          <ContextToggle />
        </div>
      </div>

      <div className="space-y-4 px-4 pt-3">
        <div className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {status === 'idle' || status === 'error' ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gray-200/70 bg-gray-50 dark:border-slate-700 dark:bg-slate-900">
                <Upload size={26} className="text-gray-400 dark:text-gray-500" />
              </div>

              <h3 className="mb-1 text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                Selecione um arquivo
              </h3>
              <p className="mb-5 text-[12px] text-gray-400 dark:text-gray-500">
                CSV, TSV ou TXT · máximo 5 MB
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />

              <label
                htmlFor="csv-upload"
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[20px] bg-teal-600 px-5 py-3 font-bold text-white shadow-lg shadow-teal-600/20 transition-colors active:scale-[0.98]"
              >
                <Upload size={16} />
                Selecionar arquivo
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-teal-50 dark:bg-teal-900/20">
                    <FileText size={18} className="text-teal-600 dark:text-teal-400" />
                  </div>

                  <div className="min-w-0">
                    <p className="max-w-[180px] truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                      {file?.name || 'Arquivo carregado'}
                    </p>
                    <p className="text-[12px] text-gray-400 dark:text-gray-500">
                      {file ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                    </p>
                  </div>
                </div>

                {status === 'ready' && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="h-10 shrink-0 rounded-[16px] border border-gray-200/70 bg-gray-50 px-3 text-[12px] font-semibold text-gray-500 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900/40 dark:text-gray-400"
                  >
                    Trocar
                  </button>
                )}
              </div>

              {status === 'processing' && (
                <div className="flex items-center justify-center gap-2 py-3">
                  <Loader2 size={18} className="animate-spin text-teal-600" />
                  <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">
                    Lendo arquivo...
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {status === 'ready' && previewData.length > 0 && (
          <div className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 flex items-center gap-2">
              <Table size={17} className="shrink-0 text-teal-600 dark:text-teal-400" />
              <div>
                <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                  Preview
                </h3>
                <p className="text-[12px] text-gray-400 dark:text-gray-500">
                  {previewData.length} linhas exibidas
                </p>
              </div>
            </div>

            {loading ? (
              <PreviewSkeleton />
            ) : (
              <div className="overflow-hidden rounded-[18px] border border-gray-200/70 bg-gray-50 dark:border-slate-700 dark:bg-slate-900">
                <div
                  className="grid gap-2 border-b border-gray-200/70 px-3 py-3 dark:border-slate-700"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(headers.length, 4)}, 1fr)`,
                  }}
                >
                  {headers.slice(0, 4).map((header) => (
                    <div
                      key={header}
                      className="truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400"
                    >
                      {header}
                    </div>
                  ))}
                </div>

                {previewData.map((row, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="grid gap-2 border-b border-gray-100 px-3 py-3 last:border-0 dark:border-slate-800"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(headers.length, 4)}, 1fr)`,
                    }}
                  >
                    {headers.slice(0, 4).map((header) => (
                      <div
                        key={header}
                        className="truncate text-[12px] text-gray-700 dark:text-gray-300"
                      >
                        {row[header] || '-'}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="flex flex-1 items-center justify-center gap-2 rounded-[20px] bg-teal-600 py-3.5 font-bold text-white shadow-lg shadow-teal-600/20 active:scale-[0.98] disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Check size={18} />
                )}
                {importing
                  ? 'Importando...'
                  : `Importar ${previewData.length} do preview`}
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={importing}
                className="flex h-[50px] w-[50px] items-center justify-center rounded-[16px] border border-gray-200 bg-gray-50 text-gray-600 active:scale-[0.98] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-400"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-2 text-center text-[11px] text-gray-400 dark:text-gray-500">
              A importação processa todas as linhas do arquivo, não apenas o preview.
            </p>
          </div>
        )}

        {status === 'importing' && (
          <div className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-200">
                Importando...
              </span>
              <span className="text-[13px] text-gray-400 dark:text-gray-500">
                {Math.round(importProgress)}%
              </span>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}

        {status === 'done' && (
          <div className="rounded-[24px] border border-emerald-200 bg-white p-5 shadow-sm dark:border-emerald-800 dark:bg-slate-800">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
                {errorCount > 0 ? (
                  <AlertTriangle
                    size={18}
                    className="text-amber-600 dark:text-amber-400"
                  />
                ) : (
                  <Check
                    size={18}
                    className="text-emerald-600 dark:text-emerald-400"
                  />
                )}
              </div>

              <div>
                <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                  Importação concluída
                </h3>
                <p className="text-[12px] text-gray-400 dark:text-gray-500">
                  {importedCount} importadas
                  {errorCount > 0 && ` · ${errorCount} ignoradas`}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push('/transactions')}
                className="flex-1 rounded-[20px] bg-teal-600 py-3.5 font-bold text-white shadow-lg shadow-teal-600/20 active:scale-[0.98]"
              >
                Ver transações
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="flex-1 rounded-[20px] border border-gray-200 bg-gray-50 py-3.5 font-bold text-gray-600 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-gray-400"
              >
                Nova importação
              </button>
            </div>
          </div>
        )}

        <div className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-center gap-2">
            <FileText size={16} className="text-gray-400 dark:text-gray-500" />
            <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
              Formato esperado
            </h3>
          </div>

          <div className="space-y-1.5 text-[12px] text-gray-500 dark:text-gray-400">
            <p><strong>Data:</strong> DD/MM/YYYY ou YYYY-MM-DD</p>
            <p><strong>Descrição:</strong> texto descritivo</p>
            <p><strong>Valor:</strong> 1.234,56 ou 1234.56</p>
            <p><strong>Tipo:</strong> Receita ou Despesa</p>
            <p><strong>Categoria:</strong> nome exato, opcional</p>
          </div>

          <button
            type="button"
            onClick={() => {
              vibrate([5])
              const model =
                'Data,Descrição,Valor,Tipo,Categoria\n' +
                '15/01/2026,Supermercado,"250,50",Despesa,Alimentação\n'

              downloadCSV(model, 'modelo_importacao.csv')
            }}
            className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-teal-600 active:scale-[0.98] dark:text-teal-400"
          >
            <Download size={12} />
            Baixar modelo
          </button>
        </div>
      </div>
    </div>
  )
}
