'use client'

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Save, X, Wallet, Building2, CreditCard, PiggyBank, Loader2, ChevronDown } from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useAccountById } from "@/hooks/useAccountById"
import { useContext_ } from "@/components/ContextToggle"
import { useAuth } from "@/lib/hooks/useAuth"
import Skeleton from "@/components/Skeleton"
import { safeAdd, safeUpdate } from "@/lib/safeDb"
import { db } from "@/lib/db"

const ACCOUNT_TYPES = [
  { value: "checking", label: "Conta Corrente", icon: Wallet },
  { value: "savings", label: "Poupança", icon: PiggyBank },
  { value: "investment", label: "Investimento", icon: Building2 },
  { value: "credit_card", label: "Cartão de Crédito", icon: CreditCard },
  { value: "wallet", label: "Carteira", icon: Wallet },
  { value: "other", label: "Outro", icon: Wallet },
]

const safeNum = (val: any): number => {
  if (val === null || val === undefined || val === "") return 0
  if (typeof val === "number") return isNaN(val) ? 0 : val
  const parsed = parseFloat(String(val).replace(",", ".").replace(/[^0-9.-]+/g, ""))
  return isNaN(parsed) ? 0 : parsed
}

function AccountFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")
  const { context } = useContext_()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    type: "checking",
    bank: "",
    balance: "",
    color: "#0f766e",
    icon: "wallet",
  })

  // 🔥 USANDO useAccountById PARA EDIÇÃO
  const { data: accountData, loading: accountLoading } = useAccountById(editId)

  // Preenche formulário ao carregar dados da conta (apenas se houver dados)
  useEffect(() => {
    if (accountData) {
      setFormData({
        name: accountData.name || "",
        type: accountData.type || "checking",
        bank: accountData.bank || "",
        balance: String(accountData.balance || 0),
        color: accountData.color || "#0f766e",
        icon: accountData.icon || "wallet",
      })
    }
  }, [accountData])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      errorHaptic()
      showToast("❌ Usuário não autenticado.", "error")
      return
    }

    if (!formData.name.trim()) {
      errorHaptic()
      showToast("⚠️ Informe o nome da conta.", "warning")
      return
    }

    const amount = safeNum(formData.balance)

    setSaving(true)
    try {
      const payload = {
        name: formData.name.trim(),
        type: formData.type,
        bank: formData.bank.trim() || null,
        balance: amount,
        color: formData.color || "#0f766e",
        icon: formData.icon || "wallet",
        context,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      }

      let result

      if (editId) {
        result = await safeUpdate("accounts", editId, { ...payload, id: editId })
        if (result.success) {
          success()
          showToast("✅ Conta atualizada com sucesso!", "success")
        } else {
          throw new Error(result.error || "Erro ao atualizar conta")
        }
      } else {
        const newId = crypto.randomUUID()
        const newPayload = {
          ...payload,
          id: newId,
          created_at: new Date().toISOString(),
          sync_status: "pending",
          sync_attempts: 0,
        }
        result = await safeAdd("accounts", newPayload)
        if (result.success) {
          success()
          showToast("✅ Conta criada com sucesso!", "success")
        } else {
          throw new Error(result.error || "Erro ao criar conta")
        }
      }

      router.push("/accounts")
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ ${err?.message || "Erro ao salvar conta"}`, "error")
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    vibrate([5])
    router.push("/accounts")
  }

  // Skeleton durante carregamento da edição
  if (accountLoading && editId) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-gray-50 dark:bg-slate-950">
        <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 px-4 pb-4 pt-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-slate-800" />
        </div>
        <div className="flex-1 px-4 pt-6">
          <Skeleton count={5} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-50 dark:bg-slate-950">
      <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 px-4 pb-4 pt-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={handleCancel}
              className="rounded-full p-2 -ml-2 text-gray-700 transition-transform active:scale-95 dark:text-gray-200"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="truncate text-[18px] font-semibold text-gray-900 dark:text-gray-100">
              {editId ? "Editar conta" : "Nova conta"}
            </h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 px-4 pt-6 pb-28">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <label className="mb-2 block text-[13px] font-medium text-gray-600 dark:text-gray-300">
              Nome da conta *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ex: Conta corrente Nubank"
              className="w-full rounded-[18px] border border-gray-200 bg-gray-50 px-4 py-3.5 text-[15px] font-medium text-gray-900 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              required
            />
          </div>

          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <label className="mb-2 block text-[13px] font-medium text-gray-600 dark:text-gray-300">
              Tipo de conta
            </label>
            <div className="relative">
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full appearance-none rounded-[18px] border border-gray-200 bg-gray-50 px-4 py-3.5 text-[15px] font-medium text-gray-900 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
              >
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                <ChevronDown size={18} />
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <label className="mb-2 block text-[13px] font-medium text-gray-600 dark:text-gray-300">
              Banco / Instituição
            </label>
            <input
              type="text"
              name="bank"
              value={formData.bank}
              onChange={handleChange}
              placeholder="Ex: Nubank, Itaú, etc."
              className="w-full rounded-[18px] border border-gray-200 bg-gray-50 px-4 py-3.5 text-[15px] font-medium text-gray-900 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <label className="mb-2 block text-[13px] font-medium text-gray-600 dark:text-gray-300">
              Saldo inicial
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-medium text-gray-400">R$</span>
              <input
                type="number"
                name="balance"
                step="0.01"
                placeholder="0,00"
                value={formData.balance}
                onChange={handleChange}
                className="w-full rounded-[18px] border border-gray-200 bg-gray-50 px-4 py-3.5 text-[18px] font-semibold text-gray-900 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
          </div>

          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <label className="mb-2 block text-[13px] font-medium text-gray-600 dark:text-gray-300">
              Cor do ícone
            </label>
            <input
              type="color"
              name="color"
              value={formData.color}
              onChange={handleChange}
              className="h-12 w-full cursor-pointer rounded-[18px] border border-gray-200 bg-gray-50 p-1 outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 rounded-[22px] bg-gray-100 py-4 text-[15px] font-semibold text-gray-700 transition-colors hover:bg-gray-200 active:scale-[0.98] dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-[22px] bg-teal-600 py-4 text-[15px] font-semibold text-white shadow-lg shadow-teal-600/20 transition-colors hover:bg-teal-700 active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="mx-auto animate-spin" size={22} />
              ) : (
                editId ? "Atualizar" : "Criar conta"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default function AccountFormPage() {
  return (
    <Suspense fallback={<Skeleton count={5} />}>
      <AccountFormContent />
    </Suspense>
  )
}