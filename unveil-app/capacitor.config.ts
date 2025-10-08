import type { CapacitorConfig } from '@capacitor/cli';

// Environment-driven server configuration
const target = process.env.CAP_SERVER_URL || undefined;

const config: CapacitorConfig = {
  appId: 'com.unveil.wedding',
  appName: 'Unveil',
  webDir: 'out', // Next.js static export directory (unused when server.url is set)
  
  // Server Configuration (environment-driven)
  server: target
    ? {
        url: target,
        cleartext: target.startsWith('http://'), // Allow HTTP for localhost
        allowNavigation: [new URL(target).hostname],
      }
    : undefined,
  
  // iOS Specific Configuration
  ios: {
    scheme: 'Unveil',
    contentInset: 'automatic',
    scrollEnabled: true,
    allowsLinkPreview: false,
    backgroundColor: '#FFF5E5',
    limitsNavigationsToAppBoundDomains: false, // Allow external navigation for debugging
    webContentsDebuggingEnabled: true, // Enable Safari Web Inspector
    allowsInlineMediaPlayback: true,
    mediaPlaybackRequiresUserAction: false,
    // iOS 26.0 WebView optimizations
    preferredContentMode: 'mobile',
    allowsBackForwardNavigationGestures: false,
    handleApplicationURL: false,
    inspectable: true,
    // iOS 26.0 specific settings
    allowsAirPlayForMediaPlayback: false,
    suppressesIncrementalRendering: false,
    // Enhanced debugging for iOS 26.0
    webContentsDebuggingEnabled: true,
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
