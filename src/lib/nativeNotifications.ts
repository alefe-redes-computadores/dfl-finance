'use client'

import { Capacitor, registerPlugin } from '@capacitor/core'
import { db } from '@/lib/db'

export const DFL_NOTIFICATION_CHANNEL_ID = 'dfl-financial-alerts'
export const DFL_NOTIFICATION_SMALL_ICON = 'ic_stat_dfl_finance'

type PermissionState =
  | 'prompt'
  | 'prompt-with-rationale'
  | 'granted'
  | 'denied'

interface NativeNotificationSchema {
  id: number
  title: string
  body: string
  schedule?: {
    at?: Date
    allowWhileIdle?: boolean
  }
  channelId?: string
  smallIcon?: string
  iconColor?: string
  extra?: Record<string, unknown>
}

interface PendingNotificationSchema {
  id: number
  extra?: Record<string, unknown>
}

interface LocalNotificationsPlugin {
  checkPermissions(): Promise<{ display: PermissionState }>
  requestPermissions(): Promise<{ display: PermissionState }>

  createChannel(options: {
    id: string
    name: string
    description?: string
    importance?: number
    visibility?: number
    vibration?: boolean
    lights?: boolean
    lightColor?: string
  }): Promise<void>

  schedule(options: {
    notifications: NativeNotificationSchema[]
  }): Promise<void>

  cancel(options: {
    notifications: Array<{ id: number }>
  }): Promise<void>

  getPending(): Promise<{
    notifications: PendingNotificationSchema[]
  }>

  addListener(
    eventName: 'localNotificationActionPerformed',
    listener: (event: {
      notification?: {
        extra?: Record<string, unknown>
      }
    }) => void
  ): Promise<{ remove: () => Promise<void> }>
}

const LocalNotifications =
  registerPlugin<LocalNotificationsPlugin>('LocalNotifications')

export interface NotificationCategoryPreferences {
  invoices: boolean
  transactions: boolean
  debts: boolean
  financings: boolean
  loans: boolean
  subscriptions: boolean
  goals: boolean
}

export interface NativeNotificationPreferences {
  push_notifications: boolean
  notification_hour?: number
  notification_categories?: Partial<NotificationCategoryPreferences>
}

interface ReminderCandidate {
  key: string
  title: string
  body: string
  dueDate: string
  route: string
  category: keyof NotificationCategoryPreferences
}

const DEFAULT_CATEGORIES: NotificationCategoryPreferences = {
  invoices: true,
  transactions: true,
  debts: true,
  financings: true,
  loans: true,
  subscriptions: true,
  goals: true,
}

function isNative() {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.isPluginAvailable('LocalNotifications')
  )
}

function enabled(
  preferences: NativeNotificationPreferences,
  category: keyof NotificationCategoryPreferences
) {
  return (
    preferences.notification_categories?.[category] ??
    DEFAULT_CATEGORIES[category]
  )
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: unknown) {
  return numberValue(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function parseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)

  if (!year || !month || !day) return null

  return new Date(year, month - 1, day)
}

function toISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function addDays(date: Date, amount: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

function reminderAt(dateISO: string, hour: number) {
  const date = parseDate(dateISO)
  if (!date) return null

  date.setHours(hour, 0, 0, 0)
  return date
}

function stableNotificationId(key: string) {
  let hash = 2166136261

  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return Math.abs(hash % 2_000_000_000) + 1
}

function nextMonthlyDueDate(dueDay: number) {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth()

  const makeDate = () => {
    const lastDay = new Date(year, month + 1, 0).getDate()
    return new Date(year, month, Math.min(dueDay, lastDay))
  }

  let due = makeDate()

  if (due < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    month += 1

    if (month > 11) {
      month = 0
      year += 1
    }

    due = makeDate()
  }

  return toISODate(due)
}

async function collectReminderCandidates(
  userId: string,
  preferences: NativeNotificationPreferences
): Promise<ReminderCandidate[]> {
  const [
    invoices,
    cards,
    debts,
    financings,
    loans,
    subscriptions,
    transactions,
  ] = await Promise.all([
    db.credit_invoices.where('user_id').equals(userId).toArray(),
    db.credit_cards.where('user_id').equals(userId).toArray(),
    db.debts.where('user_id').equals(userId).toArray(),
    db.financings.where('user_id').equals(userId).toArray(),
    db.loans.where('user_id').equals(userId).toArray(),
    db.subscriptions.where('user_id').equals(userId).toArray(),
    db.transactions.where('user_id').equals(userId).toArray(),
  ])

  const cardNames = new Map(
    cards.map((card) => [card.id, card.name || 'Cartão'])
  )

  const reminders: ReminderCandidate[] = []

  if (enabled(preferences, 'invoices')) {
    for (const invoice of invoices) {
      if (!invoice.due_date || invoice.status === 'paid') continue

      const remaining = Math.max(
        0,
        numberValue(invoice.total_amount) -
          numberValue(invoice.paid_amount)
      )

      if (remaining <= 0) continue

      reminders.push({
        key: `invoice:${invoice.id}`,
        title: `Fatura ${cardNames.get(invoice.credit_card_id) || 'Cartão'}`,
        body: `${formatMoney(remaining)} em aberto`,
        dueDate: invoice.due_date,
        route: `/cards/details?id=${invoice.credit_card_id}`,
        category: 'invoices',
      })
    }
  }

  if (enabled(preferences, 'debts')) {
    for (const debt of debts) {
      if (
        !debt.due_date ||
        debt.status === 'paid' ||
        debt.status === 'cancelled'
      ) {
        continue
      }

      const remaining = Math.max(
        0,
        numberValue(debt.total_amount) -
          numberValue(debt.paid_amount)
      )

      if (remaining <= 0) continue

      reminders.push({
        key: `debt:${debt.id}`,
        title: debt.person_name || 'Quem me deve',
        body: `${formatMoney(remaining)} a receber`,
        dueDate: debt.due_date,
        route: `/debts/details?id=${debt.id}`,
        category: 'debts',
      })
    }
  }

  if (enabled(preferences, 'financings')) {
    for (const financing of financings) {
      if (
        !financing.next_due_date ||
        financing.status === 'paid'
      ) {
        continue
      }

      reminders.push({
        key: `financing:${financing.id}`,
        title: financing.name || 'Financiamento',
        body: `${formatMoney(
          financing.installment_value ||
            financing.installment_amount
        )} previsto`,
        dueDate: financing.next_due_date,
        route: `/financings/details?id=${financing.id}`,
        category: 'financings',
      })
    }
  }

  if (enabled(preferences, 'loans')) {
    for (const loan of loans) {
      if (!loan.due_date || loan.status === 'paid') continue

      reminders.push({
        key: `loan:${loan.id}`,
        title: 'Empréstimo',
        body: `${formatMoney(loan.remaining_amount)} restante${
          loan.description ? ` • ${loan.description}` : ''
        }`,
        dueDate: loan.due_date,
        route: `/loans/details?id=${loan.id}`,
        category: 'loans',
      })
    }
  }

  if (enabled(preferences, 'subscriptions')) {
    for (const subscription of subscriptions) {
      if (
        subscription.status !== 'active' ||
        !subscription.due_day
      ) {
        continue
      }

      reminders.push({
        key: `subscription:${subscription.id}`,
        title: subscription.name || 'Recorrência',
        body: `${formatMoney(subscription.amount)} previsto`,
        dueDate: nextMonthlyDueDate(subscription.due_day),
        route: '/subscriptions',
        category: 'subscriptions',
      })
    }
  }

  if (enabled(preferences, 'transactions')) {
    for (const transaction of transactions) {
      if (
        transaction.status !== 'pending' ||
        (transaction.type !== 'expense' &&
          transaction.type !== 'income')
      ) {
        continue
      }

      reminders.push({
        key: `transaction:${transaction.id}`,
        title:
          transaction.type === 'income'
            ? 'Receita prevista'
            : 'Conta prevista',
        body: `${formatMoney(transaction.amount)}${
          transaction.description
            ? ` • ${transaction.description}`
            : ''
        }`,
        dueDate: transaction.date,
        route: `/transactions/details?id=${transaction.id}`,
        category: 'transactions',
      })
    }
  }

  return reminders
}

async function ensurePermission() {
  if (!isNative()) return false

  let permission = await LocalNotifications.checkPermissions()

  if (
    permission.display === 'prompt' ||
    permission.display === 'prompt-with-rationale'
  ) {
    permission = await LocalNotifications.requestPermissions()
  }

  return permission.display === 'granted'
}

async function ensureChannel() {
  if (!isNative()) return

  await LocalNotifications.createChannel({
    id: DFL_NOTIFICATION_CHANNEL_ID,
    name: 'Alertas financeiros',
    description:
      'Faturas, vencimentos, recorrências e compromissos financeiros.',
    importance: 4,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#0f766e',
  })
}

export async function syncNativeFinancialReminders(
  userId: string,
  preferences: NativeNotificationPreferences
) {
  if (!userId || !preferences.push_notifications || !isNative()) {
    return {
      supported: isNative(),
      scheduled: 0,
    }
  }

  const permitted = await ensurePermission()

  if (!permitted) {
    return {
      supported: true,
      scheduled: 0,
      permissionDenied: true,
    }
  }

  await ensureChannel()

  const pending = await LocalNotifications.getPending()

  const managed = pending.notifications.filter(
    (notification) =>
      notification.extra?.managedBy === 'dfl-finance'
  )

  if (managed.length > 0) {
    await LocalNotifications.cancel({
      notifications: managed.map(({ id }) => ({ id })),
    })
  }

  const candidates = await collectReminderCandidates(
    userId,
    preferences
  )

  const hour = Math.min(
    21,
    Math.max(
      6,
      Number.isFinite(preferences.notification_hour)
        ? Number(preferences.notification_hour)
        : 9
    )
  )

  const now = Date.now()
  const maxSchedule = now + 40 * 24 * 60 * 60 * 1000

  const notifications: NativeNotificationSchema[] = []

  for (const candidate of candidates) {
    const due = parseDate(candidate.dueDate)
    if (!due) continue

    const occurrences = [
      {
        suffix: 'soon',
        title: `${candidate.title} vence em 3 dias`,
        at: reminderAt(
          toISODate(addDays(due, -3)),
          hour
        ),
      },
      {
        suffix: 'today',
        title: `${candidate.title} vence hoje`,
        at: reminderAt(candidate.dueDate, hour),
      },
    ]

    for (const occurrence of occurrences) {
      if (!occurrence.at) continue

      const timestamp = occurrence.at.getTime()

      if (
        timestamp <= now + 60_000 ||
        timestamp > maxSchedule
      ) {
        continue
      }

      const key = `${candidate.key}:${candidate.dueDate}:${occurrence.suffix}`

      notifications.push({
        id: stableNotificationId(key),
        title: occurrence.title,
        body: candidate.body,
        schedule: {
          at: occurrence.at,
          allowWhileIdle: true,
        },
        channelId: DFL_NOTIFICATION_CHANNEL_ID,
        smallIcon: DFL_NOTIFICATION_SMALL_ICON,
        iconColor: '#0f766e',
        extra: {
          managedBy: 'dfl-finance',
          key,
          route: candidate.route,
          category: candidate.category,
          dueDate: candidate.dueDate,
        },
      })
    }
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({
      notifications,
    })
  }

  return {
    supported: true,
    scheduled: notifications.length,
  }
}

export async function addNativeNotificationActionListener(
  onRoute: (route: string) => void
) {
  if (!isNative()) return null

  return LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (event) => {
      const route = event.notification?.extra?.route

      if (
        typeof route === 'string' &&
        route.startsWith('/') &&
        !route.startsWith('//')
      ) {
        onRoute(route)
      }
    }
  )
}
