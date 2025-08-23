/**
 * Validation Composition Utilities for Unveil App
 *
 * Provides reusable validation rules and composable validation patterns
 * to eliminate duplication across different validation schemas.
 */

import { z } from 'zod';

export type ValidationRule<T> = (value: T) => ValidationResult;

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface ValidationComposer<T> {
  validate: (value: T) => ValidationResult;
  rules: ValidationRule<T>[];
}

export interface ComposableSchema<T> {
  schema: z.ZodSchema<T>;
  compose: (...additional: z.ZodSchema[]) => ComposableSchema<T>;
  extend: <U>(extension: z.ZodRawShape) => ComposableSchema<T & U>;
}

/**
 * Create a validation composer from multiple rules
 */
export const createValidator = <T>(
  rules: ValidationRule<T>[],
): ValidationComposer<T> => {
  return {
    rules,
    validate: (value: T): ValidationResult => {
      const errors: string[] = [];
      const warnings: string[] = [];

      for (const rule of rules) {
        const result = rule(value);
        if (!result.success && result.error) {
          errors.push(result.error);
        }
        if (result.warnings) {
          warnings.push(...result.warnings);
        }
      }

      return {
        success: errors.length === 0,
        error: errors.length > 0 ? errors[0] : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    },
  };
};

/**
 * Combine multiple validators into a single validator
 */
export const combineValidators = <T>(
  ...validators: ValidationComposer<T>[]
): ValidationComposer<T> => {
  const allRules = validators.flatMap((v) => v.rules);
  return createValidator(allRules);
};

/**
 * Common validation rules for reuse across schemas
 */
export const ValidationRules = {
  // String validation rules
  required:
    <T>(field: string) =>
    (value: T): ValidationResult => ({
      success: value != null && value !== '',
      error: value == null || value === '' ? `${field} is required` : undefined,
    }),

  minLength:
    (min: number, field: string) =>
    (value: string): ValidationResult => ({
      success: !value || value.length >= min,
      error:
        value && value.length < min
          ? `${field} must be at least ${min} characters`
          : undefined,
    }),

  maxLength:
    (max: number, field: string) =>
    (value: string): ValidationResult => ({
      success: !value || value.length <= max,
      error:
        value && value.length > max
          ? `${field} must be no more than ${max} characters`
          : undefined,
    }),

  pattern:
    (regex: RegExp, field: string, message?: string) =>
    (value: string): ValidationResult => ({
      success: !value || regex.test(value),
      error:
        value && !regex.test(value)
          ? message || `${field} format is invalid`
          : undefined,
    }),

  // Phone number validation
  phoneNumber:
    (field: string = 'Phone number') =>
    (value: string): ValidationResult => {
      if (!value) return { success: true };

      // Remove all non-digits for validation
      const digits = value.replace(/\D/g, '');

      // US phone number: 10 digits or 11 with leading 1
      const isValid =
        digits.length === 10 ||
        (digits.length === 11 && digits.startsWith('1'));

      return {
        success: isValid,
        error: !isValid
          ? `${field} must be a valid US phone number`
          : undefined,
      };
    },

  // Email validation (optional - phone-first approach)
  email:
    (field: string = 'Email') =>
    (value: string): ValidationResult => {
      if (!value) return { success: true }; // Email is optional

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return {
        success: emailRegex.test(value),
        error: !emailRegex.test(value)
          ? `${field} must be a valid format if provided (optional)`
          : undefined,
      };
    },

  // Number validation rules
  min:
    (min: number, field: string) =>
    (value: number): ValidationResult => ({
      success: value == null || value >= min,
      error:
        value != null && value < min
          ? `${field} must be at least ${min}`
          : undefined,
    }),

  max:
    (max: number, field: string) =>
    (value: number): ValidationResult => ({
      success: value == null || value <= max,
      error:
        value != null && value > max
          ? `${field} must be no more than ${max}`
          : undefined,
    }),

  positive:
    (field: string) =>
    (value: number): ValidationResult => ({
      success: value == null || value > 0,
      error:
        value != null && value <= 0 ? `${field} must be positive` : undefined,
    }),

  // Date validation rules
  futureDate:
    (field: string) =>
    (value: Date | string): ValidationResult => {
      if (!value) return { success: true };

      const date = typeof value === 'string' ? new Date(value) : value;
      const now = new Date();

      return {
        success: date > now,
        error: date <= now ? `${field} must be in the future` : undefined,
      };
    },

  pastDate:
    (field: string) =>
    (value: Date | string): ValidationResult => {
      if (!value) return { success: true };

      const date = typeof value === 'string' ? new Date(value) : value;
      const now = new Date();

      return {
        success: date < now,
        error: date >= now ? `${field} must be in the past` : undefined,
      };
    },

  // Array validation rules
  minItems:
    <T>(min: number, field: string) =>
    (value: T[]): ValidationResult => ({
      success: !value || value.length >= min,
      error:
        value && value.length < min
          ? `${field} must have at least ${min} items`
          : undefined,
    }),

  maxItems:
    <T>(max: number, field: string) =>
    (value: T[]): ValidationResult => ({
      success: !value || value.length <= max,
      error:
        value && value.length > max
          ? `${field} must have no more than ${max} items`
          : undefined,
    }),

  // File validation rules
  fileSize:
    (maxSizeMB: number, field: string = 'File') =>
    (file: File): ValidationResult => {
      if (!file) return { success: true };

      const maxBytes = maxSizeMB * 1024 * 1024;
      return {
        success: file.size <= maxBytes,
        error:
          file.size > maxBytes
            ? `${field} must be no larger than ${maxSizeMB}MB`
            : undefined,
      };
    },

  fileType:
    (allowedTypes: string[], field: string = 'File') =>
    (file: File): ValidationResult => {
      if (!file) return { success: true };

      return {
        success: allowedTypes.includes(file.type),
        error: !allowedTypes.includes(file.type)
          ? `${field} must be one of: ${allowedTypes.join(', ')}`
          : undefined,
      };
    },
};

/**
 * Pre-composed validation schemas for common use cases
 */
export const CommonSchemas = {
  // User profile validation
  fullName: z
    .string()
    .min(1, 'Full name is required')
    .max(100, 'Full name must be no more than 100 characters')
    .refine((name) => name.trim().length > 0, 'Full name cannot be empty'),

  phoneNumber: z.string().refine((phone) => {
    if (!phone) return true;
    const digits = phone.replace(/\D/g, '');
    return (
      digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))
    );
  }, 'Must be a valid US phone number'),

  email: z
    .string()
    .email('Must be a valid format if provided (optional)')
    .max(255, 'Email must be no more than 255 characters')
    .optional()
    .nullable()
    .transform(v => (v?.trim() ? v.trim() : undefined)),

  optionalEmail: z
    .string()
    .email('Must be a valid format if provided (optional)')
    .max(255, 'Email must be no more than 255 characters')
    .optional()
    .nullable()
    .transform(v => (v?.trim() ? v.trim() : undefined))
    .or(z.literal('')),

  // Event validation
  eventTitle: z
    .string()
    .min(1, 'Event title is required')
    .max(200, 'Event title must be no more than 200 characters'),

  eventDescription: z
    .string()
    .max(2000, 'Event description must be no more than 2000 characters')
    .optional(),

  eventDate: z
    .string()
    .or(z.date())
    .refine((date) => {
      const eventDate = typeof date === 'string' ? new Date(date) : date;
      return eventDate > new Date();
    }, 'Event date must be in the future'),

  // Message validation
  messageContent: z
    .string()
    .min(1, 'Message content is required')
    .max(2000, 'Message must be no more than 2000 characters'),

  // Media validation
  mediaCaption: z
    .string()
    .max(500, 'Caption must be no more than 500 characters')
    .optional(),

  // RSVP validation
  rsvpStatus: z.enum(['pending', 'attending', 'not_attending', 'maybe'], {
    errorMap: () => ({
      message:
        'RSVP status must be pending, attending, not_attending, or maybe',
    }),
  }),
};

/**
 * Create a composable schema that can be extended and combined
 */
export const createComposableSchema = <T>(
  schema: z.ZodSchema<T>,
): ComposableSchema<T> => {
  return {
    schema,
    compose: (...additional: z.ZodSchema[]) => {
      // For intersection of schemas
      const composed = additional.reduce((acc, curr) => acc.and(curr), schema);
      return createComposableSchema(composed);
    },
    extend: <U>(extension: z.ZodRawShape) => {
      if (schema instanceof z.ZodObject) {
        const extended = schema.extend(extension);
        return createComposableSchema(extended) as ComposableSchema<T & U>;
      }
      throw new Error('Can only extend object schemas');
    },
  };
};

/**
 * Schema composition patterns for common entities
 */
export const EntitySchemas = {
  // Base user schema
  baseUser: createComposableSchema(
    z.object({
      full_name: CommonSchemas.fullName,
      phone: CommonSchemas.phoneNumber,
      email: CommonSchemas.optionalEmail,
    }),
  ),

  // Event creation schema
  baseEvent: createComposableSchema(
    z.object({
      title: CommonSchemas.eventTitle,
      description: CommonSchemas.eventDescription,
      event_date: CommonSchemas.eventDate,
    }),
  ),

  // Message schema
  baseMessage: createComposableSchema(
    z.object({
      content: CommonSchemas.messageContent,
      message_type: z.enum(['direct', 'announcement']),
    }),
  ),

  // Media upload schema
  baseMedia: createComposableSchema(
    z.object({
      caption: CommonSchemas.mediaCaption,
      media_type: z.enum(['image', 'video']),
    }),
  ),

  // Guest schema
  baseGuest: createComposableSchema(
    z.object({
      full_name: CommonSchemas.fullName,
      phone: CommonSchemas.phoneNumber.optional(),
      email: CommonSchemas.optionalEmail,
      rsvp_status: CommonSchemas.rsvpStatus,
    }),
  ),
};

/**
 * Validation utilities for forms
 */
export const FormValidation = {
  /**
   * Validate a form field and return formatted error
   */
  validateField: <T>(value: T, validator: ValidationComposer<T>) => {
    const result = validator.validate(value);
    return {
      isValid: result.success,
      error: result.error,
      warnings: result.warnings,
    };
  },

  /**
   * Validate multiple fields at once
   */
  validateFields: <T extends Record<string, unknown>>(
    values: T,
    validators: { [K in keyof T]?: ValidationComposer<T[K]> },
  ) => {
    const errors: Partial<Record<keyof T, string>> = {};
    const warnings: Partial<Record<keyof T, string[]>> = {};
    let isValid = true;

    for (const [field, validator] of Object.entries(validators)) {
      if (validator && field in values) {
        const result = validator.validate(values[field as keyof T]);
        if (!result.success) {
          errors[field as keyof T] = result.error;
          isValid = false;
        }
        if (result.warnings && result.warnings.length > 0) {
          warnings[field as keyof T] = result.warnings;
        }
      }
    }

    return {
      isValid,
      errors,
      warnings,
    };
  },

  /**
   * Create a validator for a specific schema
   */
  createSchemaValidator: <T>(schema: z.ZodSchema<T>) => {
    return createValidator<T>([
      (value: T): ValidationResult => {
        const result = schema.safeParse(value);
        return {
          success: result.success,
          error: result.success ? undefined : result.error.errors[0]?.message,
        };
      },
    ]);
  },
};
