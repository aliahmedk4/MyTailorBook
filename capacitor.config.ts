import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ali.mytailorbook',
  appName: 'MyTailorBook',
  webDir: 'www',
  plugins: {
    GoogleAuth: {
      scopes: ['https://www.googleapis.com/auth/drive.appdata'],
      clientId: '698576182522-049gdgch1cc0d3tpfkfsceeugmuh4tip.apps.googleusercontent.com',
      serverClientId: '698576182522-ca5o3snq3bfopn0b2nibqh5tq08b7tog.apps.googleusercontent.com',
      forceCodeForRefreshToken: false
    }
  }
};

export default config;
