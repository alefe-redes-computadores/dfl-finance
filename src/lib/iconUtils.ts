// src/lib/iconUtils.ts
import type { ComponentType } from 'react'
import * as Icons from 'lucide-react'
import { ICON_CATEGORIES } from '@/constants/iconLibrary'

type LucideIconComponent = ComponentType<{
  size?: number | string
  color?: string
  strokeWidth?: number | string
  className?: string
}>

const FALLBACK_ICON = Icons.Tag

const LIBRARY_ICON_NAMES = Array.from(
  new Set(Object.values(ICON_CATEGORIES).flat())
)

const toPascalCase = (value: string) => {
  return value
    .trim()
    .replace(/Icon$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

const compactIconName = (value: string) => {
  return value
    .trim()
    .replace(/Icon$/i, '')
    .replace(/[\s_-]+/g, '')
    .toLowerCase()
}

const findLegacyLibraryName = (value: string) => {
  const compact = compactIconName(value)

  return LIBRARY_ICON_NAMES.find(
    iconName => compactIconName(iconName) === compact
  )
}

export const normalizeIconName = (
  iconName?: string | null
) => {
  if (!iconName) return ''

  const raw = String(iconName).trim()
  if (!raw) return ''

  const directCandidates = Array.from(
    new Set([
      raw,
      raw.replace(/Icon$/i, ''),
      raw.charAt(0).toUpperCase() + raw.slice(1),
      toPascalCase(raw),
    ].filter(Boolean))
  )

  for (const candidate of directCandidates) {
    if ((Icons as Record<string, unknown>)[candidate]) {
      return candidate
    }
  }

  const legacyName = findLegacyLibraryName(raw)

  if (legacyName && (Icons as Record<string, unknown>)[legacyName]) {
    return legacyName
  }

  return ''
}

export const getDynamicIcon = (
  iconName?: string | null
): LucideIconComponent => {
  const normalizedName = normalizeIconName(iconName)

  if (!normalizedName) {
    return FALLBACK_ICON
  }

  const icon = (Icons as Record<string, unknown>)[normalizedName]

  if (
    typeof icon === 'function' ||
    (typeof icon === 'object' && icon !== null)
  ) {
    return icon as LucideIconComponent
  }

  return FALLBACK_ICON
}
