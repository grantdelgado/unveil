/**
 * Unified Retry Utility for Unveil App
 * 
 * Centralizes retry logic for SMS, push notifications, and HTTP requests
 * to eliminate code duplication and standardize retry behavior.
 */

import { logger } from '@/lib/logger';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBackoff: boolean;
  context?: string;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  totalDurationMs: number;
}

export type RetryContext = 'sms' | 'push' | 'http' | 'database';

/**
 * Retry Manager - Unified retry logic for all services
 */
export class RetryManager {
  private static readonly DEFAULT_OPTIONS: RetryOptions = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    exponentialBackoff: true,
  };

  private static readonly RETRYABLE_PATTERNS = {
    sms: [
      /rate.?limit/i,
      /timeout/i,
      /network/i,
      /service.?unavailable/i,
      /internal.?server.?error/i,
      /502|503|504/,
      /temporarily.?unavailable/i,
      /queue.?full/i,
    ],
    push: [
      /rate.?limit/i,
      /timeout/i,
      /network/i,
      /service.?unavailable/i,
      /internal.?server.?error/i,
      /502|503|504/,
      /temporarily.?unavailable/i,
    ],
    http: [
      /timeout/i,
      /network/i,
      /ENOTFOUND/i,
      /ECONNRESET/i,
      /ECONNREFUSED/i,
      /502|503|504/,
      /service.?unavailable/i,
    ],
    database: [
      /connection/i,
      /timeout/i,
      /network/i,
      /temporarily.?unavailable/i,
    ],
  };

  private static readonly RETRYABLE_FAILURE_REASONS = [
    'network_error',
    'service_unavailable', 
    'rate_limited',
  ];

  /**
   * Check if an error is retryable based on context
   */
  static isRetryableError(
    error: string | undefined, 
    context: RetryContext, 
    failureReason?: string
  ): boolean {
    if (!error && !failureReason) return false;

    // Check failure reason first (for push notifications)
    if (failureReason && this.RETRYABLE_FAILURE_REASONS.includes(failureReason)) {
      return true;
    }

    // Check error message patterns
    if (error) {
      const patterns = this.RETRYABLE_PATTERNS[context] || [];
      return patterns.some(pattern => pattern.test(error));
    }

    return false;
  }

  /**
   * Execute an operation with retry logic
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<RetryResult<T>> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();
    let lastError: string | undefined;
    
    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        const data = await operation();
        
        const duration = Date.now() - startTime;
        if (attempt > 1) {
          logger.debug(`✅ Retry successful after ${attempt} attempts (${duration}ms)`, {
            context: opts.context,
            attempts: attempt,
            duration,
          });
        }
        
        return {
          success: true,
          data,
          attempts: attempt,
          totalDurationMs: duration,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        // If this was the last attempt, don't delay
        if (attempt === opts.maxAttempts) {
          break;
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, opts);
        
        logger.debug(`⚠️ Retry attempt ${attempt}/${opts.maxAttempts} failed, retrying in ${delay}ms`, {
          context: opts.context,
          error: lastError,
          delay,
        });
        
        await this.sleep(delay);
      }
    }
    
    const duration = Date.now() - startTime;
    logger.warn(`❌ All retry attempts failed after ${opts.maxAttempts} attempts (${duration}ms)`, {
      context: opts.context,
      error: lastError,
      attempts: opts.maxAttempts,
      duration,
    });
    
    return {
      success: false,
      error: lastError,
      attempts: opts.maxAttempts,
      totalDurationMs: duration,
    };
  }

  /**
   * Execute an operation with context-specific retry logic
   */
  static async executeWithContextRetry<T>(
    operation: () => Promise<{ success: boolean; data?: T; error?: string; failureReason?: string }>,
    context: RetryContext,
    options: Partial<RetryOptions> = {}
  ): Promise<RetryResult<T>> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options, context };
    const startTime = Date.now();
    let lastError: string | undefined;
    let lastFailureReason: string | undefined;
    
    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        if (result.success) {
          const duration = Date.now() - startTime;
          if (attempt > 1) {
            logger.debug(`✅ Context retry successful after ${attempt} attempts (${duration}ms)`, {
              context,
              attempts: attempt,
              duration,
            });
          }
          
          return {
            success: true,
            data: result.data,
            attempts: attempt,
            totalDurationMs: duration,
          };
        }
        
        // Operation returned failure - check if retryable
        lastError = result.error;
        lastFailureReason = result.failureReason;
        
        const isRetryable = this.isRetryableError(result.error, context, result.failureReason);
        
        if (!isRetryable || attempt === opts.maxAttempts) {
          break;
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, opts);
        
        logger.debug(`⚠️ Context retry attempt ${attempt}/${opts.maxAttempts} failed, retrying in ${delay}ms`, {
          context,
          error: result.error,
          failureReason: result.failureReason,
          delay,
        });
        
        await this.sleep(delay);
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        // If this was the last attempt, don't delay
        if (attempt === opts.maxAttempts) {
          break;
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, opts);
        
        logger.debug(`⚠️ Context retry attempt ${attempt}/${opts.maxAttempts} threw error, retrying in ${delay}ms`, {
          context,
          error: lastError,
          delay,
        });
        
        await this.sleep(delay);
      }
    }
    
    const duration = Date.now() - startTime;
    logger.warn(`❌ All context retry attempts failed after ${opts.maxAttempts} attempts (${duration}ms)`, {
      context,
      error: lastError,
      failureReason: lastFailureReason,
      attempts: opts.maxAttempts,
      duration,
    });
    
    return {
      success: false,
      error: lastError,
      attempts: opts.maxAttempts,
      totalDurationMs: duration,
    };
  }

  /**
   * Calculate delay for next retry attempt
   */
  private static calculateDelay(attempt: number, options: RetryOptions): number {
    if (!options.exponentialBackoff) {
      return options.baseDelayMs;
    }
    
    // Exponential backoff with jitter
    const exponentialDelay = options.baseDelayMs * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    const delay = exponentialDelay + jitter;
    
    return Math.min(delay, options.maxDelayMs);
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Context-specific retry utilities for common use cases
 */
export const SMSRetry = {
  /**
   * Check if SMS error is retryable
   */
  isRetryable: (error?: string): boolean => 
    RetryManager.isRetryableError(error, 'sms'),

  /**
   * Execute SMS operation with retry
   */
  execute: <T>(
    operation: () => Promise<{ success: boolean; data?: T; error?: string }>,
    options?: Partial<RetryOptions>
  ): Promise<RetryResult<T>> => 
    RetryManager.executeWithContextRetry(operation, 'sms', options),
};

export const PushRetry = {
  /**
   * Check if push notification error is retryable
   */
  isRetryable: (error?: string, failureReason?: string): boolean => 
    RetryManager.isRetryableError(error, 'push', failureReason),

  /**
   * Execute push operation with retry
   */
  execute: <T>(
    operation: () => Promise<{ success: boolean; data?: T; error?: string; failureReason?: string }>,
    options?: Partial<RetryOptions>
  ): Promise<RetryResult<T>> => 
    RetryManager.executeWithContextRetry(operation, 'push', options),
};

export const HTTPRetry = {
  /**
   * Check if HTTP error is retryable
   */
  isRetryable: (error?: string): boolean => 
    RetryManager.isRetryableError(error, 'http'),

  /**
   * Execute HTTP operation with retry
   */
  execute: <T>(
    operation: () => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<RetryResult<T>> => 
    RetryManager.executeWithRetry(operation, { ...options, context: 'http' }),
};

export const DatabaseRetry = {
  /**
   * Check if database error is retryable
   */
  isRetryable: (error?: string): boolean => 
    RetryManager.isRetryableError(error, 'database'),

  /**
   * Execute database operation with retry
   */
  execute: <T>(
    operation: () => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<RetryResult<T>> => 
    RetryManager.executeWithRetry(operation, { ...options, context: 'database' }),
}; 