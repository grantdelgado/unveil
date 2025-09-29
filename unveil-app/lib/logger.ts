/**
 * Centralized Logging System for Unveil
 *
 * Provides consistent logging patterns with semantic emoji categories,
 * structured data support, and environment-aware logging strategies.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory =
  | 'auth' // Authentication & authorization
  | 'database' // Database operations & queries
  | 'api' // API calls & responses
  | 'realtime' // Real-time subscriptions & events
  | 'media' // File uploads & media handling
  | 'sms' // SMS & messaging operations
  | 'navigation' // Routing & navigation
  | 'validation' // Form validation & data validation
  | 'performance' // Performance monitoring
  | 'error' // Error handling & boundaries
  | 'dev' // Development-only logging
  | 'system'; // System events & lifecycle

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?:
    | Record<string, string | number | boolean | null>
    | string
    | number
    | boolean
    | null;
  timestamp: string;
  context?: string;
}

interface LoggerConfig {
  isDevelopment: boolean;
  enableStructuredLogging: boolean;
  logLevel: LogLevel;
  enabledCategories: LogCategory[];
  enableDebug: boolean;
}

// Default configuration
const defaultConfig: LoggerConfig = {
  isDevelopment: process.env.NODE_ENV === 'development',
  enableStructuredLogging: process.env.NODE_ENV === 'production',
  logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  enabledCategories:
    process.env.NODE_ENV === 'development'
      ? [
          'auth',
          'database',
          'api',
          'realtime',
          'media',
          'sms',
          'navigation',
          'validation',
          'performance',
          'error',
          'dev',
          'system',
        ]
      : ['error', 'api', 'database', 'system'], // Production: only critical categories
  enableDebug: process.env.NODE_ENV === 'development',
};

// Emoji mapping for visual categorization
const categoryEmojis: Record<LogCategory, string> = {
  auth: '🔐',
  database: '🗄️',
  api: '📡',
  realtime: '⚡',
  media: '📸',
  sms: '📱',
  navigation: '🧭',
  validation: '✅',
  performance: '⚡',
  error: '❌',
  dev: '🛠️',
  system: '🔧',
};

// Log level hierarchy for filtering
const logLevels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: LoggerConfig;
  private logHistory: LogEntry[] = [];

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  private shouldLog(level: LogLevel, category: LogCategory): boolean {
    // Check if log level meets minimum threshold
    if (logLevels[level] < logLevels[this.config.logLevel]) {
      return false;
    }

    // Check if category is enabled
    if (!this.config.enabledCategories.includes(category)) {
      return false;
    }

    return true;
  }

  private formatMessage(category: LogCategory, message: string): string {
    const emoji = categoryEmojis[category];
    return `${emoji} ${message}`;
  }

  private createLogEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?:
      | Record<string, string | number | boolean | null>
      | string
      | number
      | boolean
      | null,
    context?: string,
  ): LogEntry {
    return {
      level,
      category,
      message,
      data,
      context,
      timestamp: new Date().toISOString(),
    };
  }

  private writeLog(entry: LogEntry): void {
    const formattedMessage = this.formatMessage(entry.category, entry.message);

    // Filter out expected development mode WebSocket errors to reduce noise
    if (process.env.NODE_ENV === 'development') {
      const messageStr = typeof entry.message === 'string' ? entry.message : '';
      const isExpectedDevError =
        messageStr.includes('WebSocket connection') &&
        messageStr.includes(
          'WebSocket is closed before the connection is established',
        );

      if (isExpectedDevError) {
        // Only log these as debug level in development
        console.debug(
          '🔧 Development mode WebSocket warning (expected in React Strict Mode):',
          entry,
        );
        return;
      }
    }

    // Store in history for debugging
    if (this.config.isDevelopment) {
      this.logHistory.push(entry);
      // Keep only last 100 entries in development
      if (this.logHistory.length > 100) {
        this.logHistory.shift();
      }
    }

    // Structured logging for production
    if (this.config.enableStructuredLogging) {
      const structuredLog: Record<string, unknown> = {
        timestamp: entry.timestamp,
        level: entry.level,
        category: entry.category,
        message: entry.message,
      };

      if (entry.data) {
        structuredLog.data = entry.data;
      }

      if (entry.context) {
        structuredLog.context = entry.context;
      }

      switch (entry.level) {
        case 'error':
          console.error(JSON.stringify(structuredLog));
          break;
        case 'warn':
          console.warn(JSON.stringify(structuredLog));
          break;
        default:
          console.log(JSON.stringify(structuredLog));
      }
    } else {
      // Development logging with emojis and formatting
      switch (entry.level) {
        case 'error':
          console.error(formattedMessage, entry.data || '');
          break;
        case 'warn':
          console.warn(formattedMessage, entry.data || '');
          break;
        default:
          console.log(formattedMessage, entry.data || '');
      }
    }
  }

  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?:
      | Record<string, string | number | boolean | null>
      | string
      | number
      | boolean
      | null,
    context?: string,
  ): void {
    if (!this.shouldLog(level, category)) {
      return;
    }

    const entry = this.createLogEntry(level, category, message, data, context);
    this.writeLog(entry);
  }

  // Helper method to safely handle unknown error types
  private serializeError(
    error: unknown,
  ): Record<string, string | number | boolean | null> | string {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack || null,
      };
    }
    if (typeof error === 'string') {
      return error;
    }
    if (typeof error === 'object' && error !== null) {
      try {
        return JSON.stringify(error);
      } catch {
        return '[Unserializable Error Object]';
      }
    }
    return String(error);
  }

  // Category-specific logging methods
  auth(
    message: string,
    data?:
      | Record<string, string | number | boolean | null>
      | string
      | number
      | boolean
      | null,
    context?: string,
  ): void {
    this.log('info', 'auth', message, data, context);
  }

  authError(message: string, error?: unknown, context?: string): void {
    this.log('error', 'auth', message, this.serializeError(error), context);
  }

  database(message: string, data?: unknown, context?: string): void {
    this.log('info', 'database', message, this.serializeError(data), context);
  }

  databaseError(message: string, error?: unknown, context?: string): void {
    this.log('error', 'database', message, this.serializeError(error), context);
  }

  api(message: string, data?: unknown, context?: string): void {
    this.log('info', 'api', message, this.serializeError(data), context);
  }

  apiError(message: string, error?: unknown, context?: string): void {
    this.log('error', 'api', message, this.serializeError(error), context);
  }

  realtime(message: string, data?: unknown, context?: string): void {
    this.log('info', 'realtime', message, this.serializeError(data), context);
  }

  realtimeError(message: string, error?: unknown, context?: string): void {
    this.log('error', 'realtime', message, this.serializeError(error), context);
  }

  media(message: string, data?: unknown, context?: string): void {
    this.log('info', 'media', message, this.serializeError(data), context);
  }

  mediaError(message: string, error?: unknown, context?: string): void {
    this.log('error', 'media', message, this.serializeError(error), context);
  }

  sms(message: string, data?: unknown, context?: string): void {
    this.log('info', 'sms', message, this.serializeError(data), context);
  }

  smsError(message: string, error?: unknown, context?: string): void {
    this.log('error', 'sms', message, this.serializeError(error), context);
  }

  navigation(message: string, data?: unknown, context?: string): void {
    this.log('info', 'navigation', message, this.serializeError(data), context);
  }

  navigationError(message: string, error?: unknown, context?: string): void {
    this.log(
      'error',
      'navigation',
      message,
      this.serializeError(error),
      context,
    );
  }

  validation(message: string, data?: unknown, context?: string): void {
    this.log('info', 'validation', message, this.serializeError(data), context);
  }

  validationError(message: string, error?: unknown, context?: string): void {
    this.log(
      'error',
      'validation',
      message,
      this.serializeError(error),
      context,
    );
  }

  performance(message: string, data?: unknown, context?: string): void {
    this.log(
      'info',
      'performance',
      message,
      this.serializeError(data),
      context,
    );
  }

  performanceWarn(message: string, data?: unknown, context?: string): void {
    this.log(
      'warn',
      'performance',
      message,
      this.serializeError(data),
      context,
    );
  }

  error(message: string, error?: unknown, context?: string): void {
    try {
      this.log('error', 'error', message, this.serializeError(error), context);
    } catch (logError) {
      // Fallback logging if serialization fails
      console.error('[Logger Error]', message, String(error));
    }
  }

  warn(message: string, data?: unknown, context?: string): void {
    try {
      this.log('warn', 'system', message, this.serializeError(data), context);
    } catch (logError) {
      // Fallback logging if serialization fails
      console.warn('[Logger Warning]', message, String(data));
    }
  }

  info(message: string, data?: unknown, context?: string): void {
    this.log('info', 'system', message, this.serializeError(data), context);
  }

  debug(message: string, data?: unknown, context?: string): void {
    this.log('debug', 'dev', message, this.serializeError(data), context);
  }

  dev(message: string, data?: unknown, context?: string): void {
    this.log('info', 'dev', message, this.serializeError(data), context);
  }

  system(message: string, data?: unknown, context?: string): void {
    this.log('info', 'system', message, this.serializeError(data), context);
  }

  systemError(message: string, error?: unknown, context?: string): void {
    this.log('error', 'system', message, this.serializeError(error), context);
  }

  // Utility methods
  getLogHistory(): LogEntry[] {
    return [...this.logHistory];
  }

  clearHistory(): void {
    this.logHistory = [];
  }

  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Performance timing utilities
  time(label: string): void {
    if (this.config.isDevelopment) {
      console.time(`⚡ ${label}`);
    }
  }

  timeEnd(label: string): void {
    if (this.config.isDevelopment) {
      console.timeEnd(`⚡ ${label}`);
    }
  }
}

// Create singleton instance
export const logger = new Logger();

// Export for testing and advanced usage
export { Logger };

// Convenience exports for common patterns
export const logAuth = logger.auth.bind(logger);
export const logAuthError = logger.authError.bind(logger);
export const logDatabase = logger.database.bind(logger);
export const logDatabaseError = logger.databaseError.bind(logger);
export const logApi = logger.api.bind(logger);
export const logApiError = logger.apiError.bind(logger);
export const logRealtime = logger.realtime.bind(logger);
export const logRealtimeError = logger.realtimeError.bind(logger);
export const logMedia = logger.media.bind(logger);
export const logMediaError = logger.mediaError.bind(logger);
export const logSms = logger.sms.bind(logger);
export const logSmsError = logger.smsError.bind(logger);
export const logNavigation = logger.navigation.bind(logger);
export const logNavigationError = logger.navigationError.bind(logger);
export const logValidation = logger.validation.bind(logger);
export const logValidationError = logger.validationError.bind(logger);
export const logPerformance = logger.performance.bind(logger);
export const logPerformanceWarn = logger.performanceWarn.bind(logger);
export const logGenericError = logger.error.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logInfo = logger.info.bind(logger);
export const logDebug = logger.debug.bind(logger);
export const logDev = logger.dev.bind(logger);
export const logSystem = logger.system.bind(logger);
export const logSystemError = logger.systemError.bind(logger);
