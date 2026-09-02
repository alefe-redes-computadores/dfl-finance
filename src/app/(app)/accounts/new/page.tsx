'use client'

import { useState, useEffect, Suspense, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Loader2,
  ChevronDown,
  Wallet,
  Building2,
  CreditCard,
  PiggyBank,
  Landmark,
  Check,
  X
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useAccountById } from "@/hooks/useAccountById"
import { useLocalData } from "@/hooks/useLocalData"
import { useContext_ } from "@/components/ContextToggle"
import { useAuth } from "@/lib/hooks/useAuth"
import Skeleton from "@/components/Skeleton"
import { safeAdd, safeUpdate } from "@/lib/safeDb"
import BankLogo from '@/components/BankLogo'

const ACCOUNT_TYPES = [
  { value: "checking", label: "Conta Corrente", icon: Wallet },
  { value: "savings", label: "Poupança", icon: PiggyBank },
  { value: "investment", label: "Investimento", icon: Building2 },
  { value: "credit_card", label: "Cartão de Crédito", icon: CreditCard },
  { value: "wallet", label: "Carteira", icon: Wallet },
  { value: "other", label: "Outro", icon: Landmark },
]

const COLOR_OPTIONS = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#ea580c",
  "#dc2626",
  "#16a34a",
  "#d97706",
  "#db2777",
  "#0891b2",
  "#4f46e5",
]

const safeNum = (val: any): number => {
  if (val === null || val === undefined || val === "") return 0
  if (typeof val === "number") return isNaN(val) ? 0 : val
  const parsed = parseFloat(String(val).replace(",", ".").replace(/[^0-9.-]+/g, ""))
  return isNaN(parsed) ? 0 : parsed
}

function formatCurrencyPreview(value: string) {
  const amount = safeNum(value)
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount)
}

function AccountFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // ✅ PEGA O ID CORRETAMENTE
  const rawEditId = searchParams?.get("edit")
  const editId = useMemo(() => {
    if (!rawEditId || rawEditId === 'null' || rawEditId === 'undefined') return null
    return rawEditId.trim()
  }, [rawEditId])
  
  const { context } = useContext_()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()

  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(!editId)
  const [formData, setFormData] = useState({
    name: "",
    type: "checking",
    bank: "",
    balance: "",
    color: "#0f766e",
    icon: "wallet",
  })

  // ✅ SÓ CHAMA O HOOK SE TIVER ID VÁLIDO
  const { data: accountData, loading: accountLoading, notFound } = useAccountById(editId)

  useEffect(() => {
    if (editId && accountData && !initialized) {
      setFormData({
        name: accountData.name || "",
        type: accountData.type || "checking",
        bank: accountData.bank || "",
        balance: String(accountData.balance || 0),
        color: accountData.color || "#0f766e",
        icon: accountData.icon || "wallet",
      })
      setInitialized(true)
    }

    if (!editId && !initialized) {
      setInitialized(true)
    }
  }, [editId, accountData, initialized])

  if (editId && notFound && !accountLoading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f8f9fa] p-6 dark:bg-slate-950">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] border border-red-100 bg-red-50 text-red-500 shadow-sm dark:border-red-900/30 dark:bg-red-500/10">
            <X size={32} />
          </div>
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">Conta não encontrada</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">A conta que você está tentando editar pode ter sido excluída.</p>
          <button
            onClick={() => router.push('/accounts')}
            className="mt-6 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-full font-semibold transition-colors active:scale-95"
          >
            Voltar para listagem
          </button>
        </div>
      </div>
    )
  }

  if (editId && accountLoading) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[#f8f9fa] dark:bg-slate-950">
        <div className="sticky top-0 z-30 border-b border-gray-200/60 bg-[#f8f9fa]/92 px-4 pb-3 pt-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/92">
          <div className="rounded-[24px] border border-gray-200/70 bg-white/90 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
            <div className="h-10 w-10 animate-pulse rounded-[16px] bg-gray-200 dark:bg-slate-700" />
          </div>
        </div>
        <div className="flex-1 px-4 pt-4">
          <Skeleton count={5} height="96px" borderRadius="24px" />
        </div>
      </div>
    )
  }

  if (!initialized) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[#f8f9fa] dark:bg-slate-950">
        <div className="flex-1 px-4 pt-4">
          <Skeleton count={5} height="96px" borderRadius="24px" />
        </div>
      </div>
    )
  }

  const selectedType =
    ACCOUNT_TYPES.find((item) => item.value === formData.type) || ACCOUNT_TYPES[0]

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectColor = (color: string) => {
    vibrate([5])
    setFormData((prev) => ({ ...prev, color }))
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
      const basePayload = {
        name: formData.name.trim(),
        type: formData.type,
        bank: formData.bank.trim() || null,
        color: formData.color || "#0f766e",
        icon: formData.icon || "wallet",
        user_id: user.id,
        updated_at: new Date().toISOString(),
      }

      if (editId) {
        const result = await safeUpdate("accounts", editId, {
          ...basePayload,
          id: editId,
          context: accountData?.context || context,
        })
        if (!result.success) {
          throw new Error(result.error || "Erro ao atualizar conta")
        }
        success()
        showToast("✅ Conta atualizada com sucesso!", "success")
      } else {
        const newId = crypto.randomUUID()
        const newPayload = {
          ...basePayload,
          id: newId,
          balance: amount,
          context,
          created_at: new Date().toISOString(),
          sync_status: "pending",
          sync_attempts: 0,
        }

        const result = await safeAdd("accounts", newPayload)
        if (!result.success) {
          throw new Error(result.error || "Erro ao criar conta")
        }
        success()
        showToast("✅ Conta criada com sucesso!", "success")
      }

      router.replace("/accounts")
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ ${err?.message || "Erro ao salvar conta"}`, "error")
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    vibrate([5])
    router.replace("/accounts")
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f8f9fa] transition-colors duration-300 dark:bg-slate-950">
      <div className="sticky top-0 z-30 border-b border-gray-200/60 bg-[#f8f9fa]/92 px-4 pb-3 pt-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/92">
        <div className="rounded-[24px] border border-gray-200/70 bg-white/90 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={handleCancel}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-gray-200/70 bg-gray-50 text-gray-500 transition-colors active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900/50 dark:text-gray-300"
              >
                <ArrowLeft size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="truncate text-[24px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  {editId ? "Editar conta" : "Nova conta"}
                </h1>
                <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">
                  Configure nome, tipo, banco e saldo inicial
                </p>
              </div>
            </div>

            <BankLogo color={formData.color} name={formData.name} size="lg" />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 px-4 pb-28 pt-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <div className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <label className="mb-2 ml-1 block text-[12px] font-semibold text-gray-500 dark:text-gray-400">
              Nome da conta
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ex: Conta corrente Nubank"
              className="w-full rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] font-medium text-gray-800 outline-none transition-all placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:placeholder:text-gray-500"
              required
            />
          </div>

          <div className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <label className="mb-2 ml-1 block text-[12px] font-semibold text-gray-500 dark:text-gray-400">
              Tipo de conta
            </label>

            <div className="relative">
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full appearance-none rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] font-medium text-gray-800 outline-none transition-all focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200"
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

            <div className="mt-4 rounded-[18px] border border-gray-200/70 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <BankLogo color={formData.color} name={formData.name} size="md" />
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                    Pré-visualização
                  </p>
                  <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                    {selectedType.label}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <label className="mb-2 ml-1 block text-[12px] font-semibold text-gray-500 dark:text-gray-400">
              Banco / Instituição
            </label>
            <input
              type="text"
              name="bank"
              value={formData.bank}
              onChange={handleChange}
              placeholder="Ex: Nubank, Itaú, Inter..."
              className="w-full rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] font-medium text-gray-800 outline-none transition-all placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:placeholder:text-gray-500"
            />
          </div>

          <div className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <label className="mb-2 ml-1 block text-[12px] font-semibold text-gray-500 dark:text-gray-400">
              Saldo inicial
            </label>

            <div className="rounded-[18px] border border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-1 text-[12px] font-medium text-gray-400 dark:text-gray-500">
                Valor informado
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-semibold text-gray-400">R$</span>
                <input
                  type="number"
                  name="balance"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.balance}
                  onChange={handleChange}
                  className="w-full bg-transparent text-[20px] font-semibold text-gray-900 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-600"
                />
              </div>
            </div>

            <div className="mt-3 rounded-[16px] bg-teal-50 px-4 py-3 dark:bg-teal-950/30">
              <p className="text-[12px] font-medium text-teal-700 dark:text-teal-300">
                Prévia do saldo
              </p>
              <p className="mt-0.5 text-[16px] font-bold text-teal-700 dark:text-teal-200">
                {formatCurrencyPreview(formData.balance)}
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <label className="mb-3 ml-1 block text-[12px] font-semibold text-gray-500 dark:text-gray-400">
              Cor da conta
            </label>

            <div className="flex flex-wrap gap-3">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleSelectColor(color)}
                  className={`relative h-10 w-10 rounded-full transition-transform active:scale-[0.95] ${
                    formData.color === color
                      ? "scale-110 ring-2 ring-gray-300 ring-offset-2 ring-offset-white dark:ring-slate-500 dark:ring-offset-slate-800"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Selecionar cor ${color}`}
                >
                  {formData.color === color && (
                    <Check
                      size={16}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 rounded-[20px] bg-gray-100 py-4 text-[15px] font-bold text-gray-600 transition-colors active:scale-[0.98] dark:bg-slate-700 dark:text-gray-300"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-[20px] bg-teal-600 py-4 text-[15px] font-bold text-white shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <Check size={18} />
                  {editId ? "Atualizar conta" : "Criar conta"}
                </>
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
    <Suspense fallback={<Skeleton count={5} height="96px" borderRadius="24px" />}>
      <AccountFormContent />
    </Suspense>
  )
}