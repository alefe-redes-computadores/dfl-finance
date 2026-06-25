'use client'

import { X, Bell, CreditCard, Repeat, Target, Clock, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: 'invoice_overdue' | 'invoice_soon' | 'subscription_overdue' | 'subscription_soon' | 'budget_over' | 'budget_warning' | 'pending_expense' | 'pending_income'
  title: string
  subtitle: string
  cardId?: string
  budgetId?: string
  txId?: string
  subId?: string
  severity: 'critical' | 'warning' | 'info' | 'success'
}

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
  notifications: Notification[]
}

export default function NotificationCenter({ isOpen, onClose, notifications }: NotificationCenterProps) {
  const router = useRouter()

  if (!isOpen) return null

  const getIcon = (type: string) => {
    switch (type) {
      case 'invoice_overdue': return <CreditCard size={18} className="text-red-500" />
      case 'invoice_soon': return <CreditCard size={18} className="text-orange-500" />
      case 'subscription_overdue': return <Repeat size={18} className="text-red-500" />
      case 'subscription_soon': return <Repeat size={18} className="text-orange-500" />
      case 'budget_over': return <Target size={18} className="text-red-500" />
      case 'budget_warning': return <Target size={18} className="text-orange-500" />
      case 'pending_expense': return <Clock size={18} className="text-blue-500" />
      case 'pending_income': return <CheckCircle size={18} className="text-emerald-500" />
      default: return <Bell size={18} className="text-gray-400" />
    }
  }

  const getBgColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 dark:bg-red-900/20'
      case 'warning': return 'bg-orange-50 dark:bg-orange-900/20'
      case 'info': return 'bg-blue-50 dark:bg-blue-900/20'
      case 'success': return 'bg-emerald-50 dark:bg-emerald-900/20'
      default: return 'bg-gray-50 dark:bg-slate-700'
    }
  }

  const handleClick = (notif: Notification) => {
    if (notif.cardId) {
      router.push(`/cards/${notif.cardId}`)
    } else if (notif.budgetId) {
      router.push(`/budgets/${notif.budgetId}`)
    } else if (notif.txId) {
      router.push(`/transactions/${notif.txId}`)
    } else if (notif.subId) {
      router.push('/subscriptions')
    }
    onClose()
  }

  const criticalCount = notifications.filter(n => n.severity === 'critical').length
  const warningCount = notifications.filter(n => n.severity === 'warning').length
  const infoCount = notifications.filter(n => n.severity === 'info' || n.severity === 'success').length

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 top-0 z-50 mx-auto max-w-md pt-16 px-4">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-50 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                <Bell size={20} className="text-teal-700 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Notificações</h3>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  {notifications.length} alerta{notifications.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full">
              <X size={20} />
            </button>
          </div>

          {/* Resumo rápido */}
          <div className="grid grid-cols-3 gap-2 px-5 py-3 border-b border-gray-50 dark:border-slate-700">
            <div className="text-center">
              <span className="text-[11px] font-bold text-red-500">{criticalCount}</span>
              <p className="text-[9px] text-gray-400 dark:text-gray-500">Críticos</p>
            </div>
            <div className="text-center">
              <span className="text-[11px] font-bold text-orange-500">{warningCount}</span>
              <p className="text-[9px] text-gray-400 dark:text-gray-500">Atenção</p>
            </div>
            <div className="text-center">
              <span className="text-[11px] font-bold text-blue-500">{infoCount}</span>
              <p className="text-[9px] text-gray-400 dark:text-gray-500">Informativos</p>
            </div>
          </div>

          {/* Lista de notificações */}
          <div className="max-h-[50vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
                  <CheckCircle size={28} className="text-emerald-500" />
                </div>
                <p className="font-bold text-gray-800 dark:text-gray-200">Tudo em dia!</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum alerta no momento.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-slate-700">
                {notifications.map(notif => (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${getBgColor(notif.severity)}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200">{notif.title}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{notif.subtitle}</p>
                    </div>
                    <ArrowRight size={16} className="text-gray-300 dark:text-gray-600" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
