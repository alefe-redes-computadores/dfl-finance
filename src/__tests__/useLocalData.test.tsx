import fs from 'fs'
import path from 'path'

describe('useLocalData — contratos arquiteturais', () => {
  const sourcePath = path.join(
    process.cwd(),
    'src/hooks/useLocalData.ts'
  )

  let source: string

  beforeAll(() => {
    source = fs.readFileSync(sourcePath, 'utf8')
  })

  it('continua sendo local-first via Dexie', () => {
    expect(source).toContain('useLiveQuery')
    expect(source).toContain('db.table')
  })

  it('mantém suporte aos índices candidatos', () => {
    expect(source).toContain('INDEX_CANDIDATES')
  })

  it('mantém filtros residuais após consulta indexada', () => {
    expect(source).toContain('activeFilters')
  })

  it('não força ordenação quando o campo não existe', () => {
    expect(source).toContain('shouldSort')
  })

  it('preserva suporte a limite de resultados', () => {
    expect(source).toContain('limit')
  })

  it('não reintroduz dependência remota no hook local', () => {
    expect(source).not.toContain('supabase.from')
    expect(source).not.toContain('supabase.auth')
  })
})
