import type { CSSProperties } from 'react'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'card' | 'circle' | 'rect'
  width?: string
  height?: string
  count?: number
}

export default function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
  count = 1,
}: SkeletonProps) {
  const baseClass = 'animate-pulse bg-gray-200 dark:bg-slate-700 rounded'

  const variantClass = {
    text: 'h-4 w-full rounded-md',
    card: 'h-24 w-full rounded-2xl',
    circle: 'rounded-full',
    rect: 'rounded-xl',
  }

  const style: CSSProperties = {}

  if (width) style.width = width
  if (height) style.height = height

  if (variant === 'circle') {
    style.width = width || '48px'
    style.height = height || '48px'
  }

  const elements = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`${baseClass} ${variantClass[variant]} ${className}`}
      style={style}
    />
  ))

  return <>{elements}</>
}