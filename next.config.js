// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // Código adicional do service worker vive em worker/index.js.
  // next-pwa continua sendo o único gerador/registrador de /sw.js.
  customWorkerDir: 'worker',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-cache',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365,
        },
      },
    },
    {
      urlPattern: /^https:\/\/bwggczkzsqcdeayyysmx\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'supabase-storage-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // O build web/Vercel usa o runtime normal do Next.
  // O export estático do Capacitor será tratado por um build mobile dedicado.
  
  // TypeScript volta a ser gate real do build.
  // O projeto está com tsc --noEmit global zerado.
  eslint: {
    ignoreDuringBuilds: false,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'bwggczkzsqcdeayyysmx.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      }
    }
    return config
  },
}

module.exports = withPWA(nextConfig)
