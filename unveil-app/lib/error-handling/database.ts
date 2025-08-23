/**
 * Unified Database Error Handler for Unveil App
 *
 * Centralizes database error handling logic to eliminate code duplication
 * across service files and provide consistent error messaging.
 */

import type { DatabaseError } from '@/lib/types/errors';
import { createDatabaseError } from '@/lib/types/errors';
import { logDatabaseError, logAuthError, logMediaError } from '@/lib/logger';

export type DatabaseContext =
  | 'auth'
  | 'events'
  | 'guests'
  | 'media'
  | 'messaging'
  | 'storage'
  | 'users'
  | 'generic';

export interface DatabaseErrorMapping {
  code: string;
  message: string;
  dbCode: DatabaseError['dbCode'];
}

export interface DatabaseErrorOptions {
  table?: string;
  operation?: DatabaseError['operation'];
  fieldContext?: string;
  customMappings?: DatabaseErrorMapping[];
}

/**
 * Unified Database Error Handler
 */
export class DatabaseErrorHandler {
  private static readonly CONSTRAINT_MAPPINGS: Record<
    string,
    DatabaseErrorMapping
  > = {
    // Unique constraint violations (23505)
    '23505': {
      code: '23505',
      message: 'This record already exists',
      dbCode: 'UNIQUE_VIOLATION',
    },

    // Foreign key constraint violations (23503)
    '23503': {
      code: '23503',
      message: 'Invalid reference - related record does not exist',
      dbCode: 'FOREIGN_KEY_VIOLATION',
    },

    // Check constraint violations (23514)
    '23514': {
      code: '23514',
      message: 'Data validation failed - please check your input',
      dbCode: 'CHECK_VIOLATION',
    },

    // Not null constraint violations (23502)
    '23502': {
      code: '23502',
      message: 'Required field is missing',
      dbCode: 'NOT_NULL_VIOLATION',
    },
  };

  private static readonly CONTEXT_SPECIFIC_MAPPINGS: Record<
    DatabaseContext,
    Record<string, Record<string, string>>
  > = {
    auth: {
      '23505': {
        phone: 'A user with this phone number already exists',
        default: 'User already exists',
      },
      '23503': {
        default: 'Invalid user reference',
      },
    },
    events: {
      '23505': {
        default: 'A record with this information already exists',
      },
      '23503': {
        host_user_id: 'Invalid host user ID',
        event_id: 'Invalid event ID',
        user_id: 'Invalid user ID',
        default: 'Invalid reference in database',
      },
      '23514': {
        default: 'Data validation failed - please check your input',
      },
    },
    guests: {
      '23505': {
        phone: 'A user with this phone number already exists',
        event_guests_event_id_user_id_key:
          'This user is already a guest in this event',
        default: 'Guest record already exists',
      },
      '23503': {
        default: 'Invalid event or user reference',
      },
    },
    media: {
      '23505': {
        default: 'A media file with this path already exists',
      },
      '23503': {
        event_id: 'Invalid event ID',
        uploader_user_id: 'Invalid user ID',
        default: 'Invalid reference in database',
      },
      '23514': {
        default: 'Invalid media type - must be image or video',
      },
    },
    messaging: {
      '23505': {
        default: 'Duplicate message detected',
      },
      '23503': {
        event_id: 'Invalid event ID',
        sender_user_id: 'Invalid sender user ID',
        default: 'Invalid reference in database',
      },
      '23514': {
        default: 'Invalid message type - must be direct or announcement',
      },
    },
    storage: {
      '23505': {
        default: 'Storage item already exists',
      },
      '23503': {
        default: 'Invalid storage reference',
      },
    },
    users: {
      '23505': {
        phone: 'A user with this phone number already exists',
        default: 'User already exists',
      },
      '23503': {
        default: 'Invalid user reference',
      },
    },
    generic: {
      '23505': {
        default: 'This record already exists',
      },
      '23503': {
        default: 'Invalid reference in database',
      },
      '23514': {
        default: 'Data validation failed',
      },
    },
  };

  private static readonly SUPABASE_ERROR_MAPPINGS: Record<
    string,
    DatabaseErrorMapping
  > = {
    PGRST116: {
      code: 'PGRST116',
      message: 'Record not found',
      dbCode: 'QUERY_FAILED',
    },
    PGRST301: {
      code: 'PGRST301',
      message: 'Invalid request format',
      dbCode: 'QUERY_FAILED',
    },
    '42501': {
      code: '42501',
      message: 'Insufficient permissions',
      dbCode: 'RLS_VIOLATION',
    },
  };

  /**
   * Main database error handling method
   */
  static handle(
    error: unknown,
    context: DatabaseContext,
    options: DatabaseErrorOptions = {},
  ): never {
    // Log the error using context-appropriate logger
    this.logError(error, context, options);

    const dbError = this.parseError(error);
    const errorMapping = this.getErrorMapping(dbError, context, options);

    const appError = createDatabaseError(
      errorMapping.dbCode,
      errorMapping.message,
      error,
      {
        context,
        table: options.table,
        operation: options.operation,
        originalCode: dbError.code,
      },
      options.table,
      options.operation,
    );

    throw appError;
  }

  /**
   * Check if an error is a constraint violation
   */
  static isConstraintViolation(error: unknown): boolean {
    const dbError = this.parseError(error);
    return ['23505', '23503', '23514', '23502'].includes(dbError.code || '');
  }

  /**
   * Check if an error is retryable (connection issues, timeouts, etc.)
   */
  static isRetryable(error: unknown): boolean {
    const dbError = this.parseError(error);

    // Connection and timeout errors are retryable
    if (dbError.message) {
      const retryablePatterns = [
        /connection/i,
        /timeout/i,
        /network/i,
        /temporarily.?unavailable/i,
        /service.?unavailable/i,
      ];

      return retryablePatterns.some((pattern) =>
        pattern.test(dbError.message!),
      );
    }

    return false;
  }

  /**
   * Map PostgreSQL error codes to user-friendly messages
   */
  static mapErrorCode(code: string, context?: DatabaseContext): string {
    if (context && this.CONTEXT_SPECIFIC_MAPPINGS[context]?.[code]) {
      return this.CONTEXT_SPECIFIC_MAPPINGS[context][code].default;
    }

    return (
      this.CONSTRAINT_MAPPINGS[code]?.message ||
      this.SUPABASE_ERROR_MAPPINGS[code]?.message ||
      'Database operation failed'
    );
  }

  /**
   * Parse error object to extract relevant information
   */
  private static parseError(error: unknown): {
    code?: string;
    message?: string;
    details?: unknown;
  } {
    if (!error) {
      return { message: 'Unknown database error' };
    }

    // Handle Error objects
    if (error instanceof Error) {
      return {
        code: (error as Error & { code?: string }).code,
        message: error.message,
        details: error,
      };
    }

    // Handle Supabase/PostgreSQL error objects
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as Record<string, unknown>;
      return {
        code: (errorObj.code || errorObj.error_code || errorObj.status) as
          | string
          | undefined,
        message: (errorObj.message || errorObj.error || errorObj.statusText) as
          | string
          | undefined,
        details: error,
      };
    }

    // Handle string errors
    if (typeof error === 'string') {
      return { message: error };
    }

    return { message: 'Unknown database error', details: error };
  }

  /**
   * Get appropriate error mapping based on context and error details
   */
  private static getErrorMapping(
    dbError: { code?: string; message?: string; details?: unknown },
    context: DatabaseContext,
    options: DatabaseErrorOptions,
  ): DatabaseErrorMapping {
    const code = dbError.code || '';

    // Check for custom mappings first
    if (options.customMappings) {
      const customMapping = options.customMappings.find((m) => m.code === code);
      if (customMapping) {
        return customMapping;
      }
    }

    // Check for context-specific mappings
    const contextMappings = this.CONTEXT_SPECIFIC_MAPPINGS[context];
    if (contextMappings && contextMappings[code]) {
      const mapping = contextMappings[code];

      // Check for field-specific message
      if (options.fieldContext && mapping[options.fieldContext]) {
        return {
          code,
          message: mapping[options.fieldContext],
          dbCode: this.CONSTRAINT_MAPPINGS[code]?.dbCode || 'QUERY_FAILED',
        };
      }

      // Check if error message contains field references
      if (dbError.message) {
        for (const [field, message] of Object.entries(mapping)) {
          if (field !== 'default' && dbError.message.includes(field)) {
            return {
              code,
              message,
              dbCode: this.CONSTRAINT_MAPPINGS[code]?.dbCode || 'QUERY_FAILED',
            };
          }
        }
      }

      // Use default mapping for this context and code
      return {
        code,
        message: mapping.default,
        dbCode: this.CONSTRAINT_MAPPINGS[code]?.dbCode || 'QUERY_FAILED',
      };
    }

    // Fallback to generic mappings
    return (
      this.CONSTRAINT_MAPPINGS[code] ||
      this.SUPABASE_ERROR_MAPPINGS[code] || {
        code: code || 'UNKNOWN',
        message: dbError.message || 'Database operation failed',
        dbCode: 'QUERY_FAILED',
      }
    );
  }

  /**
   * Log error using appropriate logger for context
   */
  private static logError(
    error: unknown,
    context: DatabaseContext,
    options: DatabaseErrorOptions,
  ): void {
    const logContext = `${context}${options.table ? `:${options.table}` : ''}${options.operation ? `:${options.operation}` : ''}`;
    const message = `Database error in ${logContext}`;

    switch (context) {
      case 'auth':
        logAuthError(message, error, logContext);
        break;
      case 'media':
      case 'storage':
        logMediaError(message, error, logContext);
        break;
      default:
        logDatabaseError(message, error, logContext);
        break;
    }
  }
}

/**
 * Convenience functions for common use cases
 */
export const handleAuthDatabaseError = (
  error: unknown,
  operation?: string,
  table?: string,
) => {
  DatabaseErrorHandler.handle(error, 'auth', {
    operation: operation as DatabaseError['operation'],
    table,
  });
};

export const handleEventsDatabaseError = (
  error: unknown,
  operation?: string,
  table?: string,
) => {
  DatabaseErrorHandler.handle(error, 'events', {
    operation: operation as DatabaseError['operation'],
    table,
  });
};

export const handleGuestsDatabaseError = (
  error: unknown,
  operation?: string,
  table?: string,
) => {
  DatabaseErrorHandler.handle(error, 'guests', {
    operation: operation as DatabaseError['operation'],
    table,
  });
};

export const handleMediaDatabaseError = (
  error: unknown,
  operation?: string,
  table?: string,
) => {
  DatabaseErrorHandler.handle(error, 'media', {
    operation: operation as DatabaseError['operation'],
    table,
  });
};

export const handleMessagingDatabaseError = (
  error: unknown,
  operation?: string,
  table?: string,
) => {
  DatabaseErrorHandler.handle(error, 'messaging', {
    operation: operation as DatabaseError['operation'],
    table,
  });
};

export const handleStorageDatabaseError = (
  error: unknown,
  operation?: string,
  table?: string,
) => {
  DatabaseErrorHandler.handle(error, 'storage', {
    operation: operation as DatabaseError['operation'],
    table,
  });
};

export const handleGenericDatabaseError = (
  error: unknown,
  operation?: string,
  table?: string,
) => {
  DatabaseErrorHandler.handle(error, 'generic', {
    operation: operation as DatabaseError['operation'],
    table,
  });
};
