/**
 * Form-specific Validation Types for Unveil
 *
 * Provides strongly-typed form validation schemas and interfaces
 * for consistent form handling across the application.
 */

import type { z } from 'zod';
import type { FormValidationError } from './errors';

// Base form field types
export interface BaseFormField<
  T = string | number | boolean | Date | File | null,
> {
  value: T;
  error?: string;
  touched: boolean;
  dirty: boolean;
  validated: boolean;
}

export interface StringFormField extends BaseFormField<string> {
  value: string;
}

export interface NumberFormField extends BaseFormField<number | null> {
  value: number | null;
}

export interface BooleanFormField extends BaseFormField<boolean> {
  value: boolean;
}

export interface DateFormField extends BaseFormField<Date | null> {
  value: Date | null;
}

export interface FileFormField extends BaseFormField<File | null> {
  value: File | null;
  preview?: string;
}

export interface ArrayFormField<T = string> extends BaseFormField<T[]> {
  value: T[];
}

// Form validation rules
export interface ValidationRule<
  T = string | number | boolean | Date | File | null,
> {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: T) => boolean | string;
  message?: string;
}

// Specific form schemas
export interface LoginFormData {
  phone: StringFormField;
}

export interface EventFormData {
  title: StringFormField;
  description: StringFormField;
  event_date: DateFormField;
  location: StringFormField;
  max_guests?: NumberFormField;
  is_public: BooleanFormField;
}

export interface GuestFormData {
  phone: StringFormField;
  guest_name?: StringFormField;
  // guest_email removed - no longer used in current implementation
  role: StringFormField;
  rsvp_status?: StringFormField;
  guest_tags?: ArrayFormField<string>;
}

// Legacy alias

export interface MessageFormData {
  content: StringFormField;
  message_type: StringFormField;
  event_id: StringFormField;
}

export interface MediaUploadFormData {
  files: ArrayFormField<File>;
  caption?: StringFormField;
  event_id: StringFormField;
}

export interface ProfileFormData {
  full_name?: StringFormField;
  email?: StringFormField | null; // Optional and nullable - phone-first approach
  phone: StringFormField;
  avatar?: FileFormField;
}

export interface ImportGuestsFormData {
  file: FileFormField;
  mapping: ArrayFormField<{
    csvColumn: string;
    targetField: string;
  }>;
  skipFirstRow: BooleanFormField;
}

export interface SMSAnnouncementFormData {
  message: StringFormField;
  event_id: StringFormField;
  send_to_role?: StringFormField;
  scheduled_for?: DateFormField;
}

// Form validation schemas using Zod
export type LoginFormSchema = z.ZodObject<{
  phone: z.ZodString;
}>;

export type EventFormSchema = z.ZodObject<{
  title: z.ZodString;
  description: z.ZodString;
  event_date: z.ZodDate;
  location: z.ZodString;
  max_guests: z.ZodOptional<z.ZodNumber>;
  is_public: z.ZodBoolean;
}>;

export type GuestFormSchema = z.ZodObject<{
  phone: z.ZodString;
  guest_name: z.ZodOptional<z.ZodString>;
  // guest_email removed - no longer used in current implementation
  role: z.ZodEnum<['host', 'guest']>;
  rsvp_status: z.ZodOptional<
    z.ZodEnum<['attending', 'declined', 'maybe', 'pending']>
  >;
  guest_tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
}>;

// Legacy alias

export type MessageFormSchema = z.ZodObject<{
  content: z.ZodString;
  message_type: z.ZodEnum<['direct', 'announcement', 'channel']>;
  event_id: z.ZodString;
}>;

export type MediaUploadFormSchema = z.ZodObject<{
  files: z.ZodArray<z.ZodType<File>>;
  caption: z.ZodOptional<z.ZodString>;
  event_id: z.ZodString;
}>;

export type ProfileFormSchema = z.ZodObject<{
  full_name: z.ZodOptional<z.ZodString>;
  email: z.ZodOptional<z.ZodString>;
  phone: z.ZodString;
  avatar: z.ZodOptional<z.ZodType<File>>;
}>;

// Form state management
export interface FormState<TFormData = Record<string, BaseFormField>> {
  data: TFormData;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  dirty: Record<string, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  isValidating: boolean;
  submitCount: number;
  validationErrors: FormValidationError[];
}

// Form actions
export type FormAction<TFormData = Record<string, BaseFormField>> =
  | { type: 'SET_FIELD_VALUE'; field: keyof TFormData; value: unknown }
  | { type: 'SET_FIELD_ERROR'; field: keyof TFormData; error: string }
  | { type: 'CLEAR_FIELD_ERROR'; field: keyof TFormData }
  | { type: 'SET_FIELD_TOUCHED'; field: keyof TFormData; touched: boolean }
  | { type: 'SET_ERRORS'; errors: Record<string, string> }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'SET_SUBMITTING'; isSubmitting: boolean }
  | { type: 'SET_VALIDATING'; isValidating: boolean }
  | { type: 'RESET_FORM'; data?: Partial<TFormData> }
  | { type: 'INCREMENT_SUBMIT_COUNT' };

// Form validation result
export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  validationErrors: FormValidationError[];
}

// Form submission result
export interface FormSubmissionResult<TData = unknown> {
  success: boolean;
  data?: TData;
  errors?: Record<string, string>;
  validationErrors?: FormValidationError[];
  serverError?: string;
}

// Form field configuration
export interface FormFieldConfig<T = unknown> {
  name: string;
  label: string;
  type:
    | 'text'
    | 'email'
    | 'tel'
    | 'password'
    | 'number'
    | 'date'
    | 'file'
    | 'select'
    | 'textarea'
    | 'checkbox';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  validation?: ValidationRule<T>;
  options?: Array<{ value: string; label: string }>; // For select fields
  accept?: string; // For file fields
  multiple?: boolean; // For file and select fields
  rows?: number; // For textarea fields
  min?: number | string; // For number and date fields
  max?: number | string; // For number and date fields
  step?: number | string; // For number fields
  autoComplete?: string;
  autoFocus?: boolean;
  helpText?: string;
  errorText?: string;
}

// Form configuration
export interface FormConfig<TFormData = Record<string, BaseFormField>> {
  fields: Record<keyof TFormData, FormFieldConfig>;
  validation?: {
    mode: 'onChange' | 'onBlur' | 'onSubmit';
    revalidateMode: 'onChange' | 'onBlur' | 'onSubmit';
    schema?: z.ZodSchema;
  };
  submission?: {
    preventDefaultOnSubmit: boolean;
    resetOnSuccess: boolean;
    showSuccessMessage: boolean;
    successMessage?: string;
  };
}

// Form context type for providers
export interface FormContextValue<TFormData = Record<string, BaseFormField>> {
  state: FormState<TFormData>;
  config: FormConfig<TFormData>;
  setValue: (field: keyof TFormData, value: unknown) => void;
  setError: (field: keyof TFormData, error: string) => void;
  clearError: (field: keyof TFormData) => void;
  clearAllErrors: () => void;
  setTouched: (field: keyof TFormData, touched: boolean) => void;
  validate: () => Promise<FormValidationResult>;
  validateField: (field: keyof TFormData) => Promise<boolean>;
  submit: () => Promise<FormSubmissionResult>;
  reset: (data?: Partial<TFormData>) => void;
  getFieldProps: (field: keyof TFormData) => FormFieldProps;
}

// Form field props for components
export interface FormFieldProps {
  name: string;
  value: unknown;
  error?: string;
  touched: boolean;
  dirty: boolean;
  disabled: boolean;
  required: boolean;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  onFocus: () => void;
}

// Form validation utilities
export interface FormValidator<TFormData = Record<string, BaseFormField>> {
  validate: (data: TFormData) => FormValidationResult;
  validateField: (
    field: keyof TFormData,
    value: unknown,
    data: TFormData,
  ) => string | null;
  schema?: z.ZodSchema;
}

// Custom validation functions
export type CustomValidator<T = unknown> = (
  value: T,
) => boolean | string | Promise<boolean | string>;

// Form field type helpers
export type FormFieldValue<T extends BaseFormField> = T['value'];
export type FormDataValues<T extends Record<string, BaseFormField>> = {
  [K in keyof T]: FormFieldValue<T[K]>;
};

// Form field factory functions
export const createStringField = (
  value = '',
  required = false,
): StringFormField => ({
  value,
  touched: false,
  dirty: false,
  validated: false,
  error: required && !value ? 'This field is required' : undefined,
});

export const createNumberField = (
  value: number | null = null,
  required = false,
): NumberFormField => ({
  value,
  touched: false,
  dirty: false,
  validated: false,
  error: required && value === null ? 'This field is required' : undefined,
});

export const createBooleanField = (value = false): BooleanFormField => ({
  value,
  touched: false,
  dirty: false,
  validated: false,
});

export const createDateField = (
  value: Date | null = null,
  required = false,
): DateFormField => ({
  value,
  touched: false,
  dirty: false,
  validated: false,
  error: required && !value ? 'This field is required' : undefined,
});

export const createFileField = (
  value: File | null = null,
  required = false,
): FileFormField => ({
  value,
  touched: false,
  dirty: false,
  validated: false,
  error: required && !value ? 'This field is required' : undefined,
});

export const createArrayField = <T>(
  value: T[] = [],
  required = false,
): ArrayFormField<T> => ({
  value,
  touched: false,
  dirty: false,
  validated: false,
  error: required && value.length === 0 ? 'This field is required' : undefined,
});

// Form data factory functions
export const createLoginFormData = (): LoginFormData => ({
  phone: createStringField('', true),
});

export const createEventFormData = (): EventFormData => ({
  title: createStringField('', true),
  description: createStringField('', true),
  event_date: createDateField(null, true),
  location: createStringField('', true),
  max_guests: createNumberField(null, false),
  is_public: createBooleanField(false),
});

export const createGuestFormData = (): GuestFormData => ({
  phone: createStringField('', true),
  guest_name: createStringField('', false),
  // guest_email removed - no longer used in current implementation
  role: createStringField('guest', true),
  rsvp_status: createStringField('pending', false),
  guest_tags: createArrayField<string>(),
});

// Legacy factory

export const createMessageFormData = (): MessageFormData => ({
  content: createStringField('', true),
  message_type: createStringField('text', true),
  event_id: createStringField('', true),
});

export const createMediaUploadFormData = (): MediaUploadFormData => ({
  files: createArrayField<File>([], true),
  caption: createStringField('', false),
  event_id: createStringField('', true),
});

export const createProfileFormData = (): ProfileFormData => ({
  full_name: createStringField('', false),
  email: createStringField('', false),
  phone: createStringField('', true),
  avatar: createFileField(null, false),
});
