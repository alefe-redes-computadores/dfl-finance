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

// ============================================================
// SKELETON LOADER
// ============================================================
const PreviewSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded-full" />
        <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
      </div>
      <div className="h-8 w-24 bg-gray-200 dark:bg-slate-700 rounded-full" />
    </div>

    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl overflow-hidden">
      <div className="grid grid-cols-4 gap-2 p-3 border-b border-gray-100 dark:border-slate-700">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 bg-gray-200 dark:bg-slate-600 rounded" />
        ))}
      </div>
      {[1, 2, 3, 4, 5].map((row) => (
        <div key={row} className="grid grid-cols-4 gap-2 p-3 border-b border-gray-50 dark:border-slate-700 last:border-0">
          {[1, 2, 3, 4].map((col) => (
            <div key={col} className="h-3 bg-gray-100 dark:bg-slate-600/50 rounded" />
          ))}
        </div>
      ))}
    </div>

    <div className="flex gap-3">
      <div className="flex-1 h-12 bg-gray-200 dark:bg-slate-700 rounded-xl" />
      <div className="flex-1 h-12 bg-gray-200 dark:bg-slate-700 rounded-xl" />
    </div>
  </div>
)

export default function ImportCSVPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

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

  // ============================================================
  // PROCESSAR CSV
  // ============================================================
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validar extensão
    const validExtensions = ['.csv', '.tsv', '.txt']
    const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase()
    if (!validExtensions.includes(fileExt)) {
      showToast('Por favor, selecione um arquivo CSV, TSV ou TXT.', 'warning')
      return
    }

    // Validar tamanho (max 5MB)
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

    // Detectar separador
    const firstLine = lines[0]
    let separator = ','
    if (firstLine.includes('\t')) separator = '\t'
    else if (firstLine.includes(';')) separator = ';'

    // Extrair headers
    const headerRow = lines[0].split(separator).map(h => h.trim())
    setHeaders(headerRow)

    // Extrair dados (máx 10 linhas para preview)
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

  // ============================================================
  // RESET
  // ============================================================
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

  // ============================================================
  // IMPORTAR
  // ============================================================
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
      // Parse completo do arquivo
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

      // Mapeamento de colunas (exemplo: "Data", "Descrição", "Valor", "Tipo")
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

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]
        setImportProgress(((i + 1) / dataRows.length) * 100)

        try {
          // Extrair dados
          const dateStr = colMap.date !== -1 ? row[headerRow[colMap.date]] : ''
          const description = colMap.description !== -1 ? row[headerRow[colMap.description]] : ''
          const amountStr = colMap.amount !== -1 ? row[headerRow[colMap.amount]] : ''
          const typeRaw = colMap.type !== -1 ? row[headerRow[colMap.type]] : ''
          const categoryName = colMap.category !== -1 ? row[headerRow[colMap.category]] : ''

          // Validar dados obrigatórios
          if (!dateStr || !description || !amountStr) {
            failCount++
            continue
          }

          // Converter data
          let date = new Date(dateStr)
          if (isNaN(date.getTime())) {
            // Tentar formatos alternativos (dd/mm/yyyy, mm/dd/yyyy, etc)
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

          // Converter valor
          const amount = parseFloat(amountStr.replace(',', '.').replace(/[^0-9.-]+/g, ''))
          if (isNaN(amount) || amount <= 0) {
            failCount++
            continue
          }

          // Determinar tipo
          let type: 'income' | 'expense' | 'transfer' = 'expense'
          const typeLower = typeRaw.toLowerCase()
          if (typeLower.includes('receita') || typeLower.includes('income') || typeLower.includes('entrada')) {
            type = 'income'
          } else if (typeLower.includes('transferência') || typeLower.includes('transferencia') || typeLower.includes('transfer')) {
            type = 'transfer'
          }

          // Buscar categoria pelo nome
          let categoryId = null
          if (categoryName) {
            const { data: catData } = await supabase
              .from('categories')
              .select('id')
              .eq('user_id', user.id)
              .eq('name', categoryName)
              .single()
            if (catData) categoryId = catData.id
          }

          // Inserir transação
          const { error } = await supabase
            .from('transactions')
            .insert({
              user_id: user.id,
              context: context,
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
            })

          if (error) {
            failCount++
            console.error('Erro ao inserir:', error)
          } else {
            successCount++
          }
        } catch (err) {
          failCount++
          console.error('Erro na linha:', row, err)
        }
      }

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

  // ============================================================
  // UTILITÁRIOS
  // ============================================================
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
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans transition-colors duration-300">
      {/* Indicador de carregamento sutil */}
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/home')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Importar CSV</h1>
          <div className="w-10" />
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Upload Area */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-slate-700 text-center animate-in fade-in duration-300">
          {status === 'idle' || status === 'error' ? (
            <>
              <div className="w-20 h-20 bg-gray-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload size={32} className="text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2">Selecione um arquivo CSV</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Formatos suportados: .csv, .tsv, .txt
                <br />
                Máx: 5MB
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
                className="inline-block bg-teal-700 text-white px-6 py-3 rounded-2xl font-bold hover:bg-teal-800 transition-colors cursor-pointer active:scale-95"
              >
                <Upload size={18} className="inline mr-2" />
                Selecionar Arquivo
              </label>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-50 dark:bg-teal-900/30 rounded-xl flex items-center justify-center">
                    <FileText size={20} className="text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate max-w-[180px]">
                      {file?.name || 'Arquivo carregado'}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {file ? (file.size / 1024).toFixed(1) + ' KB' : ''}
                    </p>
                  </div>
                </div>
                <div className={`text-[10px] font-bold px-3 py-1 rounded-full ${getStatusColor(status)}`}>
                  {getStatusLabel(status)}
                </div>
              </div>

              {status === 'processing' && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 size={20} className="animate-spin text-teal-600" />
                  <span className="text-sm text-gray-500">Lendo arquivo...</span>
                </div>
              )}

              {status === 'ready' && (
                <button
                  onClick={handleReset}
                  className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <RefreshCw size={14} className="inline mr-1" />
                  Trocar arquivo
                </button>
              )}
            </div>
          )}
        </div>

        {/* Preview */}
        {status === 'ready' && previewData.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-slate-700 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Table size={18} className="text-teal-600" />
                <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200">Preview</h3>
                <span className="text-[10px] text-gray-400 font-medium">
                  {previewData.length} linhas exibidas
                </span>
              </div>
            </div>

            {loading ? (
              <PreviewSkeleton />
            ) : (
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl overflow-hidden">
                <div className="grid gap-2 p-3 border-b border-gray-100 dark:border-slate-700" style={{ gridTemplateColumns: `repeat(${Math.min(headers.length, 4)}, 1fr)` }}>
                  {headers.slice(0, 4).map((header, idx) => (
                    <div key={idx} className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase truncate">
                      {header}
                    </div>
                  ))}
                </div>
                {previewData.map((row, rowIdx) => (
                  <div key={rowIdx} className="grid gap-2 p-3 border-b border-gray-50 dark:border-slate-700 last:border-0" style={{ gridTemplateColumns: `repeat(${Math.min(headers.length, 4)}, 1fr)` }}>
                    {headers.slice(0, 4).map((header, colIdx) => (
                      <div key={colIdx} className="text-[12px] text-gray-600 dark:text-gray-400 truncate">
                        {row[header] || '-'}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex-1 bg-teal-700 text-white py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importing ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {importing ? 'Importando...' : `Importar ${previewData.length} transações`}
              </button>
              <button
                onClick={handleReset}
                disabled={importing}
                className="px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Progresso da Importação */}
        {status === 'importing' && (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-slate-700 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Importando...</span>
              <span className="text-sm text-gray-400">{Math.round(importProgress)}%</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-teal-500 rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
            </div>
          </div>
        )}

        {/* Resultado */}
        {status === 'done' && (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-emerald-200 dark:border-emerald-800 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <Check size={20} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 dark:text-gray-200">Importação concluída</h3>
                <p className="text-sm text-gray-500">
                  {importedCount} transações importadas
                  {errorCount > 0 && ` • ${errorCount} falhas`}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push('/transactions')}
                className="flex-1 bg-teal-700 text-white py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors"
              >
                Ver transações
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Nova importação
              </button>
            </div>
          </div>
        )}

        {/* Ajuda */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-slate-700">
          <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
            <FileText size={16} className="text-gray-400" />
            Formato esperado
          </h3>
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p><span className="font-bold text-gray-600 dark:text-gray-300">Data:</span> DD/MM/YYYY ou YYYY-MM-DD</p>
            <p><span className="font-bold text-gray-600 dark:text-gray-300">Descrição:</span> Texto descritivo</p>
            <p><span className="font-bold text-gray-600 dark:text-gray-300">Valor:</span> Número (ex: 150.00)</p>
            <p><span className="font-bold text-gray-600 dark:text-gray-300">Tipo:</span> Receita, Despesa ou Transferência</p>
            <p><span className="font-bold text-gray-600 dark:text-gray-300">Categoria:</span> Nome da categoria (opcional)</p>
          </div>
          <button
            onClick={() => {
              // Download de modelo CSV
              const headers = ['Data', 'Descrição', 'Valor', 'Tipo', 'Categoria']
              const sample = '2024-01-15,Supermercado,250.50,Despesa,Alimentação'
              const csv = headers.join(',') + '\n' + sample
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'modelo_importacao.csv'
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="mt-3 text-xs text-teal-600 hover:text-teal-700 font-bold flex items-center gap-1"
          >
            <Download size={12} />
            Baixar modelo
          </button>
        </div>
      </div>
    </div>
  )
}