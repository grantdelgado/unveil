import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Basic App Configuration
  appId: 'com.unveil.wedding',
  appName: 'Unveil',
  webDir: 'out', // Next.js static export directory
  bundledWebRuntime: false,
  
  // Server Configuration (for development)
  server: {
    // Development server URL (update for your local setup)
    // url: 'http://localhost:3000',
    // cleartext: true, // Allow HTTP in development
    
    // Production: Comment out server config to use bundled web assets
  },
  
  // iOS Specific Configuration
  ios: {
    // App Scheme (should match bundle identifier)
    scheme: 'Unveil',
    
    // Content Inset Behavior
    contentInset: 'automatic',
    
    // Scroll Configuration
    scrollEnabled: true,
    allowsLinkPreview: false,
    
    // Background Color (matches brand colors)
    backgroundColor: '#FFF5E5',
    
    // Keyboard Configuration
    keyboardDisplayRequiresUserAction: false,
    
    // Status Bar Configuration
    preferredContentMode: 'mobile',
    
    // WKWebView Configuration
    limitsNavigationsToAppBoundDomains: true,
    
    // Handle Universal Links
    handleApplicationURL: true,
  },
  
  // Plugin Configuration
  plugins: {
    // App Plugin Configuration
    App: {
      launchShowDuration: 0, // Hide launch screen immediately when ready
      launchAutoHide: true,
      backgroundColor: '#FFF5E5',
      iosScheme: 'Unveil',
    },
    
    // Splash Screen Configuration
    SplashScreen: {
      launchShowDuration: 2000, // Show for 2 seconds
      launchAutoHide: true,
      backgroundColor: '#FFF5E5',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#E15B50',
      splashFullScreen: true,
      splashImmersive: true,
    },
    
    // Status Bar Configuration
    StatusBar: {
      style: 'LIGHT', // or 'DARK' based on your design
      backgroundColor: '#E15B50',
      overlaysWebView: false,
    },
    
    // Keyboard Configuration
    Keyboard: {
      resize: 'body',
      style: 'DARK', // or 'LIGHT'
      resizeOnFullScreen: true,
    },
    
    // Camera Plugin (for photo/video capture)
    Camera: {
      permissions: ['camera', 'photos'],
    },
    
    // Filesystem Plugin (for file operations)
    Filesystem: {
      iosScheme: 'Unveil',
    },
    
    // Device Plugin (for device information)
    Device: {
      // No specific configuration needed
    },
    
    // Network Plugin (for connectivity status)
    Network: {
      // No specific configuration needed
    },
    
    // Push Notifications (uncomment when implementing)
    /*
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    */
    
    // Local Notifications (uncomment when implementing)
    /*
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#E15B50',
      sound: 'beep.wav',
    },
    */
    
    // Haptics Plugin (for tactile feedback)
    Haptics: {
      // No specific configuration needed
    },
    
    // Share Plugin (for sharing content)
    Share: {
      // No specific configuration needed
    },
    
    // Browser Plugin (for opening external links)
    Browser: {
      // No specific configuration needed
    },
    
    // Toast Plugin (for toast notifications)
    Toast: {
      duration: 'short',
    },
    
    // Action Sheet Plugin (for action sheets)
    ActionSheet: {
      // No specific configuration needed
    },
    
    // Dialog Plugin (for native dialogs)
    Dialog: {
      // No specific configuration needed
    },
    
    // Clipboard Plugin (for clipboard operations)
    Clipboard: {
      // No specific configuration needed
    },
    
    // Geolocation Plugin (uncomment if location features added)
    /*
    Geolocation: {
      permissions: ['location'],
    },
    */
    
    // Motion Plugin (for device motion)
    /*
    Motion: {
      // No specific configuration needed
    },
    */
    
    // Screen Reader Plugin (for accessibility)
    ScreenReader: {
      // No specific configuration needed
    },
    
    // Text Zoom Plugin (for accessibility)
    TextZoom: {
      // No specific configuration needed
    },
  },
  
  // Security Configuration
  server: {
    // Allow navigation to these domains
    allowNavigation: [
      'app.sendunveil.com',
      'wvhtbqvnamerdkkjknuv.supabase.co',
      'api.twilio.com', // If direct API calls needed
    ],
    
    // Original URL for the app
    originalUrl: 'https://app.sendunveil.com',
    
    // HTTPS requirement
    iosScheme: 'https',
  },
  
  // Build Configuration
  android: {
    // Android specific config (for future Android support)
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  
  // Electron Configuration (for future desktop support)
  electron: {
    // Electron specific config
  },
};

export default config;
