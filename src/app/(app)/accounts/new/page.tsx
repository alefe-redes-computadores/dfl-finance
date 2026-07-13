'use client'

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ChevronLeft,
  Save,
  Loader2,
  Wallet,
  Building2,
  PiggyBank,
  CreditCard,
  Briefcase,
  Check
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSafeDb } from '@/hooks/useSafeDb'
import Skeleton from '@/components/Skeleton'

const ACCOUNT_TYPES = [
  { id: 'checking', label: 'Corrente', icon: Wallet },
  { id: 'savings', label: 'Poupança', icon: PiggyBank },
  { id: 'investment', label: 'Investimento', icon: Building2 },
  { id: 'credit_card', label: 'Cartão', icon: CreditCard },
  { id: 'wallet', label: 'Carteira', icon: Wallet },
  { id: 'other', label: 'Outro', icon: Briefcase },
]

function NewAccountContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { effectiveContext } = useContext_()
  const { user } = useAuth()
  const { safeAdd, safeUpdate } = useSafeDb()

  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState("checking")
  const [bank, setBank] = useState("")
  const [balance, setBalance] = useState("")

  const { data: accounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context: effectiveContext }
  })

  useEffect(() => {
    if (editId && accounts?.length > 0) {
      const acc = accounts.find((a: any) => a.id === editId)
      if (acc) {
        setName(acc.name || "")
        setType(acc.type || "checking")
        setBank(acc.bank || "")
        setBalance(acc.balance ? String(acc.balance) : "0")
      }
    }
  }, [editId, accounts])

  const handleSave = async () => {
    if (!name.trim()) {
      errorHaptic()
      showToast("⚠️ O nome da conta é obrigatório", "warning")
      return
    }

    setSaving(true)

    try {
      const payload = {
        name: name.trim(),
        type,
        bank: bank.trim(),
        balance: parseFloat(balance.replace(',', '.')) || 0,
        context: effectiveContext,
        updated_at: new Date().toISOString(),
      }

      if (editId) {
        const res = await safeUpdate('accounts', editId, payload)
        if (!res.success) throw new Error(res.error)

        success()
        showToast("✅ Conta atualizada!", "success")
      } else {
        const fullPayload = {
          id: crypto.randomUUID(),
          user_id: user?.id,
          ...payload,
          created_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0
        }

        const res = await safeAdd('accounts', fullPayload)
        if (!res.success) throw new Error(res.error)

        success()
        showToast("✅ Conta criada!", "success")
      }

      router.back()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-50 dark:bg-slate-950">
      <div className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 px-4 pb-4 pt-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              vibrate([5])
              router.back()
            }}
            className="rounded-full p-2 -ml-2 text-gray-500 transition-colors active:scale-95 dark:text-gray-300"
          >
            <ChevronLeft size={24} />
          </button>

          <div>
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
              {editId ? "Editar cadastro" : "Nova conta"}
            </p>
            <h1 className="text-[20px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {editId ? "Editar Conta" : "Nova Conta"}
            </h1>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 pb-28 pt-5">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <section className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5">
              <h2 className="text-[16px] font-semibold text-gray-900 dark:text-gray-100">
                Dados principais
              </h2>
              <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                Defina nome, instituição e saldo inicial da conta
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-[12px] font-medium text-gray-500 dark:text-gray-400">
                  Nome da conta
                </label>
                <input
                  type="text"
                  placeholder="Ex: Nubank, Caixa Empresa..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-[18px] border border-gray-200 bg-gray-50 px-4 py-4 text-[15px] font-medium text-gray-900 outline-none transition-all placeholder:text-gray-300 focus:border-teal-300 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-800 dark:bg-slate-800 dark:text-gray-100 dark:placeholder:text-gray-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-[12px] font-medium text-gray-500 dark:text-gray-400">
                  Instituição / banco
                </label>
                <input
                  type="text"
                  placeholder="Ex: Itaú, Bradesco..."
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  className="w-full rounded-[18px] border border-gray-200 bg-gray-50 px-4 py-4 text-[15px] font-medium text-gray-900 outline-none transition-all placeholder:text-gray-300 focus:border-teal-300 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-800 dark:bg-slate-800 dark:text-gray-100 dark:placeholder:text-gray-600"
                />
              </div>

              {!editId && (
                <div>
                  <label className="mb-2 block text-[12px] font-medium text-gray-500 dark:text-gray-400">
                    Saldo inicial
                  </label>

                  <div className="flex items-center gap-2 rounded-[18px] border border-gray-200 bg-gray-50 px-4 py-4 transition-all focus-within:border-teal-300 focus-within:ring-4 focus-within:ring-teal-500/10 dark:border-slate-800 dark:bg-slate-800">
                    <span className="text-[16px] font-medium text-gray-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={balance}
                      onChange={(e) => setBalance(e.target.value)}
                      className="w-full bg-transparent text-[20px] font-semibold tracking-tight text-gray-900 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-600"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5">
              <h2 className="text-[16px] font-semibold text-gray-900 dark:text-gray-100">
                Tipo de conta
              </h2>
              <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                Escolha a categoria que melhor representa esta conta
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {ACCOUNT_TYPES.map((t) => {
                const Icon = t.icon
                const isSelected = type === t.id

                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      vibrate([5])
                      setType(t.id)
                    }}
                    className={`relative flex min-h-[92px] flex-col items-start justify-between rounded-[20px] border p-4 text-left transition-all active:scale-95 ${
                      isSelected
                        ? 'border-teal-200 bg-teal-50 dark:border-teal-900/40 dark:bg-teal-950/30'
                        : 'border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-800/70'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-[14px] ${
                        isSelected
                          ? 'bg-white text-teal-700 dark:bg-slate-900 dark:text-teal-300'
                          : 'bg-white text-gray-500 dark:bg-slate-900 dark:text-gray-300'
                      }`}
                    >
                      <Icon size={20} />
                    </div>

                    <div className="flex w-full items-end justify-between gap-2">
                      <span
                        className={`text-[13px] font-medium ${
                          isSelected
                            ? 'text-teal-800 dark:text-teal-200'
                            : 'text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {t.label}
                      </span>

                      {isSelected && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-white">
                          <Check size={14} />
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white/92 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/92">
        <div className="mx-auto w-full max-w-2xl">
          <button
            onClick={() => {
              vibrate([10, 50])
              handleSave()
            }}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-teal-600 py-4 text-[16px] font-semibold text-white shadow-lg shadow-teal-600/20 transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={22} /> : <Save size={20} />}
            {editId ? "Salvar alterações" : "Criar conta"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NewAccountPage() {
  return (
    <Suspense fallback={<Skeleton count={4} />}>
      <NewAccountContent />
    </Suspense>
  )
}