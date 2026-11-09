import {
  clearCommercialAllocationIntent,
  loadCommercialAllocationIntent,
  makeCommercialAllocationIntent,
  saveCommercialAllocationIntent,
  type CommercialAllocationIntent,
} from '@/lib/commercialAllocationIntent'
import { COMMERCIAL_PAGE_SIZE, fetchCompleteCommercialRows } from '@/lib/commercialLedgerPagination'

const owner = '11111111-1111-4111-8111-111111111111'
const anotherOwner = '22222222-2222-4222-8222-222222222222'
const sale = '33333333-3333-4333-8333-333333333333'
const receipt = '44444444-4444-4444-8444-444444444444'
const store = '55555555-5555-4555-8555-555555555555'
const platform = '66666666-6666-4666-8666-666666666666'
const intent: CommercialAllocationIntent = {
  key: '77777777-7777-4777-8777-777777777777',
  ownerId: owner, storeId: store, platformId: platform,
  saleId: sale, receiptId: receipt, amountCents: 1500,
  createdAt: '2026-11-09T12:00:00.000Z',
}

function uuid(i: number): string {
  const h = i.toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${h}`
}

beforeEach(() => localStorage.clear())

describe('R462 — intenção idempotente comercial durável', () => {
  test('salva antes da RPC, sobrevive reabertura e permite replay da mesma chave/payload', () => {
    saveCommercialAllocationIntent(intent)
    expect(loadCommercialAllocationIntent(owner)).toEqual(intent)
    saveCommercialAllocationIntent(intent)
    expect(loadCommercialAllocationIntent(owner)?.key).toBe(intent.key)
    clearCommercialAllocationIntent(intent)
    expect(loadCommercialAllocationIntent(owner)).toBeNull()
  })

  test('uma nova intenção não substitui tentativa incerta', () => {
    saveCommercialAllocationIntent(intent)
    const changed = { ...intent, key: uuid(13), amountCents: 2000 }
    expect(() => saveCommercialAllocationIntent(changed)).toThrow(/anterior/)
    expect(loadCommercialAllocationIntent(owner)).toEqual(intent)
    expect(() => saveCommercialAllocationIntent({ ...intent, amountCents: 4000 })).toThrow(/anterior/)
  })

  test('limpeza exige chave idêntica; usuário diferente permanece isolado', () => {
    const other = { ...intent, key: uuid(2), ownerId: anotherOwner }
    saveCommercialAllocationIntent(intent)
    saveCommercialAllocationIntent(other)
    expect(() => clearCommercialAllocationIntent({ ...intent, key: uuid(3) })).toThrow()
    clearCommercialAllocationIntent(intent)
    expect(loadCommercialAllocationIntent(anotherOwner)).toEqual(other)
  })

  test('dados corrompidos bloqueiam sobrescrita silenciosa', () => {
    localStorage.setItem(`dfl_finance_commercial_allocation_v1:${owner}`, '{')
    expect(() => loadCommercialAllocationIntent(owner)).toThrow(/corrompida/)
    expect(() => saveCommercialAllocationIntent(intent)).toThrow()
  })

  test('novas tentativas exigem UUID seguro no runtime', () => {
    // No Android/HTTPS a API Web Crypto fornece randomUUID; em runtime incompatível,
    // gerar uma chave fraca é proibido. Este teste confere contrato sem rede.
    if (typeof crypto.randomUUID !== 'function') {
      expect(() => makeCommercialAllocationIntent({
        ownerId: owner, storeId: store, platformId: platform,
        saleId: sale, receiptId: receipt, amountCents: 1000,
      })).toThrow(/segura/)
    } else {
      const created = makeCommercialAllocationIntent({
        ownerId: owner, storeId: store, platformId: platform,
        saleId: sale, receiptId: receipt, amountCents: 1000,
      })
      expect(created.key).toMatch(/^[0-9a-f-]{36}$/i)
    }
  })
})

describe('R462 — paginação integral comercial', () => {
  test('carrega 605 registros, sem truncar em 500/1000', async () => {
    const source = Array.from({ length: 605 }, (_, i) => ({ id: uuid(i + 1) }))
    const reads: string[] = []
    const rows = await fetchCompleteCommercialRows(
      async (after, size) => {
        reads.push(after ?? 'FIRST')
        return { data: source.filter(r => after === null || r.id > after).slice(0, size), count: source.length }
      },
      async () => ({ count: source.length }),
    )
    expect(rows).toHaveLength(605)
    expect(new Set(rows.map(x => x.id)).size).toBe(605)
    expect(reads).toHaveLength(4)
    expect(COMMERCIAL_PAGE_SIZE).toBe(200)
  })

  test('detecta página perdida e bloqueia total parcial', async () => {
    const all = Array.from({ length: 420 }, (_, i) => ({ id: uuid(i + 1) }))
    let called = 0
    await expect(fetchCompleteCommercialRows(
      async (after, size) => {
        called += 1
        return { data: called === 2 ? [] : all.filter(r => after === null || r.id > after).slice(0, size), count: all.length }
      },
      async () => ({ count: all.length }),
    )).rejects.toThrow(/incompleta|mudou/)
  })

  test('detecta contagem alterada durante leitura', async () => {
    const all = Array.from({ length: 220 }, (_, i) => ({ id: uuid(i + 1) }))
    await expect(fetchCompleteCommercialRows(
      async (after, size) => ({ data: all.filter(r => after === null || r.id > after).slice(0, size), count: all.length }),
      async () => ({ count: all.length + 1 }),
    )).rejects.toThrow(/mudou|incompleta/)
  })

  test('detecta ID duplicado e erro de consulta', async () => {
    await expect(fetchCompleteCommercialRows(
      async () => ({ data: [{ id: uuid(1) }, { id: uuid(1) }], count: 2 }),
      async () => ({ count: 2 }),
    )).rejects.toThrow(/duplicados/)
    await expect(fetchCompleteCommercialRows(
      async () => ({ data: null, count: null, error: { message: 'falha HTTP' } }),
      async () => ({ count: 0 }),
    )).rejects.toThrow(/falha HTTP/)
  })

  test('volume excessivo falha fechado, sem exibir total enganoso', async () => {
    await expect(fetchCompleteCommercialRows(
      async () => ({ data: [{ id: uuid(1) }], count: 50001 }),
      async () => ({ count: 50001 }),
    )).rejects.toThrow(/excede limite/)
  })
})
