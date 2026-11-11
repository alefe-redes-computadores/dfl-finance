import {
  defaultTaxProfile, normalizeCommercialTaxProfiles, estimatedDasDue,
  reminderDasCompetences, visibleDasCompetences, dasDisplayStatus,
  validCompetence, monthOffset, estimatedDasnDue,
} from '@/lib/meiObligations'

const id = 'e4bb4011-15f2-4dd9-ace4-0c5e331d0203'
const today = new Date(2026, 10, 10, 12)

describe('R465 — MEI assistivo, sem ficção tributária', () => {
  it('não aceita empresa ou competências inválidas no JSON', () => {
    const data = normalizeCommercialTaxProfiles({
      __proto__: { regime: 'mei' },
      [id]: { regime: 'mei', startCompetence: '2026-11', manuallyConfirmedDas: {
        '2026-11': '2026-12-12T10:00:00.000Z',
        '2026-13': '2026-12-13T10:00:00.000Z',
      } },
      bad: { regime: 'mei', startCompetence: '2020-01' },
    })
    expect(Object.keys(data)).toEqual([id])
    expect(data[id].manuallyConfirmedDas['2026-11']).toBeDefined()
    expect(data[id].manuallyConfirmedDas['2026-13']).toBeUndefined()
    expect(validCompetence('2026-00')).toBe(false)
    expect(validCompetence('2026-11')).toBe(true)
  })

  it('guia da competência é no mês seguinte, ajustando apenas sábado e domingo', () => {
    expect(estimatedDasDue('2026-10')).toBe('2026-11-20')
    expect(estimatedDasDue('2026-11')).toBe('2026-12-21')
    expect(estimatedDasDue('2026-12')).toBe('2027-01-20')
    expect(estimatedDasDue('2026-02')).toBe('2026-03-20')
    expect(estimatedDasDue('2026-13')).toBeNull()
    expect(monthOffset('2026-12', 1)).toBe('2027-01')
    expect(estimatedDasnDue(2026)).toBe('2027-05-31')
  })

  it('não inventa atraso nem notificação para empresa fora do MEI', () => {
    const p = defaultTaxProfile()
    expect(visibleDasCompetences(p, today)).toEqual([])
    expect(reminderDasCompetences(p, today)).toEqual([])
    expect(dasDisplayStatus(p, '2026-09', '2026-11-10')).toBe('date-passed-unconfirmed')
  })

  it('baixa manual cancela apenas a competência correspondente', () => {
    const p = { ...defaultTaxProfile(), regime: 'mei' as const,
      startCompetence: '2026-09', manuallyConfirmedDas: { '2026-10': '2026-11-01T12:00:00.000Z' } }
    expect(visibleDasCompetences(p, today)).toContain('2026-11')
    expect(reminderDasCompetences(p, today)).not.toContain('2026-10')
    expect(reminderDasCompetences(p, today)).toContain('2026-11')
    expect(dasDisplayStatus(p, '2026-10')).toBe('confirmed-manually')
    expect(dasDisplayStatus(p, '2026-09', '2026-11-10')).toBe('date-passed-unconfirmed')
    expect(dasDisplayStatus(p, '2026-11', '2026-11-10')).toBe('upcoming')
  })

  it('sem competência inicial não há alertas fiscais presumidos', () => {
    const p = { ...defaultTaxProfile(), regime: 'mei' as const }
    expect(reminderDasCompetences(p, today)).toHaveLength(0)
    expect(visibleDasCompetences(p, today)).toHaveLength(0)
  })
})
