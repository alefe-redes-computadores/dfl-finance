// src/__tests__/safeDb.test.ts

import { safeAdd, safeUpdate, safeDelete } from '@/lib/safeDb'
import { db } from '@/lib/db'

// 🔥 MOCK do addToSyncQueue
jest.mock('@/lib/db', () => ({
  db: {
    table: jest.fn().mockReturnThis(),
    get: jest.fn(),
    add: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  addToSyncQueue: jest.fn().mockResolvedValue(true)
}))

describe('🧪 TESTE DE BLINDAGEM — safeDb', () => {

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ============================================================
  // TESTE 1: safeAdd deve falhar se ID já existir
  // ============================================================
  test('❌ safeAdd falha se ID já existir', async () => {
    const mockGet = jest.spyOn(db.table('transactions'), 'get')
    mockGet.mockResolvedValue({ id: 'existing-id', amount: 100 })

    const result = await safeAdd('transactions', { id: 'existing-id', amount: 200 }, 'user-123')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Já existe um registro')
    expect(mockGet).toHaveBeenCalledWith('existing-id')
  })

  // ============================================================
  // TESTE 2: safeUpdate deve falhar se ID não existir
  // ============================================================
  test('❌ safeUpdate falha se ID não existir', async () => {
    const mockGet = jest.spyOn(db.table('transactions'), 'get')
    mockGet.mockResolvedValue(null)

    const result = await safeUpdate('transactions', 'non-existent', { amount: 200 }, 'user-123')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Registro não encontrado')
    expect(mockGet).toHaveBeenCalledWith('non-existent')
  })

  // ============================================================
  // TESTE 3: safeUpdate deve falhar se nenhuma linha for afetada
  // ============================================================
  test('❌ safeUpdate falha se nenhuma linha for afetada', async () => {
    const mockGet = jest.spyOn(db.table('transactions'), 'get')
    mockGet.mockResolvedValue({ id: 'existing-id', amount: 100 })

    const mockUpdate = jest.spyOn(db.table('transactions'), 'update')
    mockUpdate.mockResolvedValue(0)

    const result = await safeUpdate('transactions', 'existing-id', { amount: 200 }, 'user-123')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Nenhuma linha afetada')
    expect(mockUpdate).toHaveBeenCalledWith('existing-id', { amount: 200 })
  })

  // ============================================================
  // TESTE 4: safeDelete deve falhar se ID não existir
  // ============================================================
  test('❌ safeDelete falha se ID não existir', async () => {
    const mockGet = jest.spyOn(db.table('transactions'), 'get')
    mockGet.mockResolvedValue(null)

    const result = await safeDelete('transactions', 'non-existent', 'user-123')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Registro não encontrado')
    expect(mockGet).toHaveBeenCalledWith('non-existent')
  })

  // ============================================================
  // TESTE 5: safeDelete deve falhar se transação tiver dependências
  // ============================================================
  test('❌ safeDelete falha se transação tiver dependências', async () => {
    const mockGet = jest.spyOn(db.table('transactions'), 'get')
    mockGet.mockResolvedValue({ 
      id: 'tx-123', 
      account_id: 'acc-123',
      amount: 100 
    })

    const mockAccountGet = jest.spyOn(db.table('accounts'), 'get')
    mockAccountGet.mockResolvedValue({ id: 'acc-123', name: 'Conta Teste' })

    const result = await safeDelete('transactions', 'tx-123', 'user-123')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Esta transação está vinculada a uma conta')
  })

  // ============================================================
  // TESTE 6: safeAdd deve funcionar corretamente
  // ============================================================
  test('✅ safeAdd funciona corretamente', async () => {
    const mockGet = jest.spyOn(db.table('transactions'), 'get')
    mockGet.mockResolvedValue(null)

    const mockAdd = jest.spyOn(db.table('transactions'), 'add')
    mockAdd.mockResolvedValue('new-id')

    const result = await safeAdd('transactions', { amount: 100 }, 'user-123')

    expect(result.success).toBe(true)
    expect(result.id).toBe('new-id')
    expect(mockAdd).toHaveBeenCalled()
  })

  // ============================================================
  // TESTE 7: safeUpdate deve funcionar corretamente
  // ============================================================
  test('✅ safeUpdate funciona corretamente', async () => {
    const mockGet = jest.spyOn(db.table('transactions'), 'get')
    mockGet.mockResolvedValue({ id: 'existing-id', amount: 100 })

    const mockUpdate = jest.spyOn(db.table('transactions'), 'update')
    mockUpdate.mockResolvedValue(1)

    const result = await safeUpdate('transactions', 'existing-id', { amount: 200 }, 'user-123')

    expect(result.success).toBe(true)
    expect(result.affected).toBe(1)
    expect(mockUpdate).toHaveBeenCalledWith('existing-id', { amount: 200 })
  })

  // ============================================================
  // TESTE 8: safeDelete deve funcionar corretamente
  // ============================================================
  test('✅ safeDelete funciona corretamente', async () => {
    const mockGet = jest.spyOn(db.table('transactions'), 'get')
    mockGet.mockResolvedValue({ id: 'tx-123', amount: 100 })

    const mockDelete = jest.spyOn(db.table('transactions'), 'delete')
    mockDelete.mockResolvedValue(1)

    const result = await safeDelete('transactions', 'tx-123', 'user-123')

    expect(result.success).toBe(true)
    expect(mockDelete).toHaveBeenCalledWith('tx-123')
  })
})