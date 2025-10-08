import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.unveil.wedding',
  appName: 'Unveil',
  webDir: '.next',
  server: {
    url: 'http://localhost:3000',
    cleartext: true
  }
};

export default config;
