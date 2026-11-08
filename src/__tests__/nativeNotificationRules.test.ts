import {
  NOTIFICATION_KINDS, normalizeLeadDays, normalizeNotificationRules,
  resolveNotificationRule, civilReminderDate, reminderOccurrences, sameScheduledReminder,
} from '@/lib/nativeNotificationRules'

const at = (y: number, m: number, d: number, h = 8) => new Date(y, m - 1, d, h)

describe('R457 — políticas de notificações 360', () => {
  it('normaliza entradas hostis, limita categorias e previne protótipos', () => {
    const value = normalizeNotificationRules({
      invoices: { leadDays: [7, 3, 3, -1, 31, '1'], hour: 30, overdueEveryDays: 5, overdueMaxDays: 999, minimumAmount: -100 },
      unsafe: { enabled: true },
    })
    expect(Object.keys(value)).toEqual(['invoices'])
    expect(value.invoices?.leadDays).toEqual([7, 3])
    expect(value.invoices?.hour).toBe(9)
    expect(value.invoices?.overdueEveryDays).toBe(0)
    expect(value.invoices?.overdueMaxDays).toBe(14)
    expect(value.invoices?.minimumAmount).toBe(0)
    expect(NOTIFICATION_KINDS).toHaveLength(7)
  })
  it('mantém regras globais legadas e personaliza uma categoria sem afetar outra', () => {
    const prefs = { notification_hour: 10, notification_lead_days: [3, 1, 0], notification_overdue: true,
      notification_rules: normalizeNotificationRules({ invoices: { leadDays: [7, 0], hour: 18, overdueEveryDays: 2, minimumAmount: 50 } }) }
    expect(resolveNotificationRule('invoices', prefs)).toMatchObject({ leadDays: [7, 0], hour: 18, overdueEveryDays: 2, minimumAmount: 50 })
    expect(resolveNotificationRule('debts', prefs)).toMatchObject({ leadDays: [3, 1, 0], hour: 10, overdueEveryDays: 1 })
    expect(resolveNotificationRule('invoices', { ...prefs, notification_overdue: false }).overdueEveryDays).toBe(0)
  })
  it('não programa data inválida ou horário passado', () => {
    expect(civilReminderDate('2026-02-30')).toBeNull()
    expect(civilReminderDate('2026-11-29')).not.toBeNull()
    const rule = resolveNotificationRule('invoices', { notification_hour: 9, notification_lead_days: [0], notification_overdue: false })
    expect(reminderOccurrences('2026-11-08', rule, at(2026, 11, 8, 10))).toHaveLength(0)
  })
  it('agenda 7, 3, 0 e atrasos em dias civis com limites', () => {
    const rule = resolveNotificationRule('invoices', {
      notification_rules: { invoices: { leadDays: [7, 3, 0], overdueEveryDays: 1, overdueMaxDays: 7, hour: 9 } },
    })
    const dates = reminderOccurrences('2026-11-20', rule, at(2026, 11, 12))
    expect(dates.some(x => x.suffix === 'lead:7' && x.at.getDate() === 13)).toBe(true)
    expect(dates.some(x => x.suffix === 'lead:3' && x.at.getDate() === 17)).toBe(true)
    expect(dates.some(x => x.suffix === 'lead:0' && x.at.getDate() === 20)).toBe(true)
    expect(dates.filter(x => x.overdue)).toHaveLength(7)
    expect(dates.every(x => x.at.getHours() === 9)).toBe(true)
  })
  it('não resgata atrasos antigos fora do prazo e respeita mudança de ano', () => {
    const rule = resolveNotificationRule('debts', { notification_rules: { debts: { leadDays: [0], overdueEveryDays: 7, overdueMaxDays: 14, hour: 10 } } })
    expect(reminderOccurrences('2026-10-01', rule, at(2026, 11, 8))).toHaveLength(0)
    const occurrences = reminderOccurrences('2026-12-31', rule, at(2026, 12, 30))
    expect(occurrences.some(x => x.at.getFullYear() === 2027 && x.overdue)).toBe(true)
  })
  it('mantém notificações iguais e substitui somente quando contrato muda', () => {
    const old = { id: 12, extra: { managedBy: 'dfl-finance', signature: 'k|2026-11-20T09:00:00.000Z|texto' } }
    expect(sameScheduledReminder(old, { ...old, extra: { ...old.extra } })).toBe(true)
    expect(sameScheduledReminder(old, { ...old, extra: { managedBy: 'dfl-finance', signature: 'novo' } })).toBe(false)
    expect(sameScheduledReminder(old, { ...old, id: 13 })).toBe(false)
    expect(sameScheduledReminder({ id: 12, extra: { managedBy: 'outro', signature: 'k' } }, old)).toBe(false)
  })
  it('impede agenda arbitrária por entradas fora de faixa', () => {
    expect(normalizeLeadDays([-2, 0, 30, 31, 30, Infinity])).toEqual([30, 0])
    expect(reminderOccurrences('0000-00-00', resolveNotificationRule('goals', {}))).toEqual([])
    expect(reminderOccurrences('2026-11-20', resolveNotificationRule('goals', {}), at(2027, 11, 20))).toEqual([])
  })
})
