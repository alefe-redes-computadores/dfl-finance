"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Save,
  Trash2,
  RefreshCw,
  User,
  Building2,
  AlertTriangle,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useContext_ } from "@/components/ContextToggle"
import { useAuth } from "@/lib/hooks/useAuth"
import { useSafeDb } from "@/hooks/useSafeDb"

function lightTap() {
  if (typeof window !== "undefined" && navigator.vibrate) navigator.vibrate(10)
}

function FieldLabel({
  children,
  optional = false,
}: {
  children: React.ReactNode
  optional?: boolean
}) {
  return (
    <label className="mb-2 block text-[13px] font-semibold text-slate-600 dark:text-slate-300">
      {children} {optional && <span className="text-slate-400">Opcional</span>}
    </label>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[28px] border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mb-4">
        <h2 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

const inputBase =
  "w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3.5 text-[15px] font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-900"

export default function NewContactPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")
  const { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const { user } = useAuth()
  const { safeAdd, safeUpdate, safeDelete } = useSafeDb()

  const { context, appMode } = useContext_()
  const effectiveContext = appMode === "personal_only" ? "personal" : context

  const [saving, setSaving] = useState(false)
  const [showDeleteSheet, setShowDeleteSheet] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [name, setName] = useState("")
  const [type, setType] = useState("individual")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [document, setDocument] = useState("")
  const [company, setCompany] = useState("")
  const [position, setPosition] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [notes, setNotes] = useState("")

  const { data: localContacts } = useLocalData({
    table: "contacts" as any,
    filters: { context: effectiveContext },
  })

  const contactData = useMemo(
    () => (localContacts || []).find((c: any) => c.id === editId) as any,
    [localContacts, editId]
  )

  useEffect(() => {
    if (contactData) {
      setName(contactData.name || "")
      setType(contactData.type || "individual")
      setEmail(contactData.email || "")
      setPhone(contactData.phone || "")
      setDocument(contactData.document || "")
      setCompany(contactData.company || "")
      setPosition(contactData.position || "")
      setAddress(contactData.address || "")
      setCity(contactData.city || "")
      setState(contactData.state || "")
      setZipCode(contactData.zip_code || "")
      setNotes(contactData.notes || "")
    }
  }, [contactData])

  const handleSave = async () => {
    if (!(name || "").trim()) {
      showToast("Preencha o nome do contato", "warning")
      errorHaptic()
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        type,
        email: email.trim() || null,
        phone: phone.trim() || null,
        document: document.trim() || null,
        company: company.trim() || null,
        position: position.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zip_code: zipCode.trim() || null,
        notes: notes.trim() || null,
        context: effectiveContext,
        updated_at: new Date().toISOString(),
      }

      if (editId) {
        const result = await safeUpdate("contacts", editId, payload)
        if (!result.success) throw new Error(result.error)
        showToast("Contato atualizado com sucesso!", "success")
      } else {
        const id = crypto.randomUUID()
        const fullPayload = {
          id,
          user_id: user?.id,
          ...payload,
          created_at: new Date().toISOString(),
          sync_status: "pending",
          sync_attempts: 0,
        }
        const result = await safeAdd("contacts", fullPayload)
        if (!result.success) throw new Error(result.error)
        showToast("Contato criado com sucesso!", "success")
      }

      success()
      router.back()
    } catch (err: any) {
      showToast(err?.message || "Erro ao salvar contato", "error")
      errorHaptic()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editId) return
    setDeleting(true)
    try {
      const result = await safeDelete("contacts", editId)
      if (!result.success) throw new Error(result.error)
      showToast("Contato excluído com sucesso!", "success")
      success()
      setShowDeleteSheet(false)
      router.back()
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, "error")
      errorHaptic()
    } finally {
      setDeleting(false)
    }
  }

  const contextTitle = effectiveContext === "dfl" ? "da Empresa" : "Pessoal"

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-4 pb-3 pt-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              lightTap()
              router.back()
            }}
            className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-slate-100 text-slate-700 transition active:scale-[0.98] dark:bg-slate-800 dark:text-slate-200"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="text-center">
            <h1 className="text-[18px] font-bold text-slate-900 dark:text-slate-100">
              {editId ? "Editar contato" : "Novo contato"}
            </h1>
            <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
              {contextTitle}
            </p>
          </div>

          <div className="w-11 flex justify-end">
            {editId ? (
              <button
                onClick={() => {
                  lightTap()
                  setShowDeleteSheet(true)
                }}
                className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-red-50 text-red-500 transition active:scale-[0.98] dark:bg-red-950/30"
                aria-label="Excluir"
              >
                <Trash2 size={19} />
              </button>
            ) : (
              <div className="h-11 w-11" />
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-32 pt-4">
        <div className="mx-auto max-w-xl space-y-4">
          <Section title="Tipo de contato">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  lightTap()
                  setType("individual")
                }}
                className={`flex items-center justify-center gap-2 rounded-[20px] px-4 py-3.5 text-[14px] font-semibold transition active:scale-[0.98] ${
                  type === "individual"
                    ? "bg-teal-500 text-white shadow-lg shadow-teal-500/20"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                <User size={16} />
                Pessoa física
              </button>

              <button
                type="button"
                onClick={() => {
                  lightTap()
                  setType("company")
                }}
                className={`flex items-center justify-center gap-2 rounded-[20px] px-4 py-3.5 text-[14px] font-semibold transition active:scale-[0.98] ${
                  type === "company"
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                <Building2 size={16} />
                Pessoa jurídica
              </button>
            </div>
          </Section>

          <Section title="Informações principais">
            <div>
              <FieldLabel>{type === "company" ? "Razão social" : "Nome completo"}</FieldLabel>
              <input
                type="text"
                autoComplete="name"
                autoCapitalize="words"
                placeholder={type === "company" ? "Nome da empresa" : "Nome da pessoa"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputBase}
              />
            </div>

            <div>
              <FieldLabel optional>{type === "company" ? "CNPJ" : "CPF"}</FieldLabel>
              <input
                type="text"
                inputMode="numeric"
                placeholder={type === "company" ? "00.000.000/0000-00" : "000.000.000-00"}
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                className={inputBase}
              />
            </div>
          </Section>

          <Section title="Contato">
            <div>
              <FieldLabel optional>Email</FieldLabel>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputBase}
              />
            </div>

            <div>
              <FieldLabel optional>Telefone</FieldLabel>
              <input
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputBase}
              />
            </div>
          </Section>

          {type === "individual" && (
            <Section title="Profissional">
              <div>
                <FieldLabel optional>Empresa</FieldLabel>
                <input
                  type="text"
                  autoCapitalize="words"
                  placeholder="Onde trabalha"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className={inputBase}
                />
              </div>

              <div>
                <FieldLabel optional>Cargo</FieldLabel>
                <input
                  type="text"
                  autoCapitalize="words"
                  placeholder="Cargo na empresa"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className={inputBase}
                />
              </div>
            </Section>
          )}

          <Section title="Endereço">
            <div>
              <FieldLabel optional>Endereço</FieldLabel>
              <input
                type="text"
                autoComplete="street-address"
                autoCapitalize="words"
                placeholder="Rua, número, bairro"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputBase}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <FieldLabel optional>Cidade</FieldLabel>
                <input
                  type="text"
                  autoComplete="address-level2"
                  autoCapitalize="words"
                  placeholder="Cidade"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputBase}
                />
              </div>

              <div className="sm:col-span-1">
                <FieldLabel optional>UF</FieldLabel>
                <input
                  type="text"
                  autoComplete="address-level1"
                  placeholder="SP"
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  className={inputBase}
                />
              </div>

              <div className="sm:col-span-1">
                <FieldLabel optional>CEP</FieldLabel>
                <input
                  type="text"
                  autoComplete="postal-code"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  className={inputBase}
                />
              </div>
            </div>
          </Section>

          <Section title="Observações">
            <div>
              <FieldLabel optional>Anotações internas</FieldLabel>
              <textarea
                placeholder="Detalhes adicionais..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className={`${inputBase} resize-none`}
              />
            </div>
          </Section>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200/80 bg-white/90 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto max-w-xl">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-teal-500 px-5 py-4 text-[15px] font-bold text-white shadow-xl shadow-teal-600/20 transition active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            {editId ? "Atualizar contato" : "Criar contato"}
          </button>
        </div>
      </div>

      {showDeleteSheet && (
        <div
          className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !deleting && setShowDeleteSheet(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-[32px] bg-white p-6 pb-8 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-6 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
                <AlertTriangle size={26} className="text-red-500" />
              </div>
              <h3 className="mb-1 text-[18px] font-bold text-slate-900 dark:text-slate-100">
                Excluir contato?
              </h3>
              <p className="max-w-[280px] text-[14px] text-slate-500 dark:text-slate-400">
                Essa ação não pode ser desfeita. O contato será removido permanentemente.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteSheet(false)}
                disabled={deleting}
                className="flex-1 rounded-[20px] bg-slate-100 px-4 py-3.5 text-[14px] font-semibold text-slate-700 transition active:scale-[0.98] disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-[20px] bg-red-500 px-4 py-3.5 text-[14px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
              >
                {deleting ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}