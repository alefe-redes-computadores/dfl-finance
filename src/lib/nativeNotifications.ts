'use client'

import { Capacitor, registerPlugin } from '@capacitor/core'
import { db } from '@/lib/db'
import { reminderOccurrences, resolveNotificationRule, sameScheduledReminder, type NotificationRuleOverrides } from '@/lib/nativeNotificationRules'

export const DFL_NOTIFICATION_CHANNEL_ID = 'dfl-financial-alerts'
const DFL_NOTIFICATION_PRIVATE_CHANNEL_ID = 'dfl-financial-private-v1'
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
  group?: string
  groupSummary?: boolean
  actionTypeId?: string
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

  registerActionTypes(options: {
    types: Array<{ id: string; actions: Array<{ id: string; title: string; foreground?: boolean }> }>
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
  notification_lead_days?: number[]
  notification_overdue?: boolean
  notification_grouping?: boolean
  notification_action_open?: boolean
  notification_categories?: Partial<NotificationCategoryPreferences>
  notification_rules?: NotificationRuleOverrides
  notification_privacy?: 'private' | 'full'
}

interface ReminderCandidate {
  key: string
  title: string
  body: string
  amount: number
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

export function normalizeNativeNotificationRoute(value: unknown) {
  if (typeof value !== 'string') return null

  const route = value.trim()

  // Compat V37: !route.includes('://') é o contrato histórico de rota interna.
  const safeLocalPath = route.startsWith('/') && !route.startsWith('//')
  if (
    !safeLocalPath ||
    route.includes('://') ||
    route.includes('\\\\') ||
    route.includes('\\n') ||
    route.includes('\\r')
  ) {
    return null
  }

  return route
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

function toISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
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
    goals,
  ] = await Promise.all([
    db.credit_invoices.where('user_id').equals(userId).toArray(),
    db.credit_cards.where('user_id').equals(userId).toArray(),
    db.debts.where('user_id').equals(userId).toArray(),
    db.financings.where('user_id').equals(userId).toArray(),
    db.loans.where('user_id').equals(userId).toArray(),
    db.subscriptions.where('user_id').equals(userId).toArray(),
    db.transactions.where('user_id').equals(userId).toArray(),
    db.goals.where('user_id').equals(userId).toArray(),
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
        amount: remaining,
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
        amount: remaining,
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
        amount: numberValue(financing.installment_value || financing.installment_amount),
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
        amount: numberValue(loan.remaining_amount),
        dueDate: loan.due_date,
        route: `/loans/details?id=${loan.id}`,
        category: 'loans',
      })
    }
  }

  if (enabled(preferences, 'subscriptions')) {
    for (const subscription of subscriptions) {
      const explicitDue =
        typeof subscription.next_due_date === 'string'
          ? subscription.next_due_date.slice(0, 10)
          : ''

      const dueDay = Number(
        subscription.due_day || 0
      )

      if (
        subscription.status !== 'active' ||
        (!explicitDue && dueDay <= 0)
      ) {
        continue
      }

      reminders.push({
        key: `subscription:${subscription.id}`,
        title: subscription.name || 'Assinatura',
        body: `${formatMoney(subscription.amount)} previsto`,
        amount: numberValue(subscription.amount),
        dueDate:
          explicitDue ||
          nextMonthlyDueDate(dueDay),
        route: `/subscriptions/details?id=${subscription.id}`,
        category: 'subscriptions',
      })
    }
  }

  if (enabled(preferences, 'goals')) {
    for (const goal of goals) {
      if (
        goal.status !== 'active' ||
        !goal.deadline
      ) {
        continue
      }

      const remaining = Math.max(
        0,
        numberValue(goal.target_amount) -
          numberValue(goal.saved_amount)
      )

      if (remaining <= 0) continue

      reminders.push({
        key: `goal:${goal.id}`,
        title: goal.name || 'Meta financeira',
        body: `${formatMoney(remaining)} para concluir`,
        amount: remaining,
        dueDate: goal.deadline,
        route: `/goals/details?id=${goal.id}`,
        category: 'goals',
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
        amount: numberValue(transaction.amount),
        dueDate: transaction.date,
        route: `/transactions/details?id=${transaction.id}`,
        category: 'transactions',
      })
    }
  }

  return reminders
}

export type NativeNotificationPermissionState =
  | PermissionState
  | 'unsupported'

export async function getNativeNotificationPermission():
  Promise<NativeNotificationPermissionState> {
  if (!isNative()) return 'unsupported'
  const permission = await LocalNotifications.checkPermissions()
  return permission.display
}

export async function requestNativeNotificationPermission():
  Promise<NativeNotificationPermissionState> {
  if (!isNative()) return 'unsupported'

  let permission = await LocalNotifications.checkPermissions()
  if (
    permission.display === 'prompt' ||
    permission.display === 'prompt-with-rationale'
  ) {
    permission = await LocalNotifications.requestPermissions()
  }
  return permission.display
}

async function hasNotificationPermission() {
  return (await getNativeNotificationPermission()) === 'granted'
}

export async function sendNativeNotificationTest() {
  if (!isNative()) {
    return { supported: false, permission: 'unsupported' as const }
  }

  const permission = await requestNativeNotificationPermission()
  if (permission !== 'granted') {
    return { supported: true, permission, sent: false }
  }

  await ensureChannel()
  await LocalNotifications.schedule({
    notifications: [{
      id: stableNotificationId(`test:${Date.now()}`),
      title: 'DFL Finance',
      body: 'Notificações funcionando corretamente.',
      schedule: {
        at: new Date(Date.now() + 3000),
        allowWhileIdle: true,
      },
      channelId: DFL_NOTIFICATION_CHANNEL_ID,
      smallIcon: DFL_NOTIFICATION_SMALL_ICON,
      iconColor: '#0f766e',
      extra: { managedBy: 'dfl-finance-test', route: '/notification-center' },
    }],
  })

  return { supported: true, permission, sent: true }
}

async function cancelManagedNotifications() {
  if (!isNative()) return 0

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

  return managed.length
}

function normalizedLeadDays(
  preferences: NativeNotificationPreferences
) {
  const raw = Array.isArray(preferences.notification_lead_days)
    ? preferences.notification_lead_days
    : [3, 1, 0]

  return Array.from(
    new Set(
      raw
        .map(Number)
        .filter(
          (value) =>
            Number.isInteger(value) &&
            value >= 0 &&
            value <= 30
        )
    )
  ).sort((a, b) => b - a)
}

function occurrenceTitle(
  title: string,
  leadDays: number,
  overdue = false
) {
  if (overdue) return `${title} está vencido`
  if (leadDays === 0) return `${title} vence hoje`
  if (leadDays === 1) return `${title} vence amanhã`
  return `${title} vence em ${leadDays} dias`
}

async function ensureChannel() {
  if (!isNative()) return

  // O canal legado continua disponível para quem opta por valores visíveis.
  await LocalNotifications.createChannel({
    id: DFL_NOTIFICATION_CHANNEL_ID,
    name: 'Alertas financeiros',
    description: 'Faturas, vencimentos, recorrências e compromissos financeiros.',
    importance: 4,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#0f766e',
  })
  // Android não permite alterar a visibilidade de um canal já criado.
  // Um ID novo preserva o bloqueio de valores na tela bloqueada.
  await LocalNotifications.createChannel({
    id: DFL_NOTIFICATION_PRIVATE_CHANNEL_ID,
    name: 'Lembretes financeiros privados',
    description: 'Lembretes com valores ocultos na tela bloqueada.',
    importance: 4,
    visibility: 0,
    vibration: true,
    lights: true,
    lightColor: '#0f766e',
  })
}

export async function syncNativeFinancialReminders(
  userId: string,
  preferences: NativeNotificationPreferences
) {
  const supported = isNative()

  if (!userId || !supported) {
    return {
      supported,
      scheduled: 0,
    }
  }

  // OFF continua cancelando só as notificações deste aplicativo.
  if (!preferences.push_notifications) {
    const cancelled = await cancelManagedNotifications()
    return { supported: true, scheduled: 0, cancelled, disabled: true }
  }

  const permitted = await hasNotificationPermission()
  if (!permitted) {
    const cancelled = await cancelManagedNotifications()
    return { supported: true, scheduled: 0, cancelled, permissionDenied: true }
  }

  await ensureChannel()

  // A única ação explícita é ABRIR. Nunca paga, recebe ou concilia no background.
  let canShowOpenAction = false
  if (preferences.notification_action_open !== false) {
    try {
      await LocalNotifications.registerActionTypes({
        types: [{ id: 'dfl-finance-open', actions: [{ id: 'open', title: 'Abrir', foreground: true }] }],
      })
      canShowOpenAction = true
    } catch (error) {
      console.warn('[NativeNotifications] Ação Abrir indisponível; toque padrão mantido.', error)
    }
  }

  const candidates = await collectReminderCandidates(
    userId,
    preferences
  )

  // R457: cada tipo possui antecedência, valor mínimo e repetição próprios.
  // Datas são calculadas em tempo civil, nunca em UTC para decisões de vencimento.
  const now = Date.now()
  const reference = new Date(now)
  const defaultLeadDays = normalizedLeadDays(preferences)
  const overdueEnabled = preferences.notification_overdue !== false
  const privateMode = preferences.notification_privacy !== 'full'
  const channelId = privateMode ? DFL_NOTIFICATION_PRIVATE_CHANNEL_ID : DFL_NOTIFICATION_CHANNEL_ID
  const proposed: NativeNotificationSchema[] = []
  const notifications: NativeNotificationSchema[] = []
  const usedIds = new Set<number>()

  const append = (
    candidate: ReminderCandidate,
    suffix: string,
    title: string,
    at: Date
  ) => {
    if (proposed.length >= 5000) return
    const key = `${candidate.key}:${candidate.dueDate}:${suffix}`
    let id = stableNotificationId(`${userId}:${key}`)
    while (usedIds.has(id)) id = id >= 1_999_999_999 ? 1 : id + 1
    usedIds.add(id)
    proposed.push({
      id,
      title: privateMode ? 'Lembrete financeiro' : title,
      body: privateMode ? 'Há um compromisso para conferir no DFL Finance.' : candidate.body,
      schedule: { at, allowWhileIdle: true },
      channelId,
      smallIcon: DFL_NOTIFICATION_SMALL_ICON,
      iconColor: '#0f766e',
      actionTypeId: canShowOpenAction ? 'dfl-finance-open' : undefined,
      extra: {
        managedBy: 'dfl-finance',
        key,
        route: candidate.route,
        category: candidate.category,
        dueDate: candidate.dueDate,
      },
    })
  }

  for (const candidate of candidates) {
    const rule = resolveNotificationRule(candidate.category, {
      ...preferences,
      notification_lead_days: defaultLeadDays,
    })
    if (!overdueEnabled) rule.overdueEveryDays = 0
    if (candidate.amount <= 0 || candidate.amount < rule.minimumAmount) continue
    for (const occurrence of reminderOccurrences(candidate.dueDate, rule, reference)) {
      append(
        candidate,
        occurrence.suffix,
        occurrenceTitle(candidate.title, occurrence.leadDays, occurrence.overdue),
        occurrence.at
      )
    }
  }
  // A agenda mais próxima vence a corrida por capacidade, sem priorizar uma tabela arbitrária.
  proposed.sort((a, b) => (a.schedule?.at?.getTime() || 0) - (b.schedule?.at?.getTime() || 0))
  notifications.push(...proposed.slice(0, 56)) // reserva espaço para resumos de grupos

  // No Android, várias pendências do mesmo horário formam um único grupo.
  // Um resumo separado é criado apenas quando há pelo menos dois itens.
  if (preferences.notification_grouping !== false) {
    const grouped = new Map<string, NativeNotificationSchema[]>()
    for (const notification of notifications) {
      const when = notification.schedule?.at
      if (!when) continue
      const key = `dfl-finance-${toISODate(when)}-${when.getHours()}`
      const current = grouped.get(key) || []
      current.push(notification)
      grouped.set(key, current)
    }
    for (const [key, groupItems] of Array.from(grouped.entries())) {
      if (groupItems.length < 2 || notifications.length >= 60) continue
      for (const item of groupItems) item.group = key
      const when = groupItems[0].schedule?.at
      if (!when) continue
      let summaryId = stableNotificationId(`${userId}:group:${key}`)
      while (usedIds.has(summaryId)) summaryId = summaryId >= 1_999_999_999 ? 1 : summaryId + 1
      usedIds.add(summaryId)
      notifications.push({
        id: summaryId,
        title: `${groupItems.length} lembretes financeiros`,
        body: 'Toque para revisar as pendências no Finance.',
        schedule: { at: new Date(when.getTime() + 1000), allowWhileIdle: true },
        group: key,
        groupSummary: true,
        channelId,
        smallIcon: DFL_NOTIFICATION_SMALL_ICON,
        iconColor: '#0f766e',
        actionTypeId: canShowOpenAction ? 'dfl-finance-open' : undefined,
        extra: { managedBy: 'dfl-finance', key: `summary:${key}`, route: '/notifications' },
      })
    }
  }

  notifications.sort(
    (a, b) => (a.schedule?.at?.getTime() || 0) - (b.schedule?.at?.getTime() || 0)
  )
  // A assinatura descreve exatamente o aviso, inclusive hora e privacidade.
  for (const item of notifications) {
    const signature = JSON.stringify({
      id: item.id,
      at: item.schedule?.at?.toISOString(),
      title: item.title,
      body: item.body,
      channelId: item.channelId,
      route: item.extra?.route,
      key: item.extra?.key,
      group: item.group,
      groupSummary: item.groupSummary || false,
      actionTypeId: item.actionTypeId,
    })
    item.extra = { ...item.extra, signature }
  }

  // Reconciliação incremental: não cancela/reagenda lembretes idênticos ao retomar o APK.
  const current = await LocalNotifications.getPending()
  const managed = current.notifications.filter(item => item.extra?.managedBy === 'dfl-finance')
  const existingById = new Map(managed.map(item => [item.id, item]))
  const desiredById = new Map(notifications.map(item => [item.id, item]))
  const stale = managed.filter(item => {
    const desired = desiredById.get(item.id)
    return !desired || !sameScheduledReminder(item, desired)
  })
  if (stale.length > 0) {
    await LocalNotifications.cancel({ notifications: stale.map(item => ({ id: item.id })) })
  }
  const needed = notifications.filter(item => {
    const current = existingById.get(item.id)
    return !current || !sameScheduledReminder(current, item)
  })
  if (needed.length > 0) await LocalNotifications.schedule({ notifications: needed })

  return {
    supported: true,
    scheduled: notifications.length,
    kept: notifications.length - needed.length,
    added: needed.length,
    cancelled: stale.length,
    candidates: candidates.length,
  }

}

export async function clearNativeFinancialReminders() {
  return cancelManagedNotifications()
}

export async function addNativeNotificationActionListener(
  onRoute: (route: string) => void
) {
  if (!isNative()) return null

  return LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (event) => {
      const route = normalizeNativeNotificationRoute(
        event.notification?.extra?.route
      )

      if (route) {
        onRoute(route)
      }
    }
  )
}
