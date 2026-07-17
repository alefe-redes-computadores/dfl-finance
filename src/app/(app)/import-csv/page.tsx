'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Upload, FileText, X, Check, AlertTriangle,
  Loader2, RefreshCw, Download, Table, Eye, EyeOff
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useLocalData } from '@/hooks/useLocalData'
import { db } from '@/lib/db'
import { useSafeDb } from '@/hooks/useSafeDb'
import { downloadCSV } from '@/lib/services/exportService'

// 🔥 SKELETON ATUALIZADO
const PreviewSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded-[12px]" />
        <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
      </div>
      <div className="h-8 w-20 bg-gray-200 dark:bg-slate-700 rounded-[14px]" />
    </div>

    <div className="rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 overflow-hidden">
      <div className="grid grid-cols-4 gap-2 px-3 py-3 border-b border-gray-200/70 dark:border-slate-700">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-3.5 bg-gray-200 dark:bg-slate-700 rounded" />
        ))}
      </div>

      {[1, 2, 3, 4, 5].map((row) => (
        <div key={row} className="grid grid-cols-4 gap-2 px-3 py-3 border-b border-gray-100 dark:border-slate-800 last:border-0">
          {[1, 2, 3, 4].map((col) => (
            <div key={col} className="h-3 bg-gray-100 dark:bg-slate-700/60 rounded" />
          ))}
        </div>
      ))}
    </div>

    <div className="flex gap-3">
      <div className="flex-1 h-12 bg-gray-200 dark:bg-slate-700 rounded-[18px]" />
      <div className="w-12 h-12 bg-gray-200 dark:bg-slate-700 rounded-[16px]" />
    </div>
  </div>
)

export default function ImportCSVPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context, effectiveContext } = useContext_()
  const { showToast } = useToast()
  const { safeDelete, safeUpdate, safeAdd } = useSafeDb()

  const [file, setFile] = useState<File | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [headers, setHeaders] = useState<string[]>([])
  const [previewData, setPreviewData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importedCount, setImportedCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [status, setStatus] = useState<'idle' | 'processing' | 'ready' | 'importing' | 'done' | 'error'>('idle')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: localCategories, loading: catLoading, reload: reloadCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context: effectiveContext },
  })

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const validExtensions = ['.csv', '.tsv', '.txt']
    const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase()
    if (!validExtensions.includes(fileExt)) {
      showToast('Por favor, selecione um arquivo CSV, TSV ou TXT.', 'warning')
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      showToast('Arquivo muito grande (máx 5MB).', 'warning')
      return
    }

    setFile(selectedFile)
    setStatus('processing')
    setLoading(true)
    setLoadingPulse(true)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        setFileContent(content)
        parseCSV(content)
      } catch (error) {
        showToast('Erro ao ler arquivo. Verifique se está no formato correto.', 'error')
        setStatus('error')
        setLoading(false)
        setLoadingPulse(false)
      }
    }
    reader.readAsText(selectedFile)
  }

  const parseCSV = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim() !== '')
    if (lines.length < 2) {
      showToast('Arquivo muito pequeno ou vazio.', 'warning')
      setStatus('error')
      setLoading(false)
      setLoadingPulse(false)
      return
    }

    let separator = ','
    if (lines[0].includes('\t')) separator = '\t'
    else if (lines[0].includes(';')) separator = ';'

    const headerRow = lines[0].split(separator).map(h => h.trim())
    setHeaders(headerRow)

    const dataRows = lines.slice(1, 11).map(line => {
      const values = line.split(separator).map(v => v.trim())
      const obj: Record<string, string> = {}
      headerRow.forEach((header, idx) => {
        obj[header] = values[idx] || ''
      })
      return obj
    })

    setPreviewData(dataRows)
    setStatus('ready')
    setLoading(false)
    setLoadingPulse(false)
    showToast(`Arquivo carregado: ${dataRows.length} linhas de preview (${lines.length - 1} no total)`, 'success')
  }

  const handleReset = () => {
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
      showToast('Sessão expirada.', 'error')
      return
    }

    if (!fileContent || previewData.length === 0) {
      showToast('Nenhum dado para importar.', 'warning')
      return
    }

    setImporting(true)
    setStatus('importing')
    setLoadingPulse(true)

    try {
      const lines = fileContent.split('\n').filter(line => line.trim() !== '')
      const headerRow = headers
      let separator = ','
      if (fileContent.includes('\t')) separator = '\t'
      else if (fileContent.includes(';')) separator = ';'

      const dataRows = lines.slice(1).map(line => {
        const values = line.split(separator).map(v => v.trim())
        const obj: Record<string, string> = {}
        headerRow.forEach((header, idx) => {
          obj[header] = values[idx] || ''
        })
        return obj
      })

      const colMap = {
        date: findColumn(headerRow, ['Data', 'Dia', 'Date']),
        description: findColumn(headerRow, ['Descrição', 'Descricao', 'Description', 'Observação', 'Observacao']),
        amount: findColumn(headerRow, ['Valor', 'Valor Total', 'Amount', 'Preço', 'Preco']),
        type: findColumn(headerRow, ['Tipo', 'Type', 'Categoria', 'Category']),
        category: findColumn(headerRow, ['Categoria', 'Category', 'Tag']),
        notes: findColumn(headerRow, ['Observação', 'Observacao', 'Notes', 'Observações']),
      }

      let successCount = 0
      let failCount = 0

      const categories = localCategories || []

      await db.transaction('rw', db.transactions, db.syncQueue, async () => {
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i]
          setImportProgress(((i + 1) / dataRows.length) * 100)

          try {
            const dateStr = colMap.date !== -1 ? row[headerRow[colMap.date]] : ''
            const description = colMap.description !== -1 ? row[headerRow[colMap.description]] : ''
            const amountStr = colMap.amount !== -1 ? row[headerRow[colMap.amount]] : ''
            const typeRaw = colMap.type !== -1 ? row[headerRow[colMap.type]] : ''
            const categoryName = colMap.category !== -1 ? row[headerRow[colMap.category]] : ''

            if (!dateStr || !description || !amountStr) {
              failCount++
              continue
            }

            let date = new Date(dateStr)
            if (isNaN(date.getTime())) {
              const parts = dateStr.split(/[\/\-.]/)
              if (parts.length === 3) {
                const day = parseInt(parts[0])
                const month = parseInt(parts[1]) - 1
                const year = parseInt(parts[2])
                date = new Date(year, month, day)
              }
            }
            if (isNaN(date.getTime())) {
              failCount++
              continue
            }

            const amount = parseFloat(amountStr.replace(',', '.').replace(/[^0-9.-]+/g, ''))
            if (isNaN(amount) || amount <= 0) {
              failCount++
              continue
            }

            let type: 'income' | 'expense' | 'transfer' = 'expense'
            const typeLower = typeRaw.toLowerCase()
            if (typeLower.includes('receita') || typeLower.includes('income') || typeLower.includes('entrada')) {
              type = 'income'
            } else if (typeLower.includes('transferência') || typeLower.includes('transferencia') || typeLower.includes('transfer')) {
              type = 'transfer'
            }

            let categoryId = null
            if (categoryName) {
              const found = categories.find((c: any) => c.name.toLowerCase() === categoryName.toLowerCase()) as any
              if (found) categoryId = found.id
            }

            const txId = crypto.randomUUID()
            const txPayload = {
              id: txId,
              user_id: user.id,
              context: effectiveContext,
              type: type,
              amount: amount,
              description: description,
              date: format(date, 'yyyy-MM-dd'),
              status: 'done',
              affects_balance: true,
              category_id: categoryId,
              notes: colMap.notes !== -1 ? row[headerRow[colMap.notes]] : null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              sync_status: 'pending',
              sync_attempts: 0,
            }

            const result = await safeAdd('transactions', txPayload)
            if (!result.success) {
              failCount++
              console.error(`Erro ao importar linha ${i + 1}: ${result.error}`)
              continue
            }

            successCount++
          } catch (err) {
            failCount++
            console.error('Erro na linha:', row, err)
          }
        }
      })

      setImportedCount(successCount)
      setErrorCount(failCount)
      setStatus('done')
      setLoadingPulse(false)

      if (failCount === 0) {
        showToast(`${successCount} transações importadas com sucesso!`, 'success')
      } else {
        showToast(`${successCount} importadas, ${failCount} falhas. Verifique o formato dos dados.`, 'warning')
      }
    } catch (error: any) {
      showToast(`Erro na importação: ${error.message}`, 'error')
      setStatus('error')
      setLoadingPulse(false)
    } finally {
      setImporting(false)
    }
  }

  const findColumn = (headers: string[], possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const idx = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))
      if (idx !== -1) return idx
    }
    return -1
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return 'text-gray-400 bg-gray-100 dark:bg-slate-700'
      case 'processing': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400'
      case 'ready': return 'text-teal-600 bg-teal-50 dark:bg-teal-900/20 dark:text-teal-400'
      case 'importing': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400'
      case 'done': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400'
      case 'error': return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
      default: return 'text-gray-400 bg-gray-100 dark:bg-slate-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'idle': return 'Aguardando arquivo'
      case 'processing': return 'Processando...'
      case 'ready': return 'Pronto para importar'
      case 'importing': return 'Importando...'
      case 'done': return 'Importado com sucesso'
      case 'error': return 'Erro no processamento'
      default: return 'Desconhecido'
    }
  }

  return (
    <div
      ref={containerRef}
      className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans transition-colors duration-300"
    >
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      {/* 🔥 HEADER UNIFICADO */}
      <div className="sticky top-0 z-40 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => router.back()} // ✅ CORRIGIDO: voltar para a tela anterior
                className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98] shrink-0"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="text-[24px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                  Importar CSV
                </h1>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Adicione transações em lote
                </p>
              </div>
            </div>

            <div className={`shrink-0 rounded-[16px] px-3 py-2 text-[11px] font-semibold ${getStatusColor(status)}`}>
              {getStatusLabel(status)}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <ContextToggle />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-4">
        {/* 🔥 CARD DE UPLOAD */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5 animate-in fade-in duration-300">
          {status === 'idle' || status === 'error' ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-200/70 dark:border-slate-700 flex items-center justify-center mx-auto mb-4">
                <Upload size={26} className="text-gray-400 dark:text-gray-500" />
              </div>

              <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Selecione um arquivo CSV
              </h3>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mb-5">
                Formatos suportados: .csv, .tsv, .txt • Máx: 5MB
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
                className="inline-flex items-center justify-center gap-2 bg-teal-600 text-white px-5 py-3 rounded-[20px] font-bold shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition-colors cursor-pointer active:scale-[0.98]"
              >
                <Upload size={16} />
                Selecionar arquivo
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-[16px] bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-teal-600 dark:text-teal-400" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[180px]">
                      {file?.name || 'Arquivo carregado'}
                    </p>
                    <p className="text-[12px] text-gray-400 dark:text-gray-500">
                      {file ? (file.size / 1024).toFixed(1) + ' KB' : ''}
                    </p>
                  </div>
                </div>

                {status === 'ready' && (
                  <button
                    onClick={handleReset}
                    className="h-10 px-3 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 text-[12px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98] shrink-0"
                  >
                    Trocar
                  </button>
                )}
              </div>

              {status === 'processing' && (
                <div className="flex items-center justify-center gap-2 py-3">
                  <Loader2 size={18} className="animate-spin text-teal-600" />
                  <span className="text-[13px] text-gray-500 dark:text-gray-400 font-medium">
                    Lendo arquivo...
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 🔥 PREVIEW */}
        {status === 'ready' && previewData.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Table size={17} className="text-teal-600 dark:text-teal-400 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                    Preview
                  </h3>
                  <p className="text-[12px] text-gray-400 dark:text-gray-500">
                    {previewData.length} linhas exibidas
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <PreviewSkeleton />
            ) : (
              <div className="rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 overflow-hidden">
                <div
                  className="grid gap-2 px-3 py-3 border-b border-gray-200/70 dark:border-slate-700"
                  style={{ gridTemplateColumns: `repeat(${Math.min(headers.length, 4)}, 1fr)` }}
                >
                  {headers.slice(0, 4).map((header, idx) => (
                    <div key={idx} className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 truncate">
                      {header}
                    </div>
                  ))}
                </div>

                {previewData.map((row, rowIdx) => (
                  <div
                    key={rowIdx}
                    className="grid gap-2 px-3 py-3 border-b border-gray-100 dark:border-slate-800 last:border-0"
                    style={{ gridTemplateColumns: `repeat(${Math.min(headers.length, 4)}, 1fr)` }}
                  >
                    {headers.slice(0, 4).map((header, colIdx) => (
                      <div key={colIdx} className="text-[12px] text-gray-700 dark:text-gray-300 truncate">
                        {row[header] || '-'}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex-1 bg-teal-600 text-white py-3.5 rounded-[20px] font-bold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 active:scale-[0.98]"
              >
                {importing ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {importing ? 'Importando...' : `Importar ${previewData.length} transações`}
              </button>

              <button
                onClick={handleReset}
                disabled={importing}
                className="h-[50px] w-[50px] rounded-[16px] border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center active:scale-[0.98]"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* 🔥 PROGRESSO DA IMPORTAÇÃO */}
        {status === 'importing' && (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-200">
                Importando...
              </span>
              <span className="text-[13px] text-gray-400 dark:text-gray-500">
                {Math.round(importProgress)}%
              </span>
            </div>

            <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* 🔥 IMPORTACAO CONCLUÍDA */}
        {status === 'done' && (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-emerald-200 dark:border-emerald-800 shadow-sm p-5 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <Check size={18} className="text-emerald-600 dark:text-emerald-400" />
              </div>

              <div>
                <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                  Importação concluída
                </h3>
                <p className="text-[12px] text-gray-400 dark:text-gray-500">
                  {importedCount} transações importadas
                  {errorCount > 0 && ` • ${errorCount} falhas`}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push('/transactions')}
                className="flex-1 bg-teal-600 text-white py-3.5 rounded-[20px] font-bold hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20 active:scale-[0.98]"
              >
                Ver transações
              </button>

              <button
                onClick={handleReset}
                className="flex-1 py-3.5 rounded-[20px] border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
              >
                Nova importação
              </button>
            </div>
          </div>
        )}

        {/* 🔥 FORMATO ESPERADO */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={16} className="text-gray-400 dark:text-gray-500" />
            <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
              Formato esperado
            </h3>
          </div>

          <div className="space-y-1.5 text-[12px] text-gray-500 dark:text-gray-400">
            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Data:</span> DD/MM/YYYY ou YYYY-MM-DD</p>
            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Descrição:</span> Texto descritivo</p>
            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Valor:</span> Número (ex: 150.00)</p>
            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Tipo:</span> Receita, Despesa ou Transferência</p>
            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Categoria:</span> Nome da categoria (opcional)</p>
          </div>

          <button
            onClick={() => {
              const headers = ['Data', 'Descrição', 'Valor', 'Tipo', 'Categoria']
              const sample = '2024-01-15,Supermercado,250.50,Despesa,Alimentação'
              const csv = headers.join(',') + '\n' + sample
              downloadCSV(csv, 'modelo_importacao.csv')
            }}
            className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
          >
            <Download size={12} />
            Baixar modelo
          </button>
        </div>
      </div>
    </div>
  )
}