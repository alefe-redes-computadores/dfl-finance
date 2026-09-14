// next.config.js

const withPWA = require('next-pwa')({
  dest: 'public',

  disable:
    process.env.NODE_ENV === 'development',

  register: true,
  skipWaiting: true,

  /*
   * O DFL Finance é local-first.
   *
   * Ao navegar via App Router, o navegador pode trocar de
   * rota sem fazer uma navegação HTML tradicional. Sem esta
   * opção, a rota visitada pode nunca entrar no cache do SW
   * e falhar quando a PWA for reaberta offline.
   */
  cacheOnFrontEndNav: true,

  /*
   * O syncEngine já reage ao evento "online" e processa a
   * fila local. Não queremos um reload forçado competindo
   * com mutações pendentes quando a rede reaparecer.
   */
  reloadOnOnline: false,

  cacheStartUrl: true,
  dynamicStartUrl: true,

  /*
   * Se uma rota ainda não tiver sido visitada/cacheada,
   * mostramos um fallback controlado pelo próprio app em
   * vez da tela genérica "Você está offline" do navegador.
   */
  fallbacks: {
    document: '/offline',
  },

  // Extensão de push/notificationclick.
  // O fetch/cache continua sob responsabilidade do Workbox.
  customWorkerDir: 'worker',

  /*
   * IMPORTANTE:
   * Ao informar runtimeCaching manualmente, deixamos de
   * depender implicitamente do conjunto padrão do next-pwa.
   * Por isso o shell local do app é declarado aqui.
   *
   * Regras mais específicas vêm antes das mais amplas.
   */
  runtimeCaching: [
    {
      urlPattern:
        /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName:
          'google-fonts-cache',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds:
            60 * 60 * 24 * 365,
        },
      },
    },

    {
      urlPattern:
        /^https:\/\/bwggczkzsqcdeayyysmx\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName:
          'supabase-storage-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds:
            60 * 60 * 24 * 30,
        },
      },
    },

    /*
     * Chunks imutáveis gerados pelo Next.
     */
    {
      urlPattern:
        /\/_next\/static\/.*$/i,
      handler: 'CacheFirst',
      options: {
        cacheName:
          'next-static-assets',
        expiration: {
          maxEntries: 160,
          maxAgeSeconds:
            60 * 60 * 24 * 30,
        },
      },
    },

    /*
     * JS/CSS e fontes locais do app.
     */
    {
      urlPattern:
        /\.(?:js|css|woff|woff2|ttf|otf)$/i,
      handler:
        'StaleWhileRevalidate',
      options: {
        cacheName:
          'app-static-resources',
        expiration: {
          maxEntries: 160,
          maxAgeSeconds:
            60 * 60 * 24 * 30,
        },
      },
    },

    /*
     * Imagens e logos locais.
     */
    {
      urlPattern:
        /\.(?:png|jpg|jpeg|gif|webp|svg|ico)$/i,
      handler:
        'StaleWhileRevalidate',
      options: {
        cacheName:
          'app-image-resources',
        expiration: {
          maxEntries: 160,
          maxAgeSeconds:
            60 * 60 * 24 * 30,
        },
      },
    },

    /*
     * Não existe um catch-all de rede aqui de propósito.
     *
     * cacheOnFrontEndNav + cacheStartUrl cuidam do shell
     * visitado pelo usuário e `fallbacks.document` atende
     * uma navegação ainda indisponível offline.
     *
     * Requisições de API, Supabase, IA e outros serviços
     * não devem cair acidentalmente em um cache genérico.
     */
  ],
})

/** @type {import('next').NextConfig} */
const isMobileBuild =
  process.env.DFL_BUILD_TARGET === 'mobile'

const nextConfig = {
  reactStrictMode: true,

  /*
   * Dois targets, um único produto:
   *
   * - web: runtime Next normal na Vercel;
   * - mobile: export estático para o WebView Capacitor.
   *
   * As APIs NÃO fazem parte do runtime mobile.
   * Elas continuam hospedadas na Vercel e são acessadas
   * pela fronteira criada em src/lib/runtime/apiUrl.ts.
   */
  ...(isMobileBuild
    ? {
        output: 'export',
        trailingSlash: true,
      }
    : {}),

  /*
   * O build web/Vercel usa o runtime normal do Next.
   * O build Capacitor permanece separado.
   */

  eslint: {
    ignoreDuringBuilds: false,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname:
          'bwggczkzsqcdeayyysmx.supabase.co',
        pathname:
          '/storage/v1/object/public/**',
      },
    ],
    unoptimized: true,
  },

  webpack: (
    config,
    {
      isServer,
    }
  ) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      }
    }

    return config
  },
}

module.exports =
  withPWA(nextConfig)
