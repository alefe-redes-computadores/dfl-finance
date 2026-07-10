import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dafamilialanches.app',
  appName: 'DFL Finance',
  webDir: 'out', // 🔥 Aponta para a pasta estática que o Next.js vai gerar
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: true
  }
};

export default config;
