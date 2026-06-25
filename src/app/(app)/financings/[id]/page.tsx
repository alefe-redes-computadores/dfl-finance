'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Edit2, Loader2, Check, Trash2, X, Wallet, Calendar,
  MoreHorizontal, Clock, ChevronDown
} from 'lucide-react'
import { format, addMonths, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getDynamicIcon } from '@/lib/iconUtils'

export default function FinancingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()

  const [financing, setFinancing] = useState<any>(null)
  const [abatements, setAbatements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAbatementModal, setShowAbatementModal] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)

  // Abatimento
  const [abAmount, setAbAmount] = useState('0,00')
  const [abAmountNum, setAbAmountNum] = useState(0)
  const [abDate, setAbDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [abAccountId, setAbAccountId] = useState('')
  const [abType, setAbType] = useState<'reduce_term' | 'reduce_installment'>('reduce_term')
  const [abObservation, setAbObservation] = useState('')
  const [showAccModal, setShowAccModal] = useState(false)

  const previewBalance = Math.max(0, (financing?.outstanding_balance || 0) - abAmountNum)

  const loadData = useCallback(async () => {
    if (!id || !user?.id) {
      console.log('loadData abortado:', { id, userId: user?.id })
      return
    }
    setLoading(true)
    console.log('Buscando financiamento:', { id, userId: user.id })

    const { data: finData, error: finError } = await supabase
      .from('financings')
      .select('*, accounts(name, color), categories(name, icon, color)')
      .match({ id: id, user_id: user.id })
      .single()

    if (finError) {
      console.error('Erro ao buscar financiamento:', finError)
      setLoading(false)
      return
    }

    if (finData) {
      console.log('Financiamento encontrado:', finData)
      setFinancing(finData)
      setAbAccountId(finData.account_id || '')
    } else {
      console.log('Nenhum financiamento retornado para id:', id)
      setLoading(false)
      return
    }

    const { data: abData } = await supabase
      .from('financing_abatements')
      .select('*, accounts(name, color)')
      .eq('financing_id', id)
      .order('date', { ascending: false })

    setAbatements(Array.isArray(abData) ? abData : [])

    const { data: accData } = await supabase
      .from('accounts')
      .select('id, name, color, balance')
      .match({ user_id: user.id, context: finData?.context || 'dfl' })

    setAccounts(Array.isArray(accData) ? accData : [])
    setLoading(false)
  }, [id, user])

  useEffect(() => { loadData() }, [loadData])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleArchive = async () => {
    if (!confirm('Arquivar este financiamento?')) return
    await supabase.from('financings').update({ status: 'archived' }).eq('id', id)
    router.push('/financings')
  }

  const handleDelete = async () => {
    if (!confirm('Excluir este financiamento?')) return
    await supabase.from('financings').delete().eq('id', id)
    router.push('/financings')
  }

  const handleAbAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setAbAmount('0,00')
      setAbAmountNum(0)
      return
    }
    const num = parseFloat(digits) / 100
    setAbAmountNum(num)
    setAbAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
  }

  const handleAbatement = async () => {
    if (isSubmitting) return
    if (!user?.id || abAmountNum <= 0) return

    // Validação para evitar saldo negativo
    if (abAmountNum > (financing.outstanding_balance || 0)) {
      alert('O valor do abatimento não pode ser maior que o saldo devedor.')
      return
    }

    setIsSubmitting(true)
    setSaving(true)

    try {
      const idempotencyKey = crypto.randomUUID()

      // Inserir abatimento
      const { error: abError } = await supabase.from('financing_abatements').insert({
        financing_id: id,
        amount: abAmountNum,
        date: abDate,
        abatement_type: abType,
        account_id: abAccountId || null,
        observation: abObservation || null
      })

      if (abError) throw abError

      // Recalcular saldo devedor e parcelas (garantindo que não fique negativo)
      const newBalance = Math.max(0, Number(financing.outstanding_balance) - abAmountNum)

      if (abType === 'reduce_term') {
        // Reduzir prazo: recalcular total de parcelas
        const newTotalInstallments = Math.max(1, Math.floor(newBalance / Number(financing.installment_value)))
        await supabase.from('financings').update({
          outstanding_balance: newBalance,
          total_installments: newTotalInstallments
        }).eq('id', id)
      } else {
        // Reduzir parcela: recalcular valor da parcela
        const remainingInstallments = Math.max(1, financing.total_installments - financing.current_installment + 1)
        const newInstallmentValue = remainingInstallments > 0 ? newBalance / remainingInstallments : 0
        await supabase.from('financings').update({
          outstanding_balance: newBalance,
          installment_value: newInstallmentValue
        }).eq('id', id)
      }

      // Criar transação (expense) para o abatimento
      // Garantindo que o payload está limpo e sem credit_card_id
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'expense',
        amount: abAmountNum,
        description: `Abatimento: ${financing.name}`,
        account_id: abAccountId || financing.account_id,
        financing_id: id,
        date: abDate,
        status: 'done',
        context: financing.context,
        idempotency_key: idempotencyKey,
      })

      if (txError) throw txError

      // Atualizar saldo da conta
      const targetAccountId = abAccountId || financing.account_id
      if (targetAccountId) {
        const { data: acc } = await supabase
          .from('accounts')
          .select('balance')
          .eq('id', targetAccountId)
          .single()

        if (acc) {
          await supabase
            .from('accounts')
            .update({ balance: Math.max(0, Number(acc.balance) - abAmountNum) })
            .eq('id', targetAccountId)
        }
      }

      setShowAbatementModal(false)
      setAbAmount('0,00')
      setAbAmountNum(0)
      setAbObservation('')
      loadData()
    } catch (err: any) {
      alert('Erro ao registrar abatimento: ' + err.message)
    } finally {
      setSaving(false)
      setIsSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
      <Loader2 className="animate-spin text-teal-700" size={40} />
    </div>
  )

  if (!financing) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
      <p className="text-gray-500 dark:text-gray-400">Financiamento não encontrado.</p>
    </div>
  )

  const IconComp = getDynamicIcon(financing.icon || 'home')
  const remainingInstallments = Math.max(0, financing.total_installments - financing.current_installment + 1)
  const progress = (financing.current_installment / financing.total_installments) * 100
  const paidSoFar = (Number(financing.installment_value) * (financing.current_installment - 1)) + abatements.reduce((a, ab) => a + Number(ab.amount), 0)
  const totalToPay = Math.max(0, Number(financing.installment_value) * remainingInstallments)
  const isOverdue = financing.next_due_date && differenceInDays(new Date(financing.next_due_date), new Date()) < 0

  // Gerar parcelas dinâmicas (apenas as futuras/atuais)
  const installmentsList = []
  if (remainingInstallments > 0) {
    for (let i = financing.current_installment; i <= financing.total_installments; i++) {
      const dueDate = financing.next_due_date
        ? format(addMonths(new Date(financing.next_due_date), i - financing.current_installment), 'yyyy-MM-dd')
        : null
      installmentsList.push({
        number: i,
        dueDate,
        value: Number(financing.installment_value)
      })
    }
  }

  const selectedAcc = accounts.find(a => a.id === abAccountId)

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-32 font-sans px-4 pt-6 transition-colors duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/financings')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{financing.name}</h2>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 -mr-2 text-gray-500 dark:text-gray-400">
            <MoreHorizontal size={20} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-10 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-2 z-30">
                <button onClick={() => { setShowMenu(false); router.push(`/financings/new?edit=${financing.id}`) }} className="w-full text-left px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2">
                  <Edit2 size={16} /> Editar contrato
                </button>
                <button onClick={() => { setShowMenu(false); handleArchive() }} className="w-full text-left px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2">
                  <ChevronDown size={16} /> Arquivar/Quitar
                </button>
                <button onClick={() => { setShowMenu(false); handleDelete() }} className="w-full text-left px-3 py-2 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                  <Trash2 size={16} /> Excluir
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Card Principal */}
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${financing.color}20`, color: financing.color }}>
            <IconComp size={24} />
          </div>
          <div>
            <p className="font-bold text-[16px] text-gray-800 dark:text-gray-100">{financing.name}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {financing.institution || 'Financiamento'} • {financing.accounts?.name || 'Conta'} • {financing.categories?.name || 'Geral'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Parcela mensal</p>
            <p className="text-[18px] font-bold text-red-500">{formatCurrency(Number(financing.installment_value))}</p>
          </div>
          <div className="text-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Restantes</p>
            <p className="text-[18px] font-bold text-gray-800 dark:text-gray-200">{remainingInstallments === 0 ? '0 (Quitado)' : remainingInstallments}</p>
          </div>
        </div>

        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-3">
          <div className={`h-full rounded-full ${isOverdue ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>

        <div className="flex justify-between mb-3">
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Pago até agora</p>
            <p className="text-[14px] font-bold text-emerald-600">{formatCurrency(paidSoFar)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">A pagar em parcelas</p>
            <p className="text-[14px] font-bold text-orange-500">{formatCurrency(totalToPay)}</p>
          </div>
        </div>

        <div className="border-t border-gray-50 dark:border-slate-700 pt-3 space-y-1">
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Próxima parcela: <span className="font-bold text-gray-800 dark:text-gray-200">#{financing.current_installment}</span>
            {financing.next_due_date && (
              <> • vence <span className={`font-bold ${isOverdue ? 'text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>{format(new Date(financing.next_due_date), "dd/MM/yyyy")}</span></>
            )}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Saldo devedor: <span className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(Math.max(0, Number(financing.outstanding_balance)))}</span>
            {' '}• atualizado em {format(new Date(), "dd/MM/yyyy")}
          </p>
        </div>
      </div>

      {/* Botão Registrar Abatimento */}
      {!isPaid && (
        <button
          onClick={() => setShowAbatementModal(true)}
          className="w-full bg-teal-700 text-white py-3 rounded-full font-bold text-sm mb-6"
        >
          Registrar abatimento
        </button>
      )}

      {/* Lista de Parcelas (dinâmica) */}
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-6">
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Lançamentos</h3>
        {installmentsList.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-4">
            {remainingInstallments === 0 ? 'Contrato quitado!' : 'Nenhuma parcela pendente.'}
          </p>
        ) : (
          <div className="space-y-2">
            {installmentsList.map((inst) => (
              <div key={inst.number} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-600 flex items-center justify-center">
                    <Clock size={16} className="text-gray-400 dark:text-gray-500" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200">
                      Parcela {inst.number}/{financing.total_installments}
                    </p>
                    {inst.dueDate && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        {format(new Date(inst.dueDate), "dd/MM/yyyy")}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-[14px] font-bold text-red-500">{formatCurrency(inst.value)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico de Abatimentos */}
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Histórico de abatimentos</h3>
        {abatements.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-4">Nenhum abatimento registrado.</p>
        ) : (
          <div className="space-y-2">
            {abatements.map(ab => (
              <div key={ab.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-red-500">- {formatCurrency(Number(ab.amount) || 0)}</p>
                    {ab.observation && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">— {ab.observation}</p>}
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    {format(new Date(ab.date + 'T12:00:00'), "dd 'de' MMM yyyy", { locale: ptBR })}
                    {' • '}{ab.abatement_type === 'reduce_term' ? 'Reduzir prazo' : 'Reduzir parcela'}
                    {ab.accounts?.name ? ` • ${ab.accounts.name}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Abatimento */}
      {showAbatementModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowAbatementModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Registrar Abatimento</h3>
              <button onClick={() => setShowAbatementModal(false)} className="text-gray-400 dark:text-gray-500 p-2"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Valor pago</label>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                  <span className="text-gray-400 dark:text-gray-500 font-bold">R$</span>
                  <input type="text" inputMode="numeric" value={abAmount} onChange={handleAbAmountChange} className="bg-transparent text-lg font-bold text-gray-800 dark:text-gray-200 outline-none w-full" placeholder="0,00" />
                </div>
                {abAmountNum > 0 && (
                  <p className="text-[10px] text-teal-600 dark:text-teal-400 mt-1">
                    Novo saldo devedor: {formatCurrency(previewBalance > 0 ? previewBalance : 0)}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Data do pagamento</label>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                  <Calendar size={16} className="text-gray-400" />
                  <input type="date" value={abDate} onChange={e => setAbDate(e.target.value)} className="bg-transparent text-sm font-bold text-gray-800 dark:text-gray-200 outline-none" />
                </div>
              </div>

              <button onClick={() => setShowAccModal(true)} className="w-full flex items-center justify-between bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-gray-400 dark:text-gray-500" />
                  <span className={`text-sm ${selectedAcc ? 'text-gray-800 dark:text-gray-200 font-bold' : 'text-gray-400 dark:text-gray-500'}`}>
                    {selectedAcc ? selectedAcc.name : 'Conta de origem (opcional)'}
                  </span>
                </div>
                <ChevronLeft size={16} className="text-gray-300 dark:text-gray-600 rotate-180" />
              </button>

              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Tipo de abatimento</label>
                <div className="flex gap-2">
                  <button onClick={() => setAbType('reduce_term')} className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${abType === 'reduce_term' ? 'bg-teal-700 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'}`}>
                    Reduzir prazo
                  </button>
                  <button onClick={() => setAbType('reduce_installment')} className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${abType === 'reduce_installment' ? 'bg-teal-700 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'}`}>
                    Reduzir parcela
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {abType === 'reduce_term' ? 'Reduz o número total de parcelas' : 'Reduz o valor das parcelas restantes'}
                </p>
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Observação (opcional)</label>
                <input type="text" value={abObservation} onChange={e => setAbObservation(e.target.value)} placeholder="Ex: Pagamento extra" className="w-full bg-gray-50 dark:bg-slate-700 rounded-xl p-3 text-sm outline-none text-gray-800 dark:text-gray-200" />
              </div>

              <button
                onClick={handleAbatement}
                disabled={isSubmitting || abAmountNum <= 0}
                className="w-full bg-teal-700 text-white py-4 rounded-xl font-bold disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Confirmar Abatimento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Contas */}
      {showAccModal && (
        <div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/50" onClick={() => setShowAccModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Conta de origem</h3>
              <button onClick={() => setShowAccModal(false)} className="text-gray-400 dark:text-gray-500 p-2"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              <button onClick={() => { setAbAccountId(''); setShowAccModal(false) }} className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${!abAccountId ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-200 dark:bg-slate-700 text-gray-400"><Wallet size={20} /></div>
                <span className={`flex-1 text-left font-medium ${!abAccountId ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>Nenhuma conta</span>
                {!abAccountId && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
              </button>
              {accounts.map(acc => {
                const isActive = acc.id === abAccountId
                return (
                  <button key={acc.id} onClick={() => { setAbAccountId(acc.id); setShowAccModal(false) }} className={`w-full p-3 flex items-center gap-4 rounded-2xl transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: acc.color || '#14b8a6' }}>{acc.name.substring(0, 2).toUpperCase()}</div>
                    <span className={`flex-1 text-left font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'}`}>{acc.name}</span>
                    {isActive && <Check size={20} className="text-teal-700 dark:text-teal-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}