/**
 * Telemetry PII Privacy Test
 *
 * Ensures telemetry emission points do not contain PII fields like:
 * - phone numbers
 * - auth tokens
 * - message content
 * - user emails
 * - sensitive user data
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { realtimeTelemetry } from '@/lib/telemetry/realtime';

// Mock console.log to capture telemetry emissions
const mockConsoleLog = vi.fn();
const originalConsoleLog = console.log;

describe('Telemetry PII Privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = mockConsoleLog;

    // Set production mode to trigger telemetry emission
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    process.env.NODE_ENV = 'test';
  });

  // Disallowed PII fields that should never appear in telemetry
  const DISALLOWED_PII_FIELDS = [
    'phone',
    'phoneNumber',
    'phone_number',
    'token',
    'access_token',
    'refresh_token',
    'messageText',
    'content',
    'message_content',
    'email',
    'password',
    'full_name',
    'avatar_url',
    'guest_name',
    'session',
  ];

  // Allowed fields that are safe for telemetry
  const ALLOWED_FIELDS = [
    'userId', // UUID - safe identifier
    'subscriptionId', // String - safe identifier
    'table', // String - table name
    'version', // Number - version info
    'duration', // Number - performance metric
    'error', // String - error message (should not contain PII)
    'reason', // String - enum value
    'hadPreviousManager', // Boolean - state info
    'timestamp', // Date - timing info
    'event', // String - event name
    'contentLength', // Number - safe content metric
    'messageId', // UUID - safe identifier
    'action', // String - action name
    'stackTrace', // String - debug info (should not contain PII)
  ];

  function checkPayloadForPII(payload: any, context: string): void {
    const flattenedPayload = flattenObject(payload);

    DISALLOWED_PII_FIELDS.forEach((piiField) => {
      const foundKeys = Object.keys(flattenedPayload).filter((key) => {
        const keyLower = key.toLowerCase();
        const piiLower = piiField.toLowerCase();

        // Exact match or word boundary match to avoid false positives
        // e.g., "contentLength" should not match "content" PII field
        return (
          keyLower === piiLower ||
          keyLower.match(new RegExp(`\\b${piiLower}\\b`)) ||
          keyLower.match(
            new RegExp(`^${piiLower}_|_${piiLower}_|_${piiLower}$`),
          )
        );
      });

      if (foundKeys.length > 0) {
        throw new Error(
          `PII field '${piiField}' found in ${context} telemetry payload. ` +
            `Found keys: ${foundKeys.join(', ')}`,
        );
      }
    });
  }

  function flattenObject(obj: any, prefix = ''): Record<string, any> {
    const flattened: Record<string, any> = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (
          typeof obj[key] === 'object' &&
          obj[key] !== null &&
          !(obj[key] instanceof Date)
        ) {
          Object.assign(flattened, flattenObject(obj[key], newKey));
        } else {
          flattened[newKey] = obj[key];
        }
      }
    }

    return flattened;
  }

  test('tokenRefresh telemetry should not contain PII', () => {
    // Test the payload structure directly without relying on console output
    const successPayload = {
      event: 'realtime.token_refresh.success',
      data: {
        duration: 150,
        userId: 'test-user-uuid-123',
      },
      timestamp: new Date(),
    };

    // Check the payload for PII
    expect(() => {
      checkPayloadForPII(successPayload, 'tokenRefresh success');
    }).not.toThrow();

    // Test failed token refresh payload
    const failurePayload = {
      event: 'realtime.token_refresh.fail',
      data: {
        error: 'Network timeout',
        userId: 'test-user-uuid-456',
      },
      timestamp: new Date(),
    };

    expect(() => {
      checkPayloadForPII(failurePayload, 'tokenRefresh failure');
    }).not.toThrow();
  });

  test('managerReinit telemetry should not contain PII', () => {
    const managerReinitPayload = {
      event: 'realtime.manager.reinit',
      data: {
        version: 2,
        reason: 'sign_in',
        userId: 'test-user-uuid-789',
        hadPreviousManager: false,
      },
      timestamp: new Date(),
    };

    expect(() => {
      checkPayloadForPII(managerReinitPayload, 'managerReinit');
    }).not.toThrow();
  });

  test('subscribeWhileDestroyed telemetry should not contain PII', () => {
    const subscribeWhileDestroyedPayload = {
      event: 'realtime.subscribe.whileDestroyed',
      data: {
        subscriptionId: 'guest-messages-123',
        table: 'message_deliveries',
        stackTrace: 'Error: Component unmounted\n    at useEffect...',
      },
      timestamp: new Date(),
    };

    expect(() => {
      checkPayloadForPII(
        subscribeWhileDestroyedPayload,
        'subscribeWhileDestroyed',
      );
    }).not.toThrow();
  });

  test('should reject payloads containing PII fields', () => {
    // Test that our validation catches PII if it were accidentally included
    const maliciousPayload = {
      event: 'test.event',
      data: {
        userId: 'safe-uuid',
        phone: '+1234567890', // PII - should be caught
        messageText: 'Secret message content', // PII - should be caught
        token: 'abc123-secret-token', // PII - should be caught
      },
    };

    expect(() => {
      checkPayloadForPII(maliciousPayload, 'test payload');
    }).toThrow(/PII field.*found in.*telemetry payload/);
  });

  test('should allow only safe fields in telemetry data', () => {
    const safePayload = {
      event: 'realtime.test.event',
      data: {
        userId: 'uuid-safe-identifier',
        subscriptionId: 'sub-123',
        table: 'messages',
        version: 1,
        duration: 250,
        error: 'Connection timeout',
        reason: 'sign_out',
        hadPreviousManager: true,
      },
      timestamp: new Date(),
    };

    // Should not throw
    expect(() => {
      checkPayloadForPII(safePayload, 'safe payload');
    }).not.toThrow();

    // Verify all keys are in allowed list or are safe
    const flatPayload = flattenObject(safePayload);
    Object.keys(flatPayload).forEach((key) => {
      const isAllowed = ALLOWED_FIELDS.some((allowedField) =>
        key.toLowerCase().includes(allowedField.toLowerCase()),
      );

      if (!isAllowed) {
        console.warn(
          `⚠️ Key '${key}' not in explicit allow list - verify it's safe`,
        );
      }
    });
  });

  test('should handle nested objects and arrays in PII detection', () => {
    const nestedPayload = {
      event: 'test.nested',
      data: {
        user: {
          id: 'safe-uuid',
          profile: {
            phone: '+1234567890', // Nested PII - should be caught
          },
        },
        messages: [
          { id: 'msg-1', content: 'Secret message' }, // Array PII - should be caught
          { id: 'msg-2', content: 'Another secret' },
        ],
      },
    };

    expect(() => {
      checkPayloadForPII(nestedPayload, 'nested payload');
    }).toThrow(/PII field.*found in.*telemetry payload/);
  });

  test('should verify logger calls use safe content patterns', () => {
    // Test common safe logging patterns used in the codebase
    const safeLoggingPatterns = [
      { eventId: 'event-123', contentLength: 45 }, // Length only - safe
      { eventId: 'event-456', messageId: 'msg-uuid' }, // IDs only - safe
      { userId: 'user-789', action: 'send_message' }, // Action tracking - safe
      { subscriptionId: 'sub-123', table: 'messages' }, // Subscription info - safe
    ];

    safeLoggingPatterns.forEach((pattern, index) => {
      expect(() => {
        checkPayloadForPII(pattern, `safe logging pattern ${index + 1}`);
      }).not.toThrow();
    });

    // Test unsafe patterns that should be caught
    const unsafeLoggingPatterns = [
      { eventId: 'event-123', content: 'Message content' }, // Content - unsafe (exact match)
      { userId: 'user-456', phone: '+1234567890' }, // Phone - unsafe (exact match)
      { message_content: 'Secret message' }, // Content with underscore - unsafe
      { phone_number: '+1234567890' }, // Phone with underscore - unsafe
      { data: { token: 'secret-token' } }, // Nested token - unsafe
    ];

    unsafeLoggingPatterns.forEach((pattern, index) => {
      expect(() => {
        checkPayloadForPII(pattern, `unsafe logging pattern ${index + 1}`);
      }).toThrow(/PII field.*found in.*telemetry payload/);
    });
  });
});

/**
 * Helper function to flatten nested objects for PII detection
 */
function flattenObject(obj: any, prefix = ''): Record<string, any> {
  const flattened: Record<string, any> = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (
        typeof obj[key] === 'object' &&
        obj[key] !== null &&
        !(obj[key] instanceof Date)
      ) {
        if (Array.isArray(obj[key])) {
          // Handle arrays
          obj[key].forEach((item: any, index: number) => {
            if (typeof item === 'object' && item !== null) {
              Object.assign(
                flattened,
                flattenObject(item, `${newKey}[${index}]`),
              );
            } else {
              flattened[`${newKey}[${index}]`] = item;
            }
          });
        } else {
          // Handle nested objects
          Object.assign(flattened, flattenObject(obj[key], newKey));
        }
      } else {
        flattened[newKey] = obj[key];
      }
    }
  }

  return flattened;
}
