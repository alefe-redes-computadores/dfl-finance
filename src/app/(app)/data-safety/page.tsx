'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, FileSearch, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
import { createRecoveryBackup, downloadRecoveryBackup, validateRecoveryBackup, type RecoveryBackup } from '@/lib/recoveryBackup'
export default function DataSafetyPage() {
  const router = useRouter(), { user } = useAuth(), { context, appMode } = useContext_(), { showToast } = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false), [preview, setPreview] = useState<RecoveryBackup | null>(null)
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  const exportBackup = async () => {
    if (!user?.id || busy) return
    setBusy(true)
    try { downloadRecoveryBackup(await createRecoveryBackup(user.id, effectiveContext)); showToast('Backup completo gerado. Guarde o arquivo em local privado.', 'success') }
    catch (error: any) { showToast(error.message || 'Não foi possível gerar o backup.', 'error') }
    finally { setBusy(false) }
  }
  const inspect = async (file?: File) => {
    if (!file || !user?.id) return
    try { setPreview(validateRecoveryBackup(JSON.parse(await file.text()), user.id, effectiveContext)) }
    catch (error: any) { showToast(error.message || 'Backup inválido.', 'error') }
    finally { if (input.current) input.current.value = '' }
  }
  return <main className="mx-auto min-h-[100dvh] max-w-md bg-gray-50 px-4 pb-32 pt-4 dark:bg-slate-950">
    <header className="mb-5 flex items-center gap-3"><button type="button" aria-label="Voltar" onClick={() => router.back()} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 dark:text-white"><ArrowLeft size={20}/></button><h1 className="text-xl font-bold dark:text-white">Backup e recuperação</h1></header>
    <section className="rounded-3xl bg-white p-5 dark:bg-slate-900"><ShieldCheck className="text-teal-600"/><h2 className="mt-3 font-bold dark:text-white">Preservar os dados locais</h2><p className="mt-2 text-sm leading-6 text-gray-500">Inclui Empresa, Pessoal, as duas pernas de transferências e operações ainda não confirmadas. Comprovantes continuam como referências; seus arquivos não são incluídos.</p><button type="button" disabled={busy} onClick={() => void exportBackup()} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 font-bold text-white disabled:opacity-50"><Download size={18}/>{busy ? 'Preparando…' : 'Gerar backup completo'}</button><p className="mt-2 text-xs leading-5 text-gray-400">O arquivo contém dados financeiros privados. O download não confirma sincronização nem substitui backup remoto.</p></section>
    <section className="mt-4 rounded-3xl bg-white p-5 dark:bg-slate-900"><FileSearch className="text-blue-500"/><h2 className="mt-3 font-bold dark:text-white">Inspecionar backup</h2><p className="mt-2 text-sm leading-6 text-gray-500">Valide um arquivo sem alterar o saldo. A restauração automática antiga está bloqueada porque sobrescrevia registros financeiros sem reconciliação.</p><input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={event => void inspect(event.target.files?.[0])}/><button type="button" onClick={() => input.current?.click()} className="mt-4 h-12 w-full rounded-2xl border font-bold dark:border-slate-700 dark:text-white">Selecionar para inspecionar</button>{preview && <p role="status" className="mt-4 text-sm leading-6 text-gray-500">Backup válido de {Object.values(preview.tables).reduce((sum, rows) => sum + rows.length, 0)} registros. {preview.version === 2 ? 'Ambos os contextos e fila preservados.' : 'Formato antigo: somente um contexto; sem fila completa.'} Nenhum dado foi importado.</p>}</section>
  </main>
}
