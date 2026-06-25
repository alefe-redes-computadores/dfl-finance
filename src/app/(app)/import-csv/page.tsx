'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft,
  Upload,
  FileSpreadsheet,
  Loader2,
  Check,
  AlertCircle,
  Download,
  Eye,
  X,
} from 'lucide-react'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

function ImportCSVContent() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setLoading(true)
    setError(null)

    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').filter((line) => line.trim())

      if (lines.length < 2) {
        setError('O arquivo está vazio ou não tem cabeçalho.')
        setLoading(false)
        return
      }

      // Assumimos que o CSV tem cabeçalho: Data,Descrição,Valor,Tipo
      const header = lines[0].toLowerCase()
      const dataLines = lines.slice(1)

      const previewData = dataLines.map((line, index) => {
        const cols = line.split(',').map((col) => col.trim().replace(/"/g, ''))
        return {
          id: index,
          date: cols[0] || '',
          description: cols[1] || '',
          amount: parseFloat(cols[2]?.replace(',', '.') || '0'),
          type: cols[3]?.toLowerCase() === 'receita' ? 'income' : 'expense',
        }
      })

      setPreview(previewData.slice(0, 20)) // Mostra apenas as primeiras 20 linhas
      setLoading(false)
    }
    reader.readAsText(selectedFile)
  }

  const handleImport = async () => {
    if (!user?.id || preview.length === 0) return
    setImporting(true)
    setError(null)

    try {
      const toImport = preview.map((row) => ({
        user_id: user.id,
        date: row.date,
        description: row.description,
        amount: Math.abs(row.amount),
        type: row.type,
        status: 'done',
        context: context,
        category_id: null,
        account_id: null,
      }))

      let count = 0
      for (const row of toImport) {
        if (!row.date || row.amount <= 0) continue
        const { error } = await supabase.from('transactions').insert(row)
        if (!error) count++
      }

      setImported(count)
      if (count === 0) setError('Nenhuma transação foi importada. Verifique os dados.')
    } catch (err: any) {
      setError('Erro ao importar: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Importar Extrato CSV</h1>
        <ContextToggle />
      </div>

      {!file && (
        <div
          onClick={() => fileRef.current?.click()}
          className="bg-white dark:bg-slate-800 rounded-[24px] p-8 shadow-sm border border-gray-50 dark:border-slate-700 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <div className="w-20 h-20 bg-teal-50 dark:bg-teal-900/30 rounded-full flex items-center justify-center">
            <Upload size={40} className="text-teal-700 dark:text-teal-400" />
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-800 dark:text-gray-200">Selecionar arquivo CSV</p>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1">
              O arquivo deve ter as colunas: Data, Descrição, Valor, Tipo
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-teal-700" size={40} />
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {imported > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 mb-4 flex items-center gap-3">
          <Check size={20} className="text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm text-emerald-700 dark:text-emerald-300">{imported} transações importadas com sucesso!</p>
        </div>
      )}

      {preview.length > 0 && (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-4">
            <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">
              Prévia ({preview.length} linhas)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-400 dark:text-gray-500">
                    <th className="text-left py-2">Data</th>
                    <th className="text-left py-2">Descrição</th>
                    <th className="text-right py-2">Valor</th>
                    <th className="text-center py-2">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.id} className="border-b border-gray-50 dark:border-slate-700">
                      <td className="py-2 text-gray-800 dark:text-gray-200">{row.date}</td>
                      <td className="py-2 text-gray-800 dark:text-gray-200 truncate max-w-[120px]">{row.description}</td>
                      <td className={`py-2 text-right font-bold ${row.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="py-2 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${row.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {row.type === 'income' ? 'Receita' : 'Despesa'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={importing || imported > 0}
            className="w-full bg-teal-700 text-white py-4 rounded-xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50"
          >
            {importing ? <Loader2 size={20} className="animate-spin inline" /> : 'Importar transações'}
          </button>
        </>
      )}
    </div>
  )
}

export default function ImportCSVPage() {
  return (
    <ContextProvider>
      <ImportCSVContent />
    </ContextProvider>
  )
}