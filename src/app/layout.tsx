import type { Metadata, Viewport } from 'next'
import { Poppins } from 'next/font/google'
import Script from 'next/script' // 🔥 Importação do Script do Next.js
import './globals.css'
import { ToastProvider } from '@/contexts/ToastContext'

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
        
        {/* 🔥 INJEÇÃO DO ERUDA PARA DEBUG NO CELULAR */}
        <Script
          src="https://cdn.jsdelivr.net/npm/eruda"
          strategy="afterInteractive"
          onLoad={() => {
            if (typeof window !== 'undefined' && (window as any).eruda) {
              (window as any).eruda.init();
              console.log("[Eruda] Console mobile ativado com sucesso!");
            }
          }}
        />

        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
