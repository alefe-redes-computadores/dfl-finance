import { createHomeVisitSignature, describeHomeChanges, homeTrustSignal, readHomeVisitSignature } from '@/lib/homeDecisionSnapshot'

describe('R453 Home decisional: read-only, confidence and last visit', () => {
  const base = [{ id: 'a', type: 'expense', status: 'done', amount: 10, date: '2026-11-05', updated_at: '2026-11-05T12:00:00Z' }]

  test('fingerprint ignores row order and never serializes amounts', () => {
    const a = createHomeVisitSignature([...base, { id: 'b', type: 'income', amount: 25 }])
    const b = createHomeVisitSignature([{ id: 'b', type: 'income', amount: 25 }, ...base])
    expect(a).toEqual(b)
    expect(JSON.stringify(a)).not.toContain('amount')
    expect(JSON.stringify(a)).not.toContain('expense')
    expect(JSON.stringify(a)).not.toContain('2026-11-05')
  })
  test('first visit, unchanged, updated, added and removed are distinguishable', () => {
    const first = createHomeVisitSignature(base)
    expect(describeHomeChanges(null, first)).toMatch(/Primeira visita/)
    expect(describeHomeChanges(first, first)).toMatch(/Nenhuma alteração/)
    expect(describeHomeChanges(first, createHomeVisitSignature([{ ...base[0], amount: 12 }]))).toMatch(/alterados/)
    const more = createHomeVisitSignature([...base, { id: 'b' }])
    expect(describeHomeChanges(first, more)).toMatch(/a mais/)
    expect(describeHomeChanges(more, first)).toMatch(/a menos/)
  })
  test('invalid metadata is discarded', () => {
    expect(readHomeVisitSignature('{broken')).toBeNull()
    expect(readHomeVisitSignature('{"version":1,"count":-1,"fingerprint":"01234567"}')).toBeNull()
    const valid = createHomeVisitSignature(base)
    expect(readHomeVisitSignature(JSON.stringify(valid))).toEqual(valid)
  })
  const verified = {
    isOnline: true, isSyncing: false, hasSyncFailure: false, pendingCount: 0,
    hasFinancialOutbox: false, isBalanceReconciling: false,
    balanceVerifiedAt: '2026-11-06T10:00:00Z', lastSuccessfulSyncAt: '2026-11-06T10:00:00Z',
  }
  test('never claims confirmed status offline, with pending items, failures or uncertainty', () => {
    for (const patch of [
      { isOnline: false }, { isSyncing: true }, { pendingCount: 1 },
      { hasFinancialOutbox: true }, { hasSyncFailure: true },
      { isBalanceReconciling: true }, { lastSuccessfulSyncAt: null }, { balanceVerifiedAt: null },
    ]) {
      const signal = homeTrustSignal({ ...verified, ...patch })
      expect(signal.tone).not.toBe('safe')
    }
    expect(homeTrustSignal(verified).tone).toBe('safe')
  })
})
