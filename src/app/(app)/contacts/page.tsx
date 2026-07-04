'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  ChevronLeft, Plus, Users, Loader2, Edit3, Trash2,
  Building, User, Phone, Mail, RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'

// ============================================================
// SKELETON LOADER
// ============================================================
const ContactsSkeleton = () => (
  <div className="space-y-2 animate-pulse">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-slate-700" />
            <div className="space-y-2">
              <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-16 bg-gray-100 dark:bg-slate-700/50 rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="w-4 h-4 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="w-7 h-7 bg-gray-200 dark:bg-slate-700 rounded-full" />
            <div className="w-7 h-7 bg-gray-200 dark:bg-slate-700 rounded-full" />
          </div>
        </div>
      </div>
    ))}
  </div>
)

export default function ContactsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // ============================================================
  // 🔥 BUSCA LOCAL DE CONTATOS (INDEXEDDB)
  // ============================================================
  const { data: localContacts, loading: contactsLoading, reload: reloadContacts } = useLocalData({
    table: 'contacts',
    filters: { context },
    orderBy: { field: 'name', direction: 'asc' },
    realtime: true,
  })

  // ============================================================
  // PULL TO REFRESH
  // ============================================================
  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY > 10 || loading) return
    pullStartY.current = e.touches[0].clientY
    isPulling.current = true
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const pullDistance = e.touches[0].clientY - pullStartY.current
    if (pullDistance > 60) {
      setRefreshing(true)
      isPulling.current = false
      loadContacts().finally(() => setRefreshing(false))
    }
  }

  const handleTouchEnd = () => {
    isPulling.current = false
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [loading, refreshing])

  // ============================================================
  // LOAD DATA
  // ============================================================
  const loadContacts = async () => {
    setLoading(true)
    setLoadingPulse(true)
    try {
      await reloadContacts()
    } catch (err) {
      console.error('Erro ao carregar contatos:', err)
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    loadContacts()
  }, [user?.id, context])

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este contato?')) return
    try {
      const { remove } = useLocalData({ table: 'contacts' })
      await remove(id)
      showToast('Contato excluído.', 'info')
      loadContacts()
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    }
  }

  const contacts = localContacts || []

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'supplier': return 'Fornecedor'
      case 'customer': return 'Cliente'
      case 'both': return 'Fornecedor/Cliente'
      default: return type
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'supplier': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      case 'customer': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'both': return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      {/* Indicador de carregamento sutil */}
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {/* ❌ REMOVIDO: Toast de "Atualizando..." */}

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/home')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            Contatos {contacts.length > 0 && `(${contacts.length})`}
          </h1>
          <button onClick={() => router.push('/contacts/new')} className="p-2 -mr-2 text-teal-700 dark:text-teal-400 hover:text-teal-800 transition-colors active:scale-90">
            <Plus size={24} />
          </button>
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <ContactsSkeleton />
        ) : contacts.length === 0 ? (
          <div className="text-center py-16 animate-in fade-in duration-300">
            <Users size={56} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Nenhum contato</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Cadastre fornecedores e clientes para vincular às transações.
            </p>
            <button
              onClick={() => router.push('/contacts/new')}
              className="bg-teal-700 text-white px-6 py-3 rounded-2xl font-bold hover:bg-teal-800 transition-colors"
            >
              Novo contato
            </button>
          </div>
        ) : (
          <div className="space-y-2 animate-in fade-in duration-300">
            {contacts.map((contact: any) => {
              const IconComp = getDynamicIcon(contact.icon || 'user')
              return (
                <div
                  key={contact.id}
                  onClick={() => router.push(`/contacts/${contact.id}`)}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${contact.color}20`, color: contact.color }}
                      >
                        <IconComp size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{contact.name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getTypeColor(contact.type)}`}>
                          {getTypeLabel(contact.type)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {contact.phone && (
                        <span className="text-gray-400" title={contact.phone}>
                          <Phone size={14} />
                        </span>
                      )}
                      {contact.email && (
                        <span className="text-gray-400" title={contact.email}>
                          <Mail size={14} />
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/contacts/${contact.id}/edit`) }}
                        className="p-1.5 text-gray-400 hover:text-teal-600 rounded-full transition-colors"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(contact.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}