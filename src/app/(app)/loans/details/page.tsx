'use client'


function LoanDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get("id")
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { safeUpdate, safeDelete } = useSafeDb()
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const { data: localLoans } = useLocalData({
    table: 'loans' as any,
    filters: { context: effectiveContext },
  })

  const loan = localLoans?.find((l: any) => l.id === id) as any

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPayConfirm, setShowPayConfirm] = useState(false)
  const [processing, setProcessing] = useState(false)

  if (!loan) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#f6f7f8] dark:bg-slate-950">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">Empréstimo não encontrado.</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900"
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  const isLent = loan.direction === "lent"
  const amount = Number(loan.amount) || 0
  const remaining = Number(loan.remaining_amount ?? loan.amount) || 0
  const interestRate = Number(loan.interest_rate) || 0
  const status = loan.status || "active"

  const accent = isLent ? {
    text: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-600",
    bgSoft: "bg-teal-50 dark:bg-teal-900/20",
    borderSoft: "border-teal-100 dark:border-teal-800/40",
    hover: "hover:bg-teal-700",
  } : {
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500",
    bgSoft: "bg-orange-50 dark:bg-orange-900/20",
    borderSoft: "border-orange-100 dark:border-orange-800/40",
    hover: "hover:bg-orange-600",
  }

  const statusMap = {
    active: { label: "Ativo", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    paid: { label: "Pago", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    overdue: { label: "Atrasado", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  } as const

  const handlePay = async () => {
    setProcessing(true)
    try {
      const res = await safeUpdate('loans', loan.id, {
        status: 'paid',
        remaining_amount: 0,
        updated_at: new Date().toISOString(),
      })
      if (!res.success) throw new Error(res.error)
      success()
      showToast("✅ Empréstimo marcado como pago!", "success")
      setShowPayConfirm(false)
      router.refresh?.()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, "error")
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async () => {
    setProcessing(true)
    try {
      const res = await safeDelete('loans', loan.id)
      if (!res.success) throw new Error(res.error)
      success()
      showToast("🗑️ Empréstimo excluído", "success")
      setShowDeleteConfirm(false)
      router.back()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, "error")
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950">
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#f6f7f8]/90 dark:bg-slate-950/85 border-b border-black/5 dark:border-white/5 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => { vibrate([5]); router.back(); }}
            className="h-11 w-11 rounded-full flex items-center justify-center text-gray-800 dark:text-gray-200 active:scale-95 bg-white/80 dark:bg-slate-800/80 border border-black/5 dark:border-white/10"
            aria-label="Voltar"
          >
            <ArrowLeft size={22} />
          </button>

          <div className="text-center min-w-0 flex-1">
            <h1 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100 truncate">
              Detalhes do Empréstimo
            </h1>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {loan.description}
            </p>
          </div>

          <button
            onClick={() => { vibrate([5]); router.push(`?edit=${loan.id}`); }}
            className="h-11 w-11 rounded-full flex items-center justify-center text-gray-800 dark:text-gray-200 active:scale-95 bg-white/80 dark:bg-slate-800/80 border border-black/5 dark:border-white/10"
            aria-label="Editar"
          >
            <Edit3 size={20} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-6 pb-28 space-y-4">
        <div className={`rounded-[28px] p-5 ${accent.bgSoft} border ${accent.borderSoft}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${accent.text}`}>
                {isLent ? "Você emprestou" : "Você pegou"}
              </p>
              <h2 className="mt-2 text-[30px] font-semibold text-gray-900 dark:text-gray-100">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)}
              </h2>
            </div>
            <span className={`px-3 py-1 rounded-full text-[12px] font-semibold ${statusMap[status as keyof typeof statusMap]?.color ?? statusMap.active.color}`}>
              {statusMap[status as keyof typeof statusMap]?.label ?? "Ativo"}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-[18px] bg-white/70 dark:bg-slate-900/60 border border-black/5 dark:border-white/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Restante</p>
              <p className="mt-2 text-[18px] font-semibold text-gray-900 dark:text-gray-100">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(remaining)}
              </p>
            </div>
            <div className="rounded-[18px] bg-white/70 dark:bg-slate-900/60 border border-black/5 dark:border-white/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Juros</p>
              <p className="mt-2 text-[18px] font-semibold text-gray-900 dark:text-gray-100">
                {interestRate ? `${interestRate}% a.m.` : "Sem juros"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 p-4 space-y-4">
          <DetailRow label="Pessoa/Empresa" value={loan.lender || "—"} />
          <DetailRow label="Data" value={loan.date ? format(new Date(loan.date), "dd/MM/yyyy") : "—"} />
          <DetailRow label="Vencimento" value={loan.due_date ? format(new Date(loan.due_date), "dd/MM/yyyy") : "—"} />
          <DetailRow label="Observações" value={loan.notes || "Sem observações"} multiline />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { vibrate([10]); setShowPayConfirm(true); }}
            disabled={status === "paid"}
            className={`rounded-[20px] py-4 font-semibold text-white ${accent.bg} ${accent.hover} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Marcar pago
          </button>
          <button
            onClick={() => { vibrate([10]); setShowDeleteConfirm(true); }}
            className="rounded-[20px] py-4 font-semibold bg-gray-900 text-white dark:bg-red-600 dark:hover:bg-red-700"
          >
            Excluir
          </button>
        </div>
      </div>

      {showPayConfirm && (
        <ConfirmModal
          title="Marcar como pago?"
          description="Essa ação vai zerar o valor restante e atualizar o status do empréstimo."
          confirmLabel={processing ? "Processando..." : "Confirmar"}
          cancelLabel="Cancelar"
          onConfirm={handlePay}
          onCancel={() => setShowPayConfirm(false)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmModal
          title="Excluir empréstimo?"
          description="Essa ação não pode ser desfeita."
          confirmLabel={processing ? "Excluindo..." : "Excluir"}
          cancelLabel="Cancelar"
          destructive
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}