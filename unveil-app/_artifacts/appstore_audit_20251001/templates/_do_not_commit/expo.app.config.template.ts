import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  
  // Basic App Information
  name: 'Unveil',
  slug: 'unveil-wedding-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  
  // Splash Screen Configuration
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FFF5E5',
  },
  
  // Updates Configuration
  updates: {
    fallbackToCacheTimeout: 0,
    url: 'https://u.expo.dev/your-project-id', // Replace with actual project ID
  },
  runtimeVersion: {
    policy: 'sdkVersion',
  },
  
  // Asset Bundle Configuration
  assetBundlePatterns: ['**/*'],
  
  // iOS Configuration
  ios: {
    // Bundle Configuration
    bundleIdentifier: 'com.unveil.wedding',
    buildNumber: '1',
    supportsTablet: true,
    
    // Icons and Launch Images
    icon: './assets/ios-icon.png',
    
    // App Store Configuration
    config: {
      usesNonExemptEncryption: false,
    },
    
    // Associated Domains for Universal Links
    associatedDomains: [
      'applinks:app.sendunveil.com',
    ],
    
    // URL Schemes
    scheme: 'unveil',
    
    // Info.plist Configuration
    infoPlist: {
      // Privacy Usage Descriptions
      NSCameraUsageDescription: 'Unveil uses the camera to capture and share photos and videos at your wedding events.',
      NSPhotoLibraryUsageDescription: 'Unveil accesses your photo library to let you select and share existing photos at wedding events.',
      NSPhotoLibraryAddUsageDescription: 'Unveil can save wedding photos and videos to your photo library for safekeeping.',
      NSMicrophoneUsageDescription: 'Unveil uses the microphone to record audio when capturing videos at wedding events.',
      NSContactsUsageDescription: 'Unveil can access your contacts to help you easily invite guests to wedding events.',
      
      // App Transport Security
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        NSExceptionDomains: {
          'app.sendunveil.com': {
            NSExceptionAllowsInsecureHTTPLoads: false,
            NSExceptionMinimumTLSVersion: 'TLSv1.2',
            NSIncludesSubdomains: true,
          },
          'wvhtbqvnamerdkkjknuv.supabase.co': {
            NSExceptionAllowsInsecureHTTPLoads: false,
            NSExceptionMinimumTLSVersion: 'TLSv1.2',
            NSIncludesSubdomains: true,
          },
        },
      },
      
      // Background Modes
      UIBackgroundModes: ['background-processing', 'remote-notification'],
      
      // Supported Interface Orientations
      UISupportedInterfaceOrientations: [
        'UIInterfaceOrientationPortrait',
        'UIInterfaceOrientationPortraitUpsideDown',
      ],
      
      // Status Bar Configuration
      UIStatusBarStyle: 'UIStatusBarStyleDefault',
      UIViewControllerBasedStatusBarAppearance: true,
      
      // File Sharing (disabled for privacy)
      UIFileSharingEnabled: false,
      LSSupportsOpeningDocumentsInPlace: false,
      
      // App Category
      LSApplicationCategoryType: 'public.app-category.lifestyle',
      
      // Minimum iOS Version
      MinimumOSVersion: '13.0',
    },
    
    // Entitlements
    entitlements: {
      'com.apple.developer.associated-domains': [
        'applinks:app.sendunveil.com',
      ],
      'aps-environment': 'production', // Use 'development' for dev builds
      'com.apple.developer.default-data-protection': 'NSFileProtectionComplete',
    },
    
    // Privacy Manifest (iOS 17+)
    privacyManifests: {
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhoneNumber',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeName',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhotos',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
      ],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
      ],
    },
  },
  
  // Android Configuration (for future support)
  android: {
    package: 'com.unveil.wedding',
    versionCode: 1,
    icon: './assets/android-icon.png',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFF5E5',
    },
    permissions: [
      'android.permission.CAMERA',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'app.sendunveil.com',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  
  // Web Configuration
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },
  
  // Plugin Configuration
  plugins: [
    'expo-router',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow Unveil to access your camera to capture photos and videos for wedding events.',
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission: 'Allow Unveil to access your photos to share memories from wedding events.',
        savePhotosPermission: 'Allow Unveil to save wedding photos to your device.',
        isAccessMediaLocationEnabled: true,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow Unveil to access your photos to share memories from wedding events.',
        cameraPermission: 'Allow Unveil to access your camera to capture photos and videos for wedding events.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#E15B50',
        defaultChannel: 'default',
        sounds: ['./assets/notification.wav'],
      },
    ],
    [
      'expo-linking',
      {
        scheme: 'unveil',
      },
    ],
    [
      'expo-contacts',
      {
        contactsPermission: 'Allow Unveil to access your contacts to help invite guests to wedding events.',
      },
    ],
    // WebView plugin for displaying the Next.js app
    [
      'react-native-webview',
      {
        // WebView specific configuration
      },
    ],
    // File system access
    'expo-file-system',
    // Device information
    'expo-device',
    // Network status
    'expo-network',
    // Haptic feedback
    'expo-haptics',
    // Clipboard access
    'expo-clipboard',
    // Sharing functionality
    'expo-sharing',
    // Screen orientation
    'expo-screen-orientation',
    // Status bar
    'expo-status-bar',
    // Font loading
    'expo-font',
    // Asset loading
    'expo-asset',
    // Constants
    'expo-constants',
    // Application lifecycle
    'expo-application',
    // Secure store for sensitive data
    'expo-secure-store',
    // Local authentication (biometrics)
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Allow Unveil to use Face ID for secure authentication.',
      },
    ],
  ],
  
  // Experimental Features
  experiments: {
    typedRoutes: false,
  },
  
  // Extra Configuration
  extra: {
    // Environment variables accessible in the app
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://app.sendunveil.com',
    
    // EAS configuration
    eas: {
      projectId: 'your-eas-project-id', // Replace with actual EAS project ID
    },
  },
  
  // Owner configuration (for EAS)
  owner: 'your-expo-username', // Replace with your Expo username
});

// Development vs Production Configuration
const isDevelopment = process.env.NODE_ENV === 'development';

if (isDevelopment) {
  // Development-specific overrides
  config.ios!.entitlements!['aps-environment'] = 'development';
  config.updates!.url = undefined; // Disable OTA updates in development
}
