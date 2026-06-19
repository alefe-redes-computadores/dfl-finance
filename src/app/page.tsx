import type { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#14b8a6',
}

export const metadata: Metadata = {
  title: 'DFL Finance',
  description: 'Gestão inteligente do seu dinheiro',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DFL',
  },
  icons: {
    icon: '/icon-192x192.png',
    apple: '/icon-192x192.png',
  },
}

export default function Page() {
  redirect('/home');
}
