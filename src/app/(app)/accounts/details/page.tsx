function AccountDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const accountId = searchParams.get('id')
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { pendingCount } = useLocalSync()
  const { context } = useContext_()
  const { user } = useAuth()

  // ✅ TODOS OS HOOKS PRIMEIRO (incluindo useCallback)
  const { data: accountData, loading, notFound } = useAccountById(accountId)
  const { data: transactions } = useAccountTransactions(accountId)
  const { data: allAccounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context },
  })

  const [refreshing, setRefreshing] = useState(false)
  const [expandedTransactions, setExpandedTransactions] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustNotes, setAdjustNotes] = useState("")
  const [transferAmount, setTransferAmount] = useState("")
  const [transferToAccount, setTransferToAccount] = useState("")
  const [transferNotes, setTransferNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ✅ MOVIDOS PARA O TOPO (junto com os outros hooks)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        vibrate([10])
        setTimeout(() => setRefreshing(false), 600)
      }
    }
  }, [refreshing, vibrate])

  // ✅ SÓ AGORA, DEPOIS DE TODOS OS HOOKS, PODEMOS TER RETURNS CONDICIONAIS

  if (!accountId) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 p-6 dark:bg-slate-950">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10">
            <X size={32} />
          </div>
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">Conta não identificada</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">O ID da conta não foi fornecido na URL.</p>
          <button
            onClick={() => router.back()}
            className="mt-6 inline-flex items-center gap-2 rounded-[20px] bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
          >
            <ArrowLeft size={18} />
            Voltar
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-gray-50 dark:bg-slate-950">
        <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 px-4 pb-4 pt-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-slate-800" />
        </div>
        <div className="flex-1 px-4 pt-6">
          <Skeleton count={4} />
        </div>
      </div>
    )
  }

  if (notFound || !accountData) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 p-6 dark:bg-slate-950">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10">
            <X size={32} />
          </div>
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">Conta não encontrada</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">A conta que você procura não existe ou foi removida.</p>
          <button
            onClick={() => router.back()}
            className="mt-6 inline-flex items-center gap-2 rounded-[20px] bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
          >
            <ArrowLeft size={18} />
            Voltar
          </button>
        </div>
      </div>
    )
  }

  // ====================================================================
  // A PARTIR DAQUI, O RESTO DO CÓDIGO PERMANECE IGUAL (funções e JSX)
  // ====================================================================

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)

  const formatDate = (date: string | null) => {
    if (!date) return ""
    return new Date(date).toLocaleDateString("pt-BR")
  }

  const handleAdjustBalance = async () => {
    if (!user) return
    const amount = parseFloat(adjustAmount.replace(',', '.'))

    if (!adjustAmount || isNaN(amount) || amount === 0) {
      errorHaptic()
      showToast("⚠️ Informe um valor para ajuste", "warning")
      return
    }

    setSaving(true)
    try {
      const txId = crypto.randomUUID()
      let newBalance = 0

      await db.transaction('rw', db.accounts, db.transactions, db.syncQueue, async () => {
        const acc = await db.table('accounts').get(accountId)
        if (!acc) throw new Error('Conta não encontrada')

        newBalance = safeNum(acc.balance) + amount
        await db.table('accounts').update(accountId, { balance: newBalance })
        await addToSyncQueue(user.id, 'accounts', 'update', accountId, { balance: newBalance })

        const newTx = {
          id: txId,
          user_id: acc.user_id,
          description: adjustNotes || "Ajuste de saldo",
          amount: Math.abs(amount),
          type: amount >= 0 ? "income" : "expense",
          account_id: accountId,
          date: new Date().toISOString().split("T")[0],
          status: "done",
          context,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }

        await db.table('transactions').add(newTx)
        await addToSyncQueue(user.id, 'transactions', 'create', txId, newTx)
      })

      success()
      showToast("✅ Saldo ajustado com sucesso!", "success")
      setShowAdjustModal(false)
      setAdjustAmount("")
      setAdjustNotes("")
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ ${err?.message || "Erro ao ajustar saldo"}`, "error")
    } finally {
      setSaving(false)
    }
  }

  const handleTransfer = async () => {
    if (!user) return
    const amount = parseFloat(transferAmount.replace(',', '.'))

    if (!transferAmount || isNaN(amount) || amount <= 0) {
      errorHaptic()
      showToast("⚠️ Informe um valor válido", "warning")
      return
    }

    if (!transferToAccount) {
      errorHaptic()
      showToast("⚠️ Selecione a conta de destino", "warning")
      return
    }

    setSaving(true)
    try {
      const fromTxId = crypto.randomUUID()
      const toTxId = crypto.randomUUID()
      const today = new Date().toISOString().split("T")[0]

      await db.transaction('rw', db.accounts, db.transactions, db.syncQueue, async () => {
        const fromAcc = await db.table('accounts').get(accountId)
        const toAcc = await db.table('accounts').get(transferToAccount)

        if (!fromAcc) throw new Error('Conta origem não encontrada')
        if (!toAcc) throw new Error('Conta destino não encontrada')

        const fromTx = {
          id: fromTxId,
          user_id: fromAcc.user_id,
          description: transferNotes || `Transferência para ${toAcc.name}`,
          amount,
          type: 'transfer',
          account_id: accountId,
          transfer_to: transferToAccount,
          date: today,
          status: 'done',
          context,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }

        await db.table('transactions').add(fromTx)
        await addToSyncQueue(user.id, 'transactions', 'create', fromTxId, fromTx)

        const toTx = {
          id: toTxId,
          user_id: toAcc.user_id,
          description: transferNotes || `Transferência de ${fromAcc.name}`,
          amount,
          type: 'transfer',
          account_id: transferToAccount,
          transfer_from: accountId,
          date: today,
          status: 'done',
          context,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }

        await db.table('transactions').add(toTx)
        await addToSyncQueue(user.id, 'transactions', 'create', toTxId, toTx)

        const newFromBalance = safeNum(fromAcc.balance) - amount
        await db.table('accounts').update(accountId, { balance: newFromBalance })
        await addToSyncQueue(user.id, 'accounts', 'update', accountId, { balance: newFromBalance })

        const newToBalance = safeNum(toAcc.balance) + amount
        await db.table('accounts').update(transferToAccount, { balance: newToBalance })
        await addToSyncQueue(user.id, 'accounts', 'update', transferToAccount, { balance: newToBalance })
      })

      success()
      showToast("✅ Transferência realizada com sucesso!", "success")
      setShowTransferModal(false)
      setTransferAmount("")
      setTransferToAccount("")
      setTransferNotes("")
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ ${err?.message || "Erro ao transferir"}`, "error")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!user) return
    vibrate([10, 50])

    if (!confirm("Tem certeza que deseja excluir esta conta?")) return

    try {
      await db.table('accounts').delete(accountId)
      await addToSyncQueue(user.id, 'accounts', 'delete', accountId, { id: accountId })
      success()
      showToast("🗑️ Conta excluída com sucesso!", "success")
      router.back()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro ao excluir: ${err.message}`, "error")
    }
  }

  const Icon = ACCOUNT_ICONS[accountData.type] || Wallet
  const sortedTransactions = [...(transactions || [])].sort(
    (a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  )
  const balance = safeNum(accountData.balance)
  const balancePositive = balance >= 0

  return (
    <div className="flex h-[100dvh] flex-col bg-gray-50 dark:bg-slate-950">
      {(loading || pendingCount > 0) && (
        <div className="fixed right-4 top-20 z-50">
          <div className="h-3 w-3 animate-pulse rounded-full bg-teal-500 shadow-[0_0_12px_rgba(20,184,166,0.45)]" />
        </div>
      )}

      {refreshing && (
        <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center pt-6">
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-[0_6px_24px_rgba(0,0,0,0.10)] animate-in slide-in-from-top-2 duration-300 dark:bg-slate-800">
            <RefreshCw size={16} className="animate-spin text-teal-600 dark:text-teal-400" />
            <span className="text-[12px] font-semibold text-teal-700 dark:text-teal-300">
              Atualizando...
            </span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 px-4 pb-4 pt-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => {
                vibrate([5])
                router.back()
              }}
              className="rounded-full p-2 -ml-2 text-gray-700 transition-transform active:scale-95 dark:text-gray-200"
            >
              <ArrowLeft size={24} />
            </button>

            <div className="min-w-0">
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                Detalhes da conta
              </p>
              <h1 className="truncate text-[18px] font-semibold text-gray-900 dark:text-gray-100">
                {accountData.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                vibrate([5])
                router.push(`/accounts/new?edit=${accountId}`)
              }}
              className="rounded-full border border-gray-200 bg-white p-2.5 text-gray-700 transition-all active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200"
            >
              <Pencil size={18} />
            </button>

            <button
              onClick={handleDelete}
              className="rounded-full border border-red-100 bg-red-50 p-2.5 text-red-500 transition-all active:scale-95 dark:border-red-900/30 dark:bg-red-950/40"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className="flex-1 overflow-y-auto px-4 pb-28 pt-5"
      >
        {/* ... o resto do JSX permanece IGUAL ao que você já tem ... */}
        {/* (seção de saldo, transações, modais, etc.) */}
      </div>
    </div>
  )
}