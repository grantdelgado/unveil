import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.unveil.wedding',
  appName: 'Unveil',
  webDir: 'out', // Next.js static export directory
  bundledWebRuntime: false,
  
  // Server Configuration (for development)
  server: {
    url: 'http://localhost:3000',
    cleartext: true, // Allow HTTP in development
  },
  
  // iOS Specific Configuration
  ios: {
    scheme: 'Unveil',
    contentInset: 'automatic',
    scrollEnabled: true,
    allowsLinkPreview: false,
    backgroundColor: '#FFF5E5',
    keyboardDisplayRequiresUserAction: false,
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: true,
    handleApplicationURL: true,
  },
  
  // Plugin Configuration
  plugins: {
    App: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#FFF5E5',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#FFF5E5',
      showSpinner: false,
      spinnerColor: '#E15B50',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#E15B50',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
