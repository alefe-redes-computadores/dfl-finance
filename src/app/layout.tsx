// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/contexts/ToastContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { BottomNavOverlayProvider } from '@/contexts/BottomNavOverlayContext'
import CapacitorStatusBar from '@/components/CapacitorStatusBar'
import { NativeAuthProvider } from '@/contexts/NativeAuthContext'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'DFL Finance',
  applicationName: 'DFL Finance',
  description: 'Controle financeiro pessoal e empresarial',
  manifest: '/manifest.json',
  icons: {
    icon: [
      {
        url: '/favicon.ico',
      },
      {
        url: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        url: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    shortcut: '/favicon.ico',
    apple: [
      {
        url: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DFL Finance',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a',
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
        <NativeAuthProvider>
          <ThemeProvider>
            <CapacitorStatusBar />
            <ToastProvider>
              <BottomNavOverlayProvider>
                {children}
              </BottomNavOverlayProvider>
            </ToastProvider>
          </ThemeProvider>
        </NativeAuthProvider>
      </body>
    </html>
  )
}
