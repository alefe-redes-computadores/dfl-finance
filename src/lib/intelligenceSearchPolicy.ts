import type { IntelligenceGroup } from './financeIntelligenceNavigation'

export function normalizeIntelligenceSearch(value: string): string[] {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim().split(/\s+/).filter(Boolean)
}

export function searchIntelligenceGroups(
  groups: readonly IntelligenceGroup[],
  filter: string,
  query: string
): IntelligenceGroup[] {
  const tokens = normalizeIntelligenceSearch(query)
  return groups
    .filter(group => filter === 'all' || group.id === filter)
    .map(group => ({
      ...group,
      links: group.links.filter(link => {
        if (!tokens.length) return true
        const content = normalizeIntelligenceSearch([
          group.title, group.description,
          link.title, link.description, link.tag
        ].join(' ')).join(' ')
        return tokens.every(token => content.includes(token))
      })
    }))
    .filter(group => group.links.length > 0)
}
