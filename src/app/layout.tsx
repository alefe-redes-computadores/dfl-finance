// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/contexts/ToastContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { BottomNavOverlayProvider } from '@/contexts/BottomNavOverlayContext'
import CapacitorStatusBar from '@/components/CapacitorStatusBar'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'DFL Finance',
  description: 'Controle financeiro pessoal e empresarial',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DFL Finance',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="pt-BR"
      className={`${poppins.variable} font-sans antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var storedTheme = localStorage.getItem('theme');
                var isDark = storedTheme === 'dark' ||
                  (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
                var root = document.documentElement;
                var themeColor = isDark ? '#0f172a' : '#f8f9fa';

                root.classList.toggle('dark', isDark);
                root.style.colorScheme = isDark ? 'dark' : 'light';
                root.style.backgroundColor = themeColor;

                var meta = document.querySelector('meta[name="theme-color"]');
                if (!meta) {
                  meta = document.createElement('meta');
                  meta.setAttribute('name', 'theme-color');
                  document.head.appendChild(meta);
                }
                meta.setAttribute('content', themeColor);
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-[100dvh] bg-gray-50 text-gray-900 selection:bg-teal-500/30 transition-colors duration-300 dark:bg-slate-900 dark:text-gray-100">
        <ThemeProvider>
          <CapacitorStatusBar />
          <ToastProvider>
            <BottomNavOverlayProvider>
              {children}
            </BottomNavOverlayProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
