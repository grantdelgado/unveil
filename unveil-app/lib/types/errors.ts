/**
 * Domain-specific Error Types for Unveil
 *
 * Provides strongly-typed error handling for different domains
 * with specific error codes and context information.
 */

import type { AppError } from '@/lib/error-handling';

// Base error interface with domain context
export interface DomainError extends AppError {
  domain: string;
  context?: Record<string, unknown>;
}

// Authentication & Authorization Errors
export interface AuthError extends DomainError {
  domain: 'auth';
  authCode?:
    | 'INVALID_CREDENTIALS'
    | 'SESSION_EXPIRED'
    | 'OTP_FAILED'
    | 'RATE_LIMITED'
    | 'PHONE_INVALID'
    | 'USER_NOT_FOUND'
    | 'PERMISSION_DENIED'
    | 'DEV_AUTH_FAILED';
}

export class AuthErrorClass extends Error implements AuthError {
  domain = 'auth' as const;
  code: string;
  authCode?: AuthError['authCode'];
  details?: unknown;
  timestamp: Date;
  context?: Record<string, unknown>;

  constructor(
    authCode: AuthError['authCode'],
    message: string,
    details?: unknown,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AuthError';
    this.code = authCode || 'AUTH_ERROR';
    this.authCode = authCode;
    this.details = details;
    this.timestamp = new Date();
    this.context = context;
  }
}

// Database & Data Access Errors
export interface DatabaseError extends DomainError {
  domain: 'database';
  dbCode?:
    | 'CONSTRAINT_VIOLATION'
    | 'FOREIGN_KEY_VIOLATION'
    | 'UNIQUE_VIOLATION'
    | 'CHECK_VIOLATION'
    | 'NOT_NULL_VIOLATION'
    | 'QUERY_FAILED'
    | 'CONNECTION_FAILED'
    | 'TIMEOUT'
    | 'RLS_VIOLATION';
  table?: string;
  operation?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
}

export class DatabaseErrorClass extends Error implements DatabaseError {
  domain = 'database' as const;
  code: string;
  dbCode?: DatabaseError['dbCode'];
  details?: unknown;
  timestamp: Date;
  context?: Record<string, unknown>;
  table?: string;
  operation?: DatabaseError['operation'];

  constructor(
    dbCode: DatabaseError['dbCode'],
    message: string,
    details?: unknown,
    context?: Record<string, unknown>,
    table?: string,
    operation?: DatabaseError['operation'],
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.code = dbCode || 'DATABASE_ERROR';
    this.dbCode = dbCode;
    this.details = details;
    this.timestamp = new Date();
    this.context = context;
    this.table = table;
    this.operation = operation;
  }
}

// Media & File Upload Errors
export interface MediaError extends DomainError {
  domain: 'media';
  mediaCode?:
    | 'FILE_TOO_LARGE'
    | 'INVALID_FILE_TYPE'
    | 'UPLOAD_FAILED'
    | 'STORAGE_QUOTA_EXCEEDED'
    | 'PROCESSING_FAILED'
    | 'VIRUS_DETECTED'
    | 'METADATA_EXTRACTION_FAILED';
  fileSize?: number;
  fileType?: string;
  fileName?: string;
}

export class MediaErrorClass extends Error implements MediaError {
  domain = 'media' as const;
  code: string;
  mediaCode?: MediaError['mediaCode'];
  details?: unknown;
  timestamp: Date;
  context?: Record<string, unknown>;
  fileSize?: number;
  fileType?: string;
  fileName?: string;

  constructor(
    mediaCode: MediaError['mediaCode'],
    message: string,
    details?: unknown,
    context?: Record<string, unknown>,
    fileSize?: number,
    fileType?: string,
    fileName?: string,
  ) {
    super(message);
    this.name = 'MediaError';
    this.code = mediaCode || 'MEDIA_ERROR';
    this.mediaCode = mediaCode;
    this.details = details;
    this.timestamp = new Date();
    this.context = context;
    this.fileSize = fileSize;
    this.fileType = fileType;
    this.fileName = fileName;
  }
}

// Real-time & Subscription Errors
export interface RealtimeError extends DomainError {
  domain: 'realtime';
  realtimeCode?:
    | 'CONNECTION_FAILED'
    | 'SUBSCRIPTION_FAILED'
    | 'CHANNEL_ERROR'
    | 'MESSAGE_DELIVERY_FAILED'
    | 'RECONNECTION_FAILED'
    | 'RATE_LIMITED';
  channel?: string;
  subscriptionId?: string;
}

export class RealtimeErrorClass extends Error implements RealtimeError {
  domain = 'realtime' as const;
  code: string;
  realtimeCode?: RealtimeError['realtimeCode'];
  details?: unknown;
  timestamp: Date;
  context?: Record<string, unknown>;
  channel?: string;
  subscriptionId?: string;

  constructor(
    realtimeCode: RealtimeError['realtimeCode'],
    message: string,
    details?: unknown,
    context?: Record<string, unknown>,
    channel?: string,
    subscriptionId?: string,
  ) {
    super(message);
    this.name = 'RealtimeError';
    this.code = realtimeCode || 'REALTIME_ERROR';
    this.realtimeCode = realtimeCode;
    this.details = details;
    this.timestamp = new Date();
    this.context = context;
    this.channel = channel;
    this.subscriptionId = subscriptionId;
  }
}

// Form & Input Validation Errors
export interface FormValidationError extends DomainError {
  domain: 'validation';
  validationCode?:
    | 'REQUIRED_FIELD'
    | 'INVALID_FORMAT'
    | 'OUT_OF_RANGE'
    | 'PATTERN_MISMATCH'
    | 'TYPE_MISMATCH'
    | 'CUSTOM_VALIDATION';
  field?: string;
  value?: unknown;
  expectedFormat?: string;
  validationRule?: string;
}

export class FormValidationErrorClass
  extends Error
  implements FormValidationError
{
  domain = 'validation' as const;
  code: string;
  validationCode?: FormValidationError['validationCode'];
  details?: unknown;
  timestamp: Date;
  context?: Record<string, unknown>;
  field?: string;
  value?: unknown;
  expectedFormat?: string;
  validationRule?: string;

  constructor(
    validationCode: FormValidationError['validationCode'],
    message: string,
    field?: string,
    value?: unknown,
    details?: unknown,
    context?: Record<string, unknown>,
    expectedFormat?: string,
    validationRule?: string,
  ) {
    super(message);
    this.name = 'FormValidationError';
    this.code = validationCode || 'VALIDATION_ERROR';
    this.validationCode = validationCode;
    this.details = details;
    this.timestamp = new Date();
    this.context = context;
    this.field = field;
    this.value = value;
    this.expectedFormat = expectedFormat;
    this.validationRule = validationRule;
  }
}

// SMS & Communication Errors
export interface SMSError extends DomainError {
  domain: 'sms';
  smsCode?:
    | 'INVALID_PHONE_NUMBER'
    | 'DELIVERY_FAILED'
    | 'RATE_LIMITED'
    | 'INSUFFICIENT_CREDITS'
    | 'BLOCKED_NUMBER'
    | 'NETWORK_ERROR'
    | 'PROVIDER_ERROR';
  phoneNumber?: string;
  provider?: string;
}

export class SMSErrorClass extends Error implements SMSError {
  domain = 'sms' as const;
  code: string;
  smsCode?: SMSError['smsCode'];
  details?: unknown;
  timestamp: Date;
  context?: Record<string, unknown>;
  phoneNumber?: string;
  provider?: string;

  constructor(
    smsCode: SMSError['smsCode'],
    message: string,
    details?: unknown,
    context?: Record<string, unknown>,
    phoneNumber?: string,
    provider?: string,
  ) {
    super(message);
    this.name = 'SMSError';
    this.code = smsCode || 'SMS_ERROR';
    this.smsCode = smsCode;
    this.details = details;
    this.timestamp = new Date();
    this.context = context;
    this.phoneNumber = phoneNumber;
    this.provider = provider;
  }
}

// API & Network Errors with enhanced context
export interface APIError extends DomainError {
  domain: 'api';
  apiCode?:
    | 'REQUEST_FAILED'
    | 'TIMEOUT'
    | 'RATE_LIMITED'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'VALIDATION_FAILED'
    | 'SERVER_ERROR';
  status?: number;
  url?: string;
  method?: string;
  requestId?: string;
}

export class APIErrorClass extends Error implements APIError {
  domain = 'api' as const;
  code: string;
  apiCode?: APIError['apiCode'];
  details?: unknown;
  timestamp: Date;
  context?: Record<string, unknown>;
  status?: number;
  url?: string;
  method?: string;
  requestId?: string;

  constructor(
    apiCode: APIError['apiCode'],
    message: string,
    details?: unknown,
    context?: Record<string, unknown>,
    status?: number,
    url?: string,
    method?: string,
    requestId?: string,
  ) {
    super(message);
    this.name = 'APIError';
    this.code = apiCode || 'API_ERROR';
    this.apiCode = apiCode;
    this.details = details;
    this.timestamp = new Date();
    this.context = context;
    this.status = status;
    this.url = url;
    this.method = method;
    this.requestId = requestId;
  }
}

// Union type for all domain errors
export type DomainErrorUnion =
  | AuthError
  | DatabaseError
  | MediaError
  | RealtimeError
  | FormValidationError
  | SMSError
  | APIError;

// Type guards for domain errors
export const isAuthError = (error: unknown): error is AuthError => {
  return (
    error instanceof AuthErrorClass || (error as DomainError)?.domain === 'auth'
  );
};

export const isDatabaseError = (error: unknown): error is DatabaseError => {
  return (
    error instanceof DatabaseErrorClass ||
    (error as DomainError)?.domain === 'database'
  );
};

export const isMediaError = (error: unknown): error is MediaError => {
  return (
    error instanceof MediaErrorClass ||
    (error as DomainError)?.domain === 'media'
  );
};

export const isRealtimeError = (error: unknown): error is RealtimeError => {
  return (
    error instanceof RealtimeErrorClass ||
    (error as DomainError)?.domain === 'realtime'
  );
};

export const isFormValidationError = (
  error: unknown,
): error is FormValidationError => {
  return (
    error instanceof FormValidationErrorClass ||
    (error as DomainError)?.domain === 'validation'
  );
};

export const isSMSError = (error: unknown): error is SMSError => {
  return (
    error instanceof SMSErrorClass || (error as DomainError)?.domain === 'sms'
  );
};

export const isAPIError = (error: unknown): error is APIError => {
  return (
    error instanceof APIErrorClass || (error as DomainError)?.domain === 'api'
  );
};

export const isDomainError = (error: unknown): error is DomainErrorUnion => {
  return (
    isAuthError(error) ||
    isDatabaseError(error) ||
    isMediaError(error) ||
    isRealtimeError(error) ||
    isFormValidationError(error) ||
    isSMSError(error) ||
    isAPIError(error)
  );
};

// Error factory functions for convenience
export const createAuthError = (
  code: AuthError['authCode'],
  message: string,
  details?: unknown,
  context?: Record<string, unknown>,
): AuthError => new AuthErrorClass(code, message, details, context);

export const createDatabaseError = (
  code: DatabaseError['dbCode'],
  message: string,
  details?: unknown,
  context?: Record<string, unknown>,
  table?: string,
  operation?: DatabaseError['operation'],
): DatabaseError =>
  new DatabaseErrorClass(code, message, details, context, table, operation);

export const createMediaError = (
  code: MediaError['mediaCode'],
  message: string,
  details?: unknown,
  context?: Record<string, unknown>,
  fileSize?: number,
  fileType?: string,
  fileName?: string,
): MediaError =>
  new MediaErrorClass(
    code,
    message,
    details,
    context,
    fileSize,
    fileType,
    fileName,
  );

export const createRealtimeError = (
  code: RealtimeError['realtimeCode'],
  message: string,
  details?: unknown,
  context?: Record<string, unknown>,
  channel?: string,
  subscriptionId?: string,
): RealtimeError =>
  new RealtimeErrorClass(
    code,
    message,
    details,
    context,
    channel,
    subscriptionId,
  );

export const createFormValidationError = (
  code: FormValidationError['validationCode'],
  message: string,
  field?: string,
  value?: unknown,
  details?: unknown,
  context?: Record<string, unknown>,
  expectedFormat?: string,
  validationRule?: string,
): FormValidationError =>
  new FormValidationErrorClass(
    code,
    message,
    field,
    value,
    details,
    context,
    expectedFormat,
    validationRule,
  );

export const createSMSError = (
  code: SMSError['smsCode'],
  message: string,
  details?: unknown,
  context?: Record<string, unknown>,
  phoneNumber?: string,
  provider?: string,
): SMSError =>
  new SMSErrorClass(code, message, details, context, phoneNumber, provider);

export const createAPIError = (
  code: APIError['apiCode'],
  message: string,
  details?: unknown,
  context?: Record<string, unknown>,
  status?: number,
  url?: string,
  method?: string,
  requestId?: string,
): APIError =>
  new APIErrorClass(
    code,
    message,
    details,
    context,
    status,
    url,
    method,
    requestId,
  );
