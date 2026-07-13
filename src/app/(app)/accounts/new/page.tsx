'use client'

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, Save, Loader2, Wallet, Building2, PiggyBank, CreditCard, Briefcase } from "lucide-react"
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

  const { data: accounts } = useLocalData({ table: 'accounts' as any, filters: { context: effectiveContext } })

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
    <div className="flex flex-col min-h-[100dvh] bg-gray-50 dark:bg-slate-900 transition-colors">
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl pt-6 pb-4 px-4 border-b border-gray-100 dark:border-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => { vibrate([5]); router.back(); }} className="p-2 -ml-2 rounded-full text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 active:scale-95 transition-colors">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 tracking-tight">
              {editId ? "Editar Conta" : "Nova Conta"}
            </h1>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 pt-6 pb-24 space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-[28px] border border-gray-100 dark:border-slate-700/50 p-5 shadow-sm space-y-5">
          
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Nome da Conta</label>
            <input type="text" placeholder="Ex: Nubank, Caixa Empresa..." value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600 rounded-[16px] p-4 text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-teal-500/30 transition-all" />
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Instituição / Banco (Opcional)</label>
            <input type="text" placeholder="Ex: Itaú, Bradesco..." value={bank} onChange={(e) => setBank(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600 rounded-[16px] p-4 text-[15px] font-bold text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-teal-500/30 transition-all" />
          </div>

          {!editId && (
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Saldo Inicial</label>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600 rounded-[16px] p-4 focus-within:ring-2 focus-within:ring-teal-500/30 transition-all">
                <span className="text-[16px] text-gray-400 font-medium">R$</span>
                <input type="number" step="0.01" placeholder="0.00" value={balance} onChange={(e) => setBalance(e.target.value)} className="w-full bg-transparent text-[18px] font-black text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600" />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[28px] border border-gray-100 dark:border-slate-700/50 p-5 shadow-sm">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4 block">Tipo de Conta</label>
          <div className="grid grid-cols-2 gap-3">
            {ACCOUNT_TYPES.map((t) => {
              const Icon = t.icon
              const isSelected = type === t.id
              return (
                <button key={t.id} onClick={() => { vibrate([5]); setType(t.id); }} className={`flex flex-col items-center gap-2 p-4 rounded-[20px] border-2 transition-all active:scale-95 ${isSelected ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50 opacity-70 hover:opacity-100'}`}>
                  <Icon size={24} className={isSelected ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400'} />
                  <span className={`text-[12px] font-bold ${isSelected ? 'text-teal-700 dark:text-teal-300' : 'text-gray-500 dark:text-gray-400'}`}>{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-gray-100 dark:border-slate-800">
        <button onClick={() => { vibrate([10, 50]); handleSave(); }} disabled={saving} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[24px] font-bold text-[16px] shadow-lg shadow-teal-600/30 active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="animate-spin" size={22} /> : <Save size={22} />}
          {editId ? "Salvar Alterações" : "Criar Conta"}
        </button>
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

