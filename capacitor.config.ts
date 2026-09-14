// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  /*
   * Identidade nativa definitiva do DFL Finance.
   *
   * Deve permanecer estável depois da primeira publicação
   * Android porque passa a identificar o aplicativo nativo.
   */
  appId: 'com.dflfinance.app',
  appName: 'DFL Finance',
  webDir: 'out',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#0f172a',
    },
  },
}

export default config
