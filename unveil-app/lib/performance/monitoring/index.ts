/**
 * 🚨 PERFORMANCE MONITORING CENTER
 * 
 * Real-time performance monitoring and alerting system.
 * Provides development warnings and performance tracking.
 */

export * from './developmentAlerts';

// Re-export commonly used utilities
export {
  initializeDevelopmentAlerts,
  PerformanceAlertOverlay,
  usePerformanceAlert,
  trackSupabaseSubscription,
  developmentAlerts,
  PERFORMANCE_ALERTS as MONITORING_THRESHOLDS,
} from './developmentAlerts';

// Monitoring configuration
export const MONITORING_CONFIG = {
  enabledInDevelopment: true,
  enabledInProduction: false,
  alertOverlayEnabled: true,
  consoleLoggingEnabled: true,
  memoryMonitoringInterval: 30000, // 30 seconds
} as const;
