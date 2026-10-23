import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const toasts: Array<[string, string]> = []
const quickSave = jest.fn()
const transfer = jest.fn()
const refresh = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
jest.mock('@/lib/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: (message: string, kind: string) => toasts.push([message, kind]) }),
}))
jest.mock('@/components/ContextToggle', () => ({
  useContext_: () => ({ effectiveContext: 'dfl', appMode: 'business_and_personal' }),
}))
jest.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ vibrate: jest.fn(), success: jest.fn(), error: jest.fn() }),
}))
jest.mock('@/hooks/useAccountsList', () => ({
  useAccountsList: () => ({ data: [
    { id: 'account-1', name: 'Conta um', context: 'dfl', balance: 100, is_archived: false },
    { id: 'account-2', name: 'Conta dois', context: 'dfl', balance: 20, is_archived: false },
    { id: 'archived', name: 'Conta arquivada', context: 'dfl', balance: 500, is_archived: true },
  ] }),
}))
jest.mock('@/hooks/useLocalData', () => ({ useLocalData: () => ({ data: [] }) }))
jest.mock('@/lib/transactionCategoryOperations', () => ({ filterTransactionCategories: () => [] }))
jest.mock('@/lib/iconUtils', () => ({ getDynamicIcon: () => () => null }))
jest.mock('@/lib/cashOperations', () => ({ createQuickCashTransaction: (...args: unknown[]) => quickSave(...args) }))
jest.mock('@/lib/accountOperations', () => ({ transferBetweenAccounts: (...args: unknown[]) => transfer(...args) }))
jest.mock('@/components/BankLogo', () => function MockBankLogo() {
  return <span data-testid="bank-logo" />
})
jest.mock('@/components/MoneyInput', () => function MockMoneyInput(props: any) {
  return <input aria-label={props.ariaLabel || 'Valor'} value={props.value || ''}
    onChange={(event) => props.onChange(Number(event.target.value))} />
})

beforeEach(() => {
  toasts.splice(0)
  quickSave.mockReset()
  transfer.mockReset()
  refresh.mockReset()
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true,
    value: jest.fn().mockReturnValueOnce('operation-1').mockReturnValue('operation-2'),
  })
})

test('quick action stays locked while committing and never offers archived accounts', async () => {
  let finish!: () => void
  quickSave.mockReturnValue(new Promise<void>((resolve) => { finish = resolve }))
  const onClose = jest.fn()
  const { default: FAB } = await import('@/components/FAB')
  render(<FAB isOpen onClose={onClose} />)

  fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '15' } })
  fireEvent.click(screen.getByText('Selecionar conta'))
  expect(screen.queryByText('Conta arquivada')).toBeNull()
  fireEvent.click(screen.getByText('Conta um'))
  fireEvent.click(screen.getByRole('button', { name: 'Salvar lançamento' }))
  fireEvent.click(screen.getByRole('dialog', { name: 'Ação rápida' }).parentElement!)

  expect(onClose).not.toHaveBeenCalled()
  expect(quickSave).toHaveBeenCalledTimes(1)
  finish()
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(toasts.some(([, kind]) => kind === 'error')).toBe(false)
})

test('a callback failure after quick save does not report a financial failure', async () => {
  quickSave.mockResolvedValue('transaction-1')
  const { default: FAB } = await import('@/components/FAB')
  render(<FAB isOpen onSave={() => { throw new Error('view refresh failed') }} />)

  fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '10' } })
  fireEvent.click(screen.getByText('Selecionar conta'))
  fireEvent.click(screen.getByText('Conta um'))
  fireEvent.click(screen.getByRole('button', { name: 'Salvar lançamento' }))

  await waitFor(() => expect(quickSave).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(toasts.some(([, kind]) => kind === 'warning')).toBe(true))
  expect(toasts.some(([, kind]) => kind === 'error')).toBe(false)
})

test('transfer cannot be dismissed or submitted twice while its two legs commit', async () => {
  let finish!: () => void
  transfer.mockReturnValue(new Promise<void>((resolve) => { finish = resolve }))
  const onClose = jest.fn()
  const { default: TransferModal } = await import('@/components/TransferModal')
  render(<TransferModal isOpen onClose={onClose} />)

  fireEvent.click(screen.getByText('Selecionar conta de saída'))
  fireEvent.click(screen.getByText('Conta um'))
  fireEvent.click(screen.getByText('Selecionar conta de entrada'))
  fireEvent.click(screen.getByText('Conta dois'))
  fireEvent.change(screen.getByLabelText('Valor da transferência'), { target: { value: '25' } })
  const submit = screen.getByRole('button', { name: 'Transferir agora' })
  fireEvent.click(submit)
  fireEvent.click(submit)
  fireEvent.click(screen.getByRole('dialog', { name: 'Transferência rápida' }).parentElement!)

  expect(transfer).toHaveBeenCalledTimes(1)
  expect(onClose).not.toHaveBeenCalled()
  finish()
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(toasts.some(([, kind]) => kind === 'error')).toBe(false)
})
