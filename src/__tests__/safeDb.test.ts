import fs from 'fs'
import path from 'path'

describe('safeDb — contratos arquiteturais', () => {
  const safeDbPath = path.join(
    process.cwd(),
    'src/lib/safeDb.ts'
  )

  const source = fs.readFileSync(
    safeDbPath,
    'utf8'
  )

  test('mantém as operações públicas principais', () => {
    expect(source).toContain(
      'export async function safeAdd'
    )

    expect(source).toContain(
      'export async function safeUpdate'
    )

    expect(source).toContain(
      'export async function safeDelete'
    )
  })

  test('opera junto da fila local de sincronização', () => {
    expect(source).toContain('addToSyncQueue')
    expect(source).toContain('db.syncQueue')
  })

  test('preserva transações Dexie nas mutações compostas', () => {
    expect(source).toContain('db.transaction')
  })

  test('valida existência antes de atualizar ou excluir', () => {
    expect(source).toContain(
      'Registro não encontrado'
    )
  })

  test('mantém proteção de ownership por usuário', () => {
    expect(source).toContain('user_id')
    expect(source).toContain('userId')
  })

  test('mantém proteção específica de categorias padrão', () => {
    expect(source).toContain('is_default')
    expect(source).toContain(
      'Categorias padrão não podem ser excluídas'
    )
  })
})
