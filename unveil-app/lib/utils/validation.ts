// Validation utilities - phone-only MVP
// isValidEmail function removed for phone-only MVP

export const isValidPhoneNumber = (phone: string): boolean => {
  // Remove all non-digits and check if it's a valid US phone number
  const digitsOnly = phone.replace(/\D/g, '');

  // US phone numbers: 10 digits (with optional +1 country code)
  if (digitsOnly.length === 10) return true;
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) return true;

  return false;
};

export const formatPhoneNumber = (value: string): string => {
  // Remove all non-digits
  const digitsOnly = value.replace(/\D/g, '');

  // Limit to 11 digits (1 + 10 digit US number)
  const truncated = digitsOnly.slice(0, 11);

  // Format based on length
  if (truncated.length === 0) return '';
  if (truncated.length <= 3) return truncated;
  if (truncated.length <= 6)
    return `(${truncated.slice(0, 3)}) ${truncated.slice(3)}`;
  if (truncated.length <= 10) {
    return `(${truncated.slice(0, 3)}) ${truncated.slice(3, 6)}-${truncated.slice(6)}`;
  }

  // Handle 11-digit number (with country code)
  return `+${truncated.slice(0, 1)} (${truncated.slice(1, 4)}) ${truncated.slice(4, 7)}-${truncated.slice(7)}`;
};

// REMOVED: normalizePhoneNumber - use lib/utils/phone.ts instead for consistency

export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Validation utilities for form inputs with real-time feedback

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
  success?: string;
}

export interface ValidationOptions {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: string) => ValidationResult;
  realTime?: boolean;
}

// Phone number validation
export function validatePhoneNumber(phoneNumber: string): ValidationResult {
  const trimmed = phoneNumber.trim();

  if (!trimmed) {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Remove all non-digits
  const digitsOnly = trimmed.replace(/\D/g, '');

  // Check for US phone number (10 digits)
  if (digitsOnly.length < 10) {
    return {
      isValid: false,
      error: `Phone number must be 10 digits (${digitsOnly.length}/10)`,
    };
  }

  if (digitsOnly.length > 11) {
    return { isValid: false, error: 'Phone number is too long' };
  }

  // Check for valid US format (10 digits or 11 with leading 1)
  const isValid =
    digitsOnly.length === 10 ||
    (digitsOnly.length === 11 && digitsOnly.startsWith('1'));

  if (!isValid) {
    return { isValid: false, error: 'Please enter a valid US phone number' };
  }

  // Success feedback
  return {
    isValid: true,
    success: '✓ Valid phone number',
  };
}

// Email validation removed for phone-only MVP

// Name validation
export function validateName(
  name: string,
  fieldName: string = 'Name',
): ValidationResult {
  const trimmed = name.trim();

  if (!trimmed) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  if (trimmed.length < 2) {
    return {
      isValid: false,
      error: `${fieldName} must be at least 2 characters`,
    };
  }

  if (trimmed.length > 50) {
    return {
      isValid: false,
      error: `${fieldName} must be 50 characters or less`,
    };
  }

  // Check for valid characters (letters, spaces, hyphens, apostrophes)
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  if (!nameRegex.test(trimmed)) {
    return {
      isValid: false,
      error: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes`,
    };
  }

  return {
    isValid: true,
    success: '✓ Valid name',
  };
}

// Event title validation
export function validateEventTitle(title: string): ValidationResult {
  const trimmed = title.trim();

  if (!trimmed) {
    return { isValid: false, error: 'Event title is required' };
  }

  if (trimmed.length < 3) {
    return {
      isValid: false,
      error: `Title too short (${trimmed.length}/3 minimum)`,
    };
  }

  if (trimmed.length > 100) {
    return {
      isValid: false,
      error: `Title too long (${trimmed.length}/100 maximum)`,
    };
  }

  // Warning for very short titles
  if (trimmed.length < 10) {
    return {
      isValid: true,
      warning: 'Consider adding more detail to your title',
    };
  }

  return {
    isValid: true,
    success: '✓ Great title!',
  };
}

// Location validation
export function validateLocation(location: string): ValidationResult {
  const trimmed = location.trim();

  if (!trimmed) {
    return { isValid: true }; // Location is optional
  }

  if (trimmed.length < 3) {
    return {
      isValid: false,
      error: 'Location must be at least 3 characters',
    };
  }

  if (trimmed.length > 200) {
    return {
      isValid: false,
      error: `Location too long (${trimmed.length}/200 maximum)`,
    };
  }

  return {
    isValid: true,
    success: '✓ Location added',
  };
}

// Description validation
export function validateDescription(description: string): ValidationResult {
  const trimmed = description.trim();

  if (!trimmed) {
    return { isValid: true }; // Description is optional
  }

  if (trimmed.length > 1000) {
    return {
      isValid: false,
      error: `Description too long (${trimmed.length}/1000 maximum)`,
    };
  }

  // Warning for very short descriptions
  if (trimmed.length < 20) {
    return {
      isValid: true,
      warning: 'Consider adding more details about your event',
    };
  }

  return {
    isValid: true,
    success: '✓ Great description!',
  };
}

// Date validation
export function validateEventDate(dateString: string): ValidationResult {
  if (!dateString) {
    return { isValid: false, error: 'Event date is required' };
  }

  const date = new Date(dateString);

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return { isValid: false, error: 'Please enter a valid date' };
  }

  // Check if date is in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date < today) {
    return { isValid: false, error: 'Event date cannot be in the past' };
  }

  // Warning for dates too far in the future
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  if (date > oneYearFromNow) {
    return {
      isValid: true,
      warning: 'Event is more than a year away',
    };
  }

  // Warning for dates very soon
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date < tomorrow) {
    return {
      isValid: true,
      warning: 'Event is very soon!',
    };
  }

  return {
    isValid: true,
    success: '✓ Date set',
  };
}

// Generic text validation
export function validateText(
  value: string,
  options: ValidationOptions = {},
): ValidationResult {
  const trimmed = value.trim();

  // Required check
  if (options.required && !trimmed) {
    return { isValid: false, error: 'This field is required' };
  }

  // Length checks
  if (options.minLength && trimmed.length < options.minLength) {
    return {
      isValid: false,
      error: `Must be at least ${options.minLength} characters (${trimmed.length}/${options.minLength})`,
    };
  }

  if (options.maxLength && trimmed.length > options.maxLength) {
    return {
      isValid: false,
      error: `Must be ${options.maxLength} characters or less (${trimmed.length}/${options.maxLength})`,
    };
  }

  // Pattern check
  if (options.pattern && !options.pattern.test(trimmed)) {
    return { isValid: false, error: 'Invalid format' };
  }

  // Custom validator
  if (options.customValidator) {
    return options.customValidator(trimmed);
  }

  return { isValid: true };
}

// Password validation
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      error: `Password must be at least 8 characters (${password.length}/8)`,
    };
  }

  if (password.length > 128) {
    return { isValid: false, error: 'Password is too long' };
  }

  // Check for common weak passwords
  const weakPasswords = [
    'password',
    '12345678',
    'qwerty',
    'abc123',
    'password123',
    'admin',
    'letmein',
    'welcome',
    'monkey',
    'dragon',
  ];

  if (weakPasswords.includes(password.toLowerCase())) {
    return {
      isValid: false,
      error: 'Please choose a stronger password',
    };
  }

  // Strength indicators
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const strengthScore = [
    hasUpperCase,
    hasLowerCase,
    hasNumbers,
    hasSpecialChar,
  ].filter(Boolean).length;

  if (strengthScore < 2) {
    return {
      isValid: true,
      warning: 'Consider adding uppercase, numbers, or symbols',
    };
  }

  if (strengthScore >= 3) {
    return {
      isValid: true,
      success: '✓ Strong password',
    };
  }

  return {
    isValid: true,
    success: '✓ Good password',
  };
}

// Real-time validation debouncing
export function debounceValidation<T extends unknown[]>(
  validationFn: (...args: T) => ValidationResult,
  delay: number = 300,
): (...args: T) => Promise<ValidationResult> {
  let timeoutId: NodeJS.Timeout;

  return (...args: T): Promise<ValidationResult> => {
    return new Promise((resolve) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        resolve(validationFn(...args));
      }, delay);
    });
  };
}

// Validation state management
export interface ValidationState {
  [fieldName: string]: ValidationResult;
}

export function isFormValid(validationState: ValidationState): boolean {
  return Object.values(validationState).every((result) => result.isValid);
}

export function getFormErrors(validationState: ValidationState): string[] {
  return Object.values(validationState)
    .filter((result) => !result.isValid && result.error)
    .map((result) => result.error!);
}

export function getFieldValidationClass(
  result: ValidationResult | undefined,
): string {
  if (!result) return '';

  if (!result.isValid) {
    return 'border-red-300 focus:border-red-500 focus:ring-red-200';
  }

  if (result.success) {
    return 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-200';
  }

  if (result.warning) {
    return 'border-amber-300 focus:border-amber-500 focus:ring-amber-200';
  }

  return '';
}
