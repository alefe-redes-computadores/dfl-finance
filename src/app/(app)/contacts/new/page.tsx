// src/app/(app)/contacts/new/page.tsx
'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronUp,
  Save,
  Trash2,
  User,
} from 'lucide-react'

import Skeleton from '@/components/Skeleton'
import { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
import { useContactById } from '@/hooks/useContactById'
import { useContactsList } from '@/hooks/useContactsList'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  getContactEntityType,
  getContactRelationshipType,
  normalizeContactSearch,
  type ContactEntityType,
  type ContactRelationshipType,
} from '@/lib/contactOperations'

const inputBase =
  'w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-teal-500 dark:focus:bg-slate-900'

function FieldLabel({
  children,
  optional = false,
}: {
  children: React.ReactNode
  optional?: boolean
}) {
  return (
    <label className="mb-1.5 ml-1 flex items-center gap-1 text-[12px] font-semibold text-slate-600 dark:text-slate-400">
      {children}
      {optional && <span className="font-normal text-slate-400">· opcional</span>}
    </label>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[26px] border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4">
        <h2 className="text-[14px] font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            {subtitle}
          </p>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function ContactForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawEditId = searchParams.get('edit')
  const editId = useMemo(() => rawEditId?.trim() || null, [rawEditId])

  const { showToast } = useToast()
  const { vibrate, success, error: hapticError } = useHapticFeedback()
  const { user } = useAuth()
  const { safeAdd, safeUpdate, safeDelete } = useSafeDb()
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  const { data: contact, loading, notFound } = useContactById(editId)
  const recordContext =
    editId && contact?.context
      ? contact.context
      : effectiveContext

  const { data: contacts } = useContactsList(recordContext)

  const [initialized, setInitialized] = useState(!editId)
  const [saving, setSaving] = useState(false)
  const [showDeleteSheet, setShowDeleteSheet] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showMore, setShowMore] = useState(false)

  const [name, setName] = useState('')
  const [entityType, setEntityType] =
    useState<ContactEntityType>('individual')
  const [relationshipType, setRelationshipType] =
    useState<ContactRelationshipType>('other')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [documentValue, setDocumentValue] = useState('')
  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!editId || !contact || initialized) return

    setName(contact.name || '')
    setEntityType(getContactEntityType(contact))
    setRelationshipType(getContactRelationshipType(contact))
    setEmail(contact.email || '')
    setPhone(contact.phone || '')
    setDocumentValue(contact.document || '')
    setCompany(contact.company || '')
    setPosition(contact.position || '')
    setAddress(contact.address || '')
    setCity(contact.city || '')
    setState(contact.state || '')
    setZipCode(contact.zip_code || '')
    setNotes(contact.notes || '')
    setShowMore(
      Boolean(
        contact.company ||
          contact.position ||
          contact.address ||
          contact.city ||
          contact.state ||
          contact.zip_code ||
          contact.notes
      )
    )
    setInitialized(true)
  }, [contact, editId, initialized])

  const duplicate = useMemo(() => {
    const normalized = normalizeContactSearch(name)
    if (!normalized) return null

    return contacts.find(
      (item) =>
        item.id !== editId &&
        normalizeContactSearch(item.name) === normalized
    )
  }, [contacts, editId, name])

  if (editId && notFound && !loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-4 text-center dark:bg-slate-950">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
          <User size={31} className="text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Contato não encontrado
        </h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500 dark:text-slate-400">
          Esse contato pode ter sido excluído ou não pertence ao usuário atual.
        </p>
        <button
          type="button"
          onClick={() => router.push('/contacts')}
          className="mt-6 rounded-full bg-teal-600 px-6 py-3 font-semibold text-white"
        >
          Voltar para contatos
        </button>
      </div>
    )
  }

  if ((editId && loading) || !initialized) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 px-4 pt-5 dark:bg-slate-950">
        <Skeleton count={7} />
      </div>
    )
  }

  const handleSave = async () => {
    if (saving) return

    if (!user?.id) {
      hapticError()
      showToast('Sessão expirada. Entre novamente para salvar.', 'error')
      return
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      hapticError()
      showToast('Informe o nome do contato.', 'warning')
      return
    }

    if (duplicate) {
      hapticError()
      showToast(`Já existe um contato chamado ${duplicate.name}.`, 'warning')
      return
    }

    setSaving(true)

    try {
      const payload = {
        name: trimmedName,
        type: entityType,
        entity_type: entityType,
        relationship_type: relationshipType,
        email: email.trim() || null,
        phone: phone.trim() || null,
        document: documentValue.trim() || null,
        company: company.trim() || null,
        position: position.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim().toUpperCase() || null,
        zip_code: zipCode.trim() || null,
        notes: notes.trim() || null,
        color:
          contact?.color ||
          (entityType === 'company' ? '#3b82f6' : '#14b8a6'),
        icon:
          contact?.icon ||
          (entityType === 'company' ? 'Building2' : 'User'),
        context: recordContext,
      }

      if (editId) {
        const result = await safeUpdate('contacts', editId, payload)
        if (!result.success) throw new Error(result.error)

        success()
        showToast('Contato atualizado.', 'success')
        router.replace(`/contacts/details?id=${editId}`)
        return
      }

      const result = await safeAdd('contacts', {
        id: crypto.randomUUID(),
        user_id: user.id,
        ...payload,
      })

      if (!result.success) throw new Error(result.error)

      success()
      showToast('Contato criado.', 'success')

      if (result.id) {
        router.replace(`/contacts/details?id=${result.id}`)
      } else {
        router.replace('/contacts')
      }
    } catch (error: any) {
      hapticError()
      showToast(error?.message || 'Erro ao salvar contato.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editId || deleting) return

    setDeleting(true)
    try {
      const result = await safeDelete('contacts', editId)
      if (!result.success) throw new Error(result.error)

      success()
      showToast('Contato excluído. O histórico financeiro foi preservado.', 'success')
      setShowDeleteSheet(false)
      router.replace('/contacts')
    } catch (error: any) {
      hapticError()
      showToast(error?.message || 'Erro ao excluir contato.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const entityOptions: Array<{
    key: ContactEntityType
    label: string
    icon: typeof User
  }> = [
    { key: 'individual', label: 'Pessoa física', icon: User },
    { key: 'company', label: 'Pessoa jurídica', icon: Building2 },
  ]

  const relationshipOptions: Array<{
    key: ContactRelationshipType
    label: string
  }> = [
    { key: 'customer', label: 'Cliente' },
    { key: 'supplier', label: 'Fornecedor' },
    { key: 'both', label: 'Cliente e fornecedor' },
    { key: 'other', label: 'Outro contato' },
  ]

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/92 px-4 pb-3 pt-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/92">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              vibrate([5])
              router.back()
            }}
            className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-slate-100 text-slate-700 transition active:scale-95 dark:bg-slate-800 dark:text-slate-200"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="min-w-0 flex-1 text-center">
            <h1 className="text-[18px] font-bold text-slate-900 dark:text-slate-100">
              {editId ? 'Editar contato' : 'Novo contato'}
            </h1>
            <p className="text-[11px] text-slate-400">
              {recordContext === 'dfl' ? 'Empresa' : 'Pessoal'}
              {editId ? ' · contexto preservado' : ''}
            </p>
          </div>

          {editId ? (
            <button
              type="button"
              onClick={() => {
                vibrate([10])
                setShowDeleteSheet(true)
              }}
              className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-red-50 text-red-500 transition active:scale-95 dark:bg-red-950/30"
              aria-label="Excluir contato"
            >
              <Trash2 size={18} />
            </button>
          ) : (
            <div className="h-11 w-11" />
          )}
        </div>
      </header>

      <main className="flex-1 px-4 pb-32 pt-4">
        <div className="mx-auto max-w-xl space-y-4">
          <Section
            title="Como este contato participa do financeiro?"
            subtitle="Isso ajuda a organizar clientes e fornecedores sem confundir com pessoa física ou jurídica."
          >
            <div className="grid grid-cols-2 gap-2">
              {relationshipOptions.map((option) => {
                const active = relationshipType === option.key
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      vibrate([5])
                      setRelationshipType(option.key)
                    }}
                    className={`rounded-[17px] border px-3 py-3 text-[12px] font-semibold transition active:scale-[0.98] ${
                      active
                        ? 'border-teal-500 bg-teal-50 text-teal-700 ring-2 ring-teal-500/10 dark:bg-teal-950/30 dark:text-teal-400'
                        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title="Tipo de cadastro">
            <div className="grid grid-cols-2 gap-3">
              {entityOptions.map((option) => {
                const Icon = option.icon
                const active = entityType === option.key
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      vibrate([5])
                      setEntityType(option.key)
                    }}
                    className={`flex items-center justify-center gap-2 rounded-[19px] border px-4 py-3.5 text-[13px] font-semibold transition active:scale-[0.98] ${
                      active
                        ? option.key === 'company'
                          ? 'border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                          : 'border-teal-500 bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <Icon size={16} />
                    {option.label}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title="Informações principais">
            <div>
              <FieldLabel>
                {entityType === 'company' ? 'Razão social' : 'Nome completo'}
              </FieldLabel>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={
                  entityType === 'company' ? 'Nome da empresa' : 'Nome da pessoa'
                }
                autoCapitalize="words"
                autoComplete="name"
                className={inputBase}
              />
              {duplicate && (
                <p className="mt-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  Já existe um contato com esse nome.
                </p>
              )}
            </div>

            <div>
              <FieldLabel optional>
                {entityType === 'company' ? 'CNPJ' : 'CPF'}
              </FieldLabel>
              <input
                value={documentValue}
                onChange={(event) => setDocumentValue(event.target.value)}
                placeholder={
                  entityType === 'company'
                    ? '00.000.000/0000-00'
                    : '000.000.000-00'
                }
                inputMode="numeric"
                className={inputBase}
              />
            </div>
          </Section>

          <Section title="Contato">
            <div>
              <FieldLabel optional>Telefone</FieldLabel>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="(00) 00000-0000"
                inputMode="tel"
                autoComplete="tel"
                className={inputBase}
              />
            </div>

            <div>
              <FieldLabel optional>Email</FieldLabel>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@exemplo.com"
                inputMode="email"
                autoComplete="email"
                className={inputBase}
              />
            </div>
          </Section>

          <button
            type="button"
            onClick={() => {
              vibrate([5])
              setShowMore((current) => !current)
            }}
            className="flex w-full items-center justify-between rounded-[22px] border border-slate-200/70 bg-white px-4 py-4 text-left shadow-sm transition active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200">
                Informações complementares
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Empresa, endereço e observações
              </p>
            </div>
            {showMore ? (
              <ChevronUp size={18} className="text-slate-400" />
            ) : (
              <ChevronDown size={18} className="text-slate-400" />
            )}
          </button>

          {showMore && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
              <Section
                title={entityType === 'company' ? 'Empresa' : 'Profissional'}
              >
                <div>
                  <FieldLabel optional>
                    {entityType === 'company'
                      ? 'Nome fantasia'
                      : 'Empresa onde trabalha'}
                  </FieldLabel>
                  <input
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    placeholder={
                      entityType === 'company'
                        ? 'Nome comercial'
                        : 'Empresa ou organização'
                    }
                    autoCapitalize="words"
                    className={inputBase}
                  />
                </div>

                {entityType === 'individual' && (
                  <div>
                    <FieldLabel optional>Cargo</FieldLabel>
                    <input
                      value={position}
                      onChange={(event) => setPosition(event.target.value)}
                      placeholder="Cargo ou função"
                      autoCapitalize="words"
                      className={inputBase}
                    />
                  </div>
                )}
              </Section>

              <Section title="Endereço">
                <div>
                  <FieldLabel optional>Endereço</FieldLabel>
                  <input
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Rua, número, bairro"
                    autoComplete="street-address"
                    autoCapitalize="words"
                    className={inputBase}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <FieldLabel optional>Cidade</FieldLabel>
                    <input
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      placeholder="Cidade"
                      autoComplete="address-level2"
                      autoCapitalize="words"
                      className={inputBase}
                    />
                  </div>
                  <div>
                    <FieldLabel optional>UF</FieldLabel>
                    <input
                      value={state}
                      onChange={(event) =>
                        setState(event.target.value.toUpperCase().slice(0, 2))
                      }
                      placeholder="MG"
                      autoComplete="address-level1"
                      className={inputBase}
                    />
                  </div>
                  <div>
                    <FieldLabel optional>CEP</FieldLabel>
                    <input
                      value={zipCode}
                      onChange={(event) => setZipCode(event.target.value)}
                      placeholder="00000-000"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      className={inputBase}
                    />
                  </div>
                </div>
              </Section>

              <Section title="Observações">
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Anotações internas sobre o contato..."
                  rows={4}
                  className={`${inputBase} resize-none`}
                />
              </Section>
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200/80 bg-white/92 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/92">
        <div className="mx-auto max-w-xl">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-teal-600 px-5 py-4 text-[15px] font-bold text-white shadow-xl shadow-teal-600/20 transition active:scale-[0.98] disabled:opacity-50"
          >
            <Save size={18} />
            {saving
              ? 'Salvando...'
              : editId
                ? 'Salvar alterações'
                : 'Criar contato'}
          </button>
        </div>
      </div>

      {showDeleteSheet && (
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !deleting && setShowDeleteSheet(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-[32px] bg-white p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-2xl dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-6 h-1.5 w-11 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/30">
                <AlertTriangle size={24} />
              </div>
              <h2 className="text-[18px] font-bold text-slate-900 dark:text-slate-100">
                Excluir contato?
              </h2>
              <p className="mx-auto mt-2 max-w-[300px] text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                O cadastro será removido, mas transações, cobranças e histórico
                continuarão existindo sem o vínculo.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteSheet(false)}
                className="flex-1 rounded-[20px] bg-slate-100 px-4 py-3.5 text-[14px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="flex-1 rounded-[20px] bg-red-500 px-4 py-3.5 text-[14px] font-bold text-white disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function NewContactPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-slate-50 px-4 pt-5 dark:bg-slate-950">
          <Skeleton count={7} />
        </div>
      }
    >
      <ContactForm />
    </Suspense>
  )
}
