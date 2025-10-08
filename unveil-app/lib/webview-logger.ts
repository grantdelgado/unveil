/**
 * WebView Logger - Interface to native WebView logging
 */

import { Capacitor } from '@capacitor/core';

interface WebViewConfigPlugin {
  logFromJS(options: { message: string; level: 'info' | 'warn' | 'error' }): Promise<void>;
}

class WebViewLogger {
  private plugin: WebViewConfigPlugin | null = null;

  constructor() {
    if (Capacitor.isNativePlatform()) {
      this.plugin = Capacitor.Plugins.WebViewConfig as WebViewConfigPlugin;
    }
  }

  async log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    // Always log to console
    console[level](`[WebView] ${message}`);
    
    // Also log to native if available
    if (this.plugin) {
      try {
        await this.plugin.logFromJS({ message, level });
      } catch (error) {
        console.warn('Native logging failed:', error);
      }
    }
  }

  async info(message: string) {
    return this.log(message, 'info');
  }

  async warn(message: string) {
    return this.log(message, 'warn');
  }

  async error(message: string) {
    return this.log(message, 'error');
  }
}

// Global instance
export const webViewLogger = new WebViewLogger();

// Convenience function for quick logging
export function logToNative(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  webViewLogger.log(message, level);
}
