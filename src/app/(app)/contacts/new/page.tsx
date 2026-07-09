"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft, Save, Trash2, RefreshCw, User, Building2,
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { useLocalData } from "@/hooks/useLocalData"
import { useContext_ } from '@/components/ContextToggle'
import { useAuth } from "@/lib/hooks/useAuth"
import { db } from '@/lib/db'

export default function NewContactPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")
  const { showToast } = useToast()
  const { success, error: errorHaptic } = useHapticFeedback()
  const { context } = useContext_()
  const { user } = useAuth()

  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef(0)

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
    table: 'contacts' as any,
    filters: { context },
  })

  const contactData = localContacts?.find((c: any) => c.id === editId) as any

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

  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY }, [])
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 60 && !refreshing) {
        setRefreshing(true)
        setTimeout(() => setRefreshing(false), 600)
      }
    }
  }, [refreshing])

  // 🔥 SALVAR CONTATO ATÔMICO
  const handleSave = async () => {
    if (!name.trim()) {
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
        context,
        updated_at: new Date().toISOString(),
      }

      await db.transaction('rw', 'contacts', 'syncQueue', async () => {
        if (editId) {
          await db.table('contacts').update(editId, payload)
          await db.table('syncQueue').add({ table: 'contacts', operation: 'update', record_id: editId, data: payload, user_id: user!.id, created_at: new Date().toISOString() })
        } else {
          const id = crypto.randomUUID()
          const fullPayload = {
            id,
            user_id: user!.id,
            ...payload,
            created_at: new Date().toISOString(),
            sync_status: 'pending',
            sync_attempts: 0,
          }
          await db.table('contacts').add(fullPayload)
          await db.table('syncQueue').add({ table: 'contacts', operation: 'create', record_id: id, data: fullPayload, user_id: user!.id, created_at: new Date().toISOString() })
        }
      })

      showToast(editId ? "Contato atualizado com sucesso!" : "Contato criado com sucesso!", "success")
      success()
      router.back()
    } catch (err: any) {
      showToast(err?.message || "Erro ao salvar contato", "error")
      errorHaptic()
    } finally {
      setSaving(false)
    }
  }

  // 🔥 EXCLUIR CONTATO ATÔMICO
  const handleDelete = async () => {
    if (!editId) return
    if (!confirm("Tem certeza que deseja excluir este contato?")) return
    try {
      await db.transaction('rw', 'contacts', 'syncQueue', async () => {
        await db.table('contacts').delete(editId)
        await db.table('syncQueue').add({ table: 'contacts', operation: 'delete', record_id: editId, user_id: user!.id, created_at: new Date().toISOString() })
      })
      showToast("Contato excluído com sucesso!", "success")
      success()
      router.back()
    } catch {
      showToast("Erro ao excluir contato", "error")
      errorHaptic()
    }
  }

  const contextTitle = (context as string) === "pj" ? "da Empresa" : "Pessoal"

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Voltar"><ArrowLeft size={20} /></button>
          <div className="text-center">
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">{editId ? "Editar" : "Novo"} Contato</h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{contextTitle}</p>
          </div>
          <div className="flex gap-2">
            {editId && <button onClick={handleDelete} className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors" aria-label="Excluir"><Trash2 size={20} /></button>}
            <button onClick={handleSave} disabled={saving} className="p-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white shadow-md shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-50" aria-label="Salvar">{saving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}</button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">Tipo</label>
          <div className="flex gap-2">
            <button onClick={() => setType("individual")} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${type === "individual" ? "bg-teal-500 text-white shadow-md shadow-teal-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}><User size={16} />Pessoa Física</button>
            <button onClick={() => setType("company")} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${type === "company" ? "bg-blue-500 text-white shadow-md shadow-blue-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}><Building2 size={16} />Pessoa Jurídica</button>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">{type === "company" ? "Razão Social" : "Nome Completo"}</label>
          <input type="text" placeholder={type === "company" ? "Nome da empresa" : "Nome da pessoa"} value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400" />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">{type === "company" ? "CNPJ" : "CPF"} (opcional)</label>
          <input type="text" placeholder={type === "company" ? "00.000.000/0000-00" : "000.000.000-00"} value={document} onChange={(e) => setDocument(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400" />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">Email (opcional)</label>
          <input type="email" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400" />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">Telefone (opcional)</label>
          <input type="tel" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400" />
        </div>

        {type === "individual" && (
          <>
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">Empresa (opcional)</label>
              <input type="text" placeholder="Onde trabalha" value={company} onChange={(e) => setCompany(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">Cargo (opcional)</label>
              <input type="text" placeholder="Cargo na empresa" value={position} onChange={(e) => setPosition(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400" />
            </div>
          </>
        )}

        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">Endereço (opcional)</label>
          <input type="text" placeholder="Rua, número, bairro" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">Cidade</label><input type="text" placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400" /></div>
          <div><label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">UF</label><input type="text" placeholder="SP" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} className="w-full px-3 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400" /></div>
          <div><label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">CEP</label><input type="text" placeholder="00000-000" value={zipCode} onChange={(e) => setZipCode(e.target.value)} className="w-full px-3 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400" /></div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">Observações (opcional)</label>
          <textarea placeholder="Detalhes adicionais..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400 resize-none" />
        </div>

        <div className="fixed bottom-20 left-0 right-0 px-4 z-20">
          <button onClick={handleSave} disabled={saving} className="w-full py-4 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white font-black text-base shadow-xl shadow-teal-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}{editId ? "Atualizar Contato" : "Criar Contato"}
          </button>
        </div>
      </div>
    </div>
  )
}
