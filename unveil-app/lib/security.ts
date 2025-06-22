import { NextRequest } from 'next/server';
import crypto from 'crypto';

// CSRF Token Management
const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

interface CSRFToken {
  token: string;
  expires: number;
  sessionId: string;
}

// In-memory CSRF token store (use Redis in production)
const csrfTokenStore = new Map<string, CSRFToken>();

/**
 * Generate a secure CSRF token
 */
export function generateCSRFToken(sessionId: string): string {
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  const expires = Date.now() + CSRF_TOKEN_EXPIRY;

  csrfTokenStore.set(token, {
    token,
    expires,
    sessionId,
  });

  // Clean up expired tokens
  cleanupExpiredTokens();

  return token;
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(token: string, sessionId: string): boolean {
  const storedToken = csrfTokenStore.get(token);

  if (!storedToken) {
    return false;
  }

  if (Date.now() > storedToken.expires) {
    csrfTokenStore.delete(token);
    return false;
  }

  if (storedToken.sessionId !== sessionId) {
    return false;
  }

  return true;
}

/**
 * Clean up expired CSRF tokens
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [token, data] of csrfTokenStore.entries()) {
    if (now > data.expires) {
      csrfTokenStore.delete(token);
    }
  }
}

/**
 * Extract CSRF token from request
 */
export function extractCSRFToken(request: NextRequest): string | null {
  // Check header first
  const headerToken = request.headers.get('x-csrf-token');
  if (headerToken) return headerToken;

  // Check form data (for multipart/form-data)
  const contentType = request.headers.get('content-type');
  if (contentType?.includes('multipart/form-data')) {
    // Note: In a real implementation, you'd parse the form data
    // For now, we'll rely on the header approach
    return null;
  }

  return null;
}

/**
 * Input Sanitization Functions
 */

/**
 * Sanitize text input to prevent XSS
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data: protocol
    .trim()
    .substring(0, 1000); // Limit length
}

/**
 * Sanitize HTML content (basic sanitization)
 */
export function sanitizeHTML(input: string): string {
  if (typeof input !== 'string') return '';

  // Allow only basic formatting tags
  const allowedTags = ['b', 'i', 'em', 'strong', 'p', 'br'];
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

  return input.replace(tagRegex, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      return match;
    }
    return ''; // Remove disallowed tags
  });
}

/**
 * Validate and sanitize phone number
 */
export function sanitizePhoneNumber(phone: string): string {
  if (typeof phone !== 'string') return '';

  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Ensure it starts with + and has reasonable length
  if (!cleaned.startsWith('+') || cleaned.length < 10 || cleaned.length > 16) {
    throw new Error('Invalid phone number format');
  }

  return cleaned;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  if (typeof email !== 'string') return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Rate limiting helpers
 */
export function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * SQL Injection Prevention
 */
export function sanitizeForSQL(input: string): string {
  if (typeof input !== 'string') return '';

  // Basic SQL injection prevention
  return input
    .replace(/['"\\;]/g, '') // Remove quotes and semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove SQL block comments start
    .replace(/\*\//g, '') // Remove SQL block comments end
    .trim();
}

/**
 * Path traversal prevention
 */
export function sanitizePath(path: string): string {
  if (typeof path !== 'string') return '';

  return path
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/[\\]/g, '/') // Normalize path separators
    .replace(/\/+/g, '/') // Remove duplicate slashes
    .replace(/^\//, '') // Remove leading slash
    .substring(0, 255); // Limit length
}

/**
 * Content Security Policy Nonce Generation
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Secure random string generation
 */
export function generateSecureRandomString(length: number = 32): string {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Timing-safe string comparison
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  return crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * Password strength validation
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (password.length > 128) {
    errors.push('Password must be less than 128 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
