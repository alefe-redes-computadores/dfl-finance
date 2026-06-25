'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Plus, Loader2, Home, ChevronRight, Building, Calendar } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'

function FinancingsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { context } = useContext_()
  const [financings, setFinancings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadFinancings = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    const { data } = await supabase
      .from('financings')
      .select('*, accounts(name, color), categories(name, icon, color)')
      .match({ user_id: user.id, context: context, status: 'active' })
      .order('created_at', { ascending: false })

    setFinancings(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [user, context])

  useEffect(() => { loadFinancings() }, [loadFinancings])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Resumo
  const totalFinanced = financings.reduce((a, f) => a + (Number(f.outstanding_balance) || 0), 0)
  const totalInstallments = financings.reduce((a, f) => a + f.total_installments, 0)
  const activeCount = financings.length

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      
      <div className="flex items-center justify-between mb-6">
        <ContextToggle />
        <button
          onClick={() => router.push('/financings/new')}
          className="w-9 h-9 bg-teal-700 dark:bg-teal-600 rounded-full flex items-center justify-center"
        >
          <Plus size={20} className="text-white" />
        </button>
      </div>

      <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 mb-4 px-1">Financiamentos</h2>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-teal-700" size={32} /></div>
      ) : financings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Home size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Nenhum financiamento ativo</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[250px]">
            Cadastre seus financiamentos para acompanhar parcelas e saldo devedor.
          </p>
          <button
            onClick={() => router.push('/financings/new')}
            className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm"
          >
            Novo financiamento
          </button>
        </div>
      ) : (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
              <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-2">
                <Building size={16} className="text-orange-600 dark:text-orange-400" />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Saldo total</p>
              <p className="text-[15px] font-bold text-orange-600">{formatCurrency(totalFinanced)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
              <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mx-auto mb-2">
                <Calendar size={16} className="text-teal-700 dark:text-teal-400" />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Ativos</p>
              <p className="text-[15px] font-bold text-teal-700 dark:text-teal-400">{activeCount}</p>
            </div>
          </div>

          {/* Lista de Financiamentos */}
          <div className="space-y-3">
            {financings.map(fin => {
              const IconComp = getDynamicIcon(fin.icon || 'home')
              const remaining = fin.total_installments - fin.current_installment + 1
              const progress = (fin.current_installment / fin.total_installments) * 100
              const isOverdue = fin.next_due_date && differenceInDays(new Date(fin.next_due_date), new Date()) < 0

              return (
                <div
                  key={fin.id}
                  onClick={() => router.push(`/financings/${fin.id}`)}
                  className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${fin.color}20`, color: fin.color }}>
                        <IconComp size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">{fin.name}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">{fin.institution || 'Financiamento'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      }`}>
                        {isOverdue ? 'Atrasado' : 'Em dia'}
                      </span>
                      <ChevronRight size={16} className="text-gray-400 dark:text-gray-500" />
                    </div>
                  </div>

                  <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden mb-2">
                    <div className={`h-full rounded-full transition-all duration-700 ${isOverdue ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>

                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-400 dark:text-gray-500 font-medium">{formatCurrency(Number(fin.installment_value))}/mês</span>
                    <span className="text-gray-400 dark:text-gray-500 font-medium">{remaining} parcela(s) restantes</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function FinancingsPage() {
  return (
    <ContextProvider>
      <FinancingsContent />
    </ContextProvider>
  )
}