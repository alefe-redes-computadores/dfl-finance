// src/lib/iconUtils.ts
import * as Icons from 'lucide-react'

type LucideIconComponent = React.ComponentType<{
  size?: number | string
  color?: string
  strokeWidth?: number | string
  className?: string
}>

const FALLBACK_ICON = Icons.Tag

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

export const normalizeIconName = (iconName?: string | null) => {
  if (!iconName) return ''
  return toPascalCase(String(iconName))
}

export const getDynamicIcon = (
  iconName?: string | null
): LucideIconComponent => {
  if (!iconName) return FALLBACK_ICON

  const raw = String(iconName).trim()

  const candidates = Array.from(
    new Set([
      raw,
      raw.replace(/Icon$/i, ''),
      raw.charAt(0).toUpperCase() + raw.slice(1),
      toPascalCase(raw),
    ].filter(Boolean))
  )

  for (const candidate of candidates) {
    const icon = (Icons as Record<string, unknown>)[candidate]

    if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null)) {
      return icon as LucideIconComponent
    }
  }

  return FALLBACK_ICON
}
