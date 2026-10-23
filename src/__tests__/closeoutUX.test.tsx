import React from 'react'
import { render, fireEvent, screen, renderHook, act } from '@testing-library/react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import BankLogo from '@/components/BankLogo'
import { ToastProvider, useToast } from '@/contexts/ToastContext'

jest.mock('@/lib/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test-user' } }) }))
jest.mock('@/lib/syncEngine', () => {
  const snapshot = { isOnline: true, pendingCount: 2 }
  return {
    configureSyncEngine: jest.fn(),
    subscribeSyncSnapshot: () => () => {},
    getSyncSnapshot: () => snapshot,
    getServerSyncSnapshot: () => snapshot,
    processSyncQueue: jest.fn().mockRejectedValue(new Error('offline race')),
    getSyncQueueDiagnostics: jest.fn().mockResolvedValue([]),
  }
})

test('unexpected sync rejection returns failure without losing pending count', async () => {
  const { useLocalSync } = await import('@/hooks/useLocalSync')
  const { result } = renderHook(() => useLocalSync())
  await act(async () => {
    const sync = await result.current.forceSync()
    expect(sync.success).toBe(false)
    expect(sync.pendingCount).toBe(2)
    const full = await result.current.forceFullResync()
    expect(full.success).toBe(false)
    expect(full.pendingCount).toBe(2)
  })
})

test('component failure retries without forcing navigation', () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  let broken = true
  function Child() { if (broken) throw Error('test failure'); return <p>Recuperado</p> }
  render(<ErrorBoundary><Child /></ErrorBoundary>)
  expect(screen.getByRole('alert')).toBeTruthy()
  broken = false
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(screen.getByText('Recuperado')).toBeTruthy()
  log.mockRestore()
})

test('bank asset failure leaves a named fallback instead of broken image', () => {
  render(<BankLogo name="Stone" />)
  fireEvent.error(screen.getByRole('img'))
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getByTitle('Stone')).toBeTruthy()
})

test('adding a toast does not invalidate all context consumers', () => {
  Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: () => 'test-toast' })
  let renders = 0
  function Consumer() {
    const { showToast } = useToast()
    renders++
    return <button onClick={() => showToast('Aviso de teste')}>Avisar</button>
  }
  render(<ToastProvider><Consumer /></ToastProvider>)
  const before = renders
  fireEvent.click(screen.getByText('Avisar'))
  expect(screen.getByText('Aviso de teste')).toBeTruthy()
  expect(renders).toBe(before)
})
