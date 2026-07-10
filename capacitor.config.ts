import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dafamilialanches.app',
  appName: 'DFL Finance',
  webDir: 'out',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    GoogleAuth: {
      serverClientId: '726269935852-l4lu5tqigkvarjb47juqta6ksr9g94eq.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
