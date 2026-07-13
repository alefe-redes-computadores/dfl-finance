import type { Metadata, Viewport } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/contexts/ToastContext'
import ErudaButton from '@/components/ErudaButton' // 🔥 Importando o botão secreto

// Configuração oficial da Fonte Poppins
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Meu App Financeiro',
  description: 'Controle de Finanças Premium',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Meu App',
  },
}

// 🔥 ISSO IMPEDE O ZOOM NO IPHONE AO CLICAR EM INPUTS
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f9fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} font-sans antialiased`} suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 min-h-screen selection:bg-teal-500/30">
        <ToastProvider>
          {children}
          
          {/* 🔥 Botão invisível (só aparece com ?debug=1) */}
          <ErudaButton />
        </ToastProvider>
      </body>
    </html>
  )
}
