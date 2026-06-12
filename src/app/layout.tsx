import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DFL Finance',
  description: 'Controle financeiro DFL',
  manifest: '/manifest.json',
  themeColor: '#1a6b5c',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
