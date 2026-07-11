'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { extractReceiptFromFile } from '@/lib/services/ocrService'
import { ChevronLeft, Upload, AlertCircle, Check, Loader, Camera } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ImportPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [apiKey, setApiKey] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [extractedData, setExtractedData] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [context, setContext] = useState<'dfl' | 'personal'>('dfl')

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setLoading(true)
    setError('')

    try {
      const savedKey = localStorage.getItem('gemini_api_key') || apiKey
      if (!savedKey) {
        setError('Configure sua chave de API Gemini.')
        setLoading(false)
        return
      }

      const data = await extractReceiptFromFile(selectedFile, savedKey)
      setExtractedData(data)
      setSelectedCategory(data.suggested_category || '')
      await loadCategories()
      await loadAccounts()
    } catch (err: any) {
      setError(err.message || 'Erro ao processar imagem.')
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user!.id)
      .eq('context', context)
      .eq('type', 'expense')
    setCategories(data ?? [])
  }

  const loadAccounts = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user!.id)
      .eq('context', context)
    setAccounts(data ?? [])
    if (data && data.length > 0 && !selectedAccount) {
      setSelectedAccount(data[0].id)
    }
  }

  const handleImport = async () => {
    if (!extractedData || !selectedAccount || !selectedCategory) {
      setError('Preencha todos os campos.')
      return
    }

    setLoading(true)
    try {
      await supabase.from('transactions').insert({
        user_id: user!.id,
        type: 'expense',
        amount: extractedData.amount,
        description: extractedData.description,
        date: extractedData.date || new Date().toISOString().split('T')[0],
        category_id: selectedCategory,
        account_id: selectedAccount,
        context,
        status: 'done',
        receipt_url: null,
      })

      setSuccess(true)
      setTimeout(() => {
        router.push('/transactions')
      }, 2000)
    } catch (err: any) {
      setError('Erro ao salvar transação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24 pt-6 px-5">

      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
          <ChevronLeft size={24} className="text-gray-700" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Importar Comprovante</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <Check size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">Transação importada com sucesso!</p>
        </div>
      )}

      {!extractedData ? (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl p-8 cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-all">
            <Camera size={40} className="text-gray-400 mb-3" />
            <p className="font-semibold text-gray-800 mb-1">Clique para tirar foto</p>
            <p className="text-sm text-gray-500">ou selecione um arquivo</p>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={loading}
              className="hidden"
              capture="environment"
            />
          </label>

          <div className="mt-6">
            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Chave da API Gemini (opcional)</label>
            <input
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              type="password"
              placeholder="Cole aqui se não estiver salva"
              className="w-full bg-gray-100 p-3.5 rounded-xl outline-none text-sm"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase mb-3">Dados Extraídos</p>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Valor</p>
                <p className="text-lg font-bold text-gray-900">R$ {(extractedData.amount || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Data</p>
                <p className="text-sm font-semibold text-gray-800">{extractedData.date || 'Não identificada'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Descrição</p>
                <p className="text-sm font-semibold text-gray-800">{extractedData.description || 'Sem descrição'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex bg-gray-100 p-1 rounded-full mb-5 w-fit">
              {(['dfl', 'personal'] as const).map(c => (
                <button key={c} onClick={() => setContext(c)}
                  className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${context===c ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                  {c==='dfl'?'DFL':'Pessoal'}
                </button>
              ))}
            </div>

            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Categoria</label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full bg-gray-100 p-3.5 rounded-xl outline-none text-sm font-semibold mb-4"
            >
              <option value="">Selecione uma categoria</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Conta</label>
            <select
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
              className="w-full bg-gray-100 p-3.5 rounded-xl outline-none text-sm font-semibold"
            >
              <option value="">Selecione uma conta</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setFile(null); setExtractedData(null) }}
              className="py-3 rounded-xl font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="py-3 rounded-xl font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
              Importar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}