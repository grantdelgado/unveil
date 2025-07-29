import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { ValidationResult, getFieldValidationClass } from '@/lib/utils/validation';

interface BaseInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  className?: string;
  validation?: ValidationResult;
  realTimeValidation?: boolean;
  onValidationChange?: (result: ValidationResult) => void;
  validationFn?: (value: string) => ValidationResult;
  label?: string;
  helpText?: string;
}

// Validation feedback icon component
const ValidationIcon: React.FC<{ result?: ValidationResult }> = ({ result }) => {
  if (!result) return null;

  if (!result.isValid) {
    return <XCircle className="w-5 h-5 text-red-500" aria-hidden="true" />;
  }

  if (result.success) {
    return <CheckCircle className="w-5 h-5 text-emerald-500" aria-hidden="true" />;
  }

  if (result.warning) {
    return <AlertCircle className="w-5 h-5 text-amber-500" aria-hidden="true" />;
  }

  return null;
};

// Validation message component
const ValidationMessage: React.FC<{ result?: ValidationResult; error?: string }> = ({ 
  result, 
  error 
}) => {
  // Prioritize explicit error prop over validation result
  const displayError = error || (!result?.isValid ? result?.error : undefined);
  const displayWarning = !displayError && result?.warning;
  const displaySuccess = !displayError && !displayWarning && result?.success;

  if (displayError) {
    return (
      <p className="text-sm text-red-600 mt-1 flex items-center gap-2" role="alert">
        <XCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        {displayError}
      </p>
    );
  }

  if (displayWarning) {
    return (
      <p className="text-sm text-amber-600 mt-1 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        {displayWarning}
      </p>
    );
  }

  if (displaySuccess) {
    return (
      <p className="text-sm text-emerald-600 mt-1 flex items-center gap-2">
        <CheckCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        {displaySuccess}
      </p>
    );
  }

  return null;
};

// Base Text Input Component with Enhanced Validation
export const TextInput: React.FC<BaseInputProps> = ({
  error,
  className,
  disabled,
  validation,
  realTimeValidation = false,
  onValidationChange,
  validationFn,
  label,
  helpText,
  onChange,
  onBlur,
  ...props
}) => {
  const [internalValidation, setInternalValidation] = useState<ValidationResult | undefined>();
  const [hasBlurred, setHasBlurred] = useState(false);
  
  const validationResult = validation || internalValidation;
  const validationClass = getFieldValidationClass(validationResult);

  const handleValidation = useCallback((value: string) => {
    if (!validationFn) return;

    const result = validationFn(value);
    setInternalValidation(result);
    onValidationChange?.(result);
  }, [validationFn, onValidationChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    
    if (realTimeValidation && (hasBlurred || e.target.value.length > 0)) {
      handleValidation(e.target.value);
    }
  }, [onChange, realTimeValidation, hasBlurred, handleValidation]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setHasBlurred(true);
    onBlur?.(e);
    
    if (validationFn) {
      handleValidation(e.target.value);
    }
  }, [onBlur, validationFn, handleValidation]);

  const inputId = props.id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          id={inputId}
          className={cn(
            'w-full py-3 px-4 border rounded-lg text-base transition-all duration-200',
            'placeholder-gray-400 focus:outline-none focus:ring-2',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
            // Dark text for better visibility
            'text-gray-900',
            // Prevent iOS zoom on input focus
            'text-[16px] md:text-base min-h-[44px]',
            // Validation-based styling
            validationClass || 'border-gray-300 focus:ring-pink-200 focus:border-pink-400',
            // Icon spacing
            validationResult && 'pr-12',
            className,
          )}
          disabled={disabled}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={!validationResult?.isValid || !!error}
          aria-describedby={`${inputId}-feedback ${inputId}-help`}
          {...props}
        />
        
        {/* Validation icon */}
        {validationResult && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ValidationIcon result={validationResult} />
          </div>
        )}
      </div>

      {/* Help text */}
      {helpText && !error && !validationResult && (
        <p id={`${inputId}-help`} className="text-sm text-gray-600">
          {helpText}
        </p>
      )}

      {/* Validation feedback */}
      <div id={`${inputId}-feedback`}>
        <ValidationMessage result={validationResult} error={error} />
      </div>
    </div>
  );
};

// Enhanced Phone Number Input Component
interface PhoneNumberInputProps extends Omit<BaseInputProps, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

export const PhoneNumberInput: React.FC<PhoneNumberInputProps> = ({
  value,
  onChange,
  error,
  className,
  disabled,
  placeholder = "(555) 123-4567",
  autoFocus,
  validation,
  realTimeValidation = false,
  onValidationChange,
  validationFn,
  label,
  helpText,
  onBlur,
  ...props
}) => {
  const [internalValidation, setInternalValidation] = useState<ValidationResult | undefined>();
  const [hasBlurred, setHasBlurred] = useState(false);
  
  const validationResult = validation || internalValidation;
  const validationClass = getFieldValidationClass(validationResult);

  const formatPhoneNumber = (inputValue: string) => {
    // Remove all non-digits
    const cleaned = inputValue.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX for US numbers
    if (cleaned.length >= 10) {
      const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})/);
      if (match) {
        return `(${match[1]}) ${match[2]}-${match[3]}`;
      }
    }

    // For shorter numbers, progressive formatting
    if (cleaned.length >= 6) {
      const match = cleaned.match(/^(\d{3})(\d{0,3})(\d{0,4})/);
      if (match) {
        let formatted = `(${match[1]})`;
        if (match[2]) formatted += ` ${match[2]}`;
        if (match[3]) formatted += `-${match[3]}`;
        return formatted;
      }
    }

    return cleaned;
  };

  const handleValidation = useCallback((value: string) => {
    if (!validationFn) return;

    const result = validationFn(value);
    setInternalValidation(result);
    onValidationChange?.(result);
  }, [validationFn, onValidationChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    onChange(formatted);
    
    if (realTimeValidation && (hasBlurred || formatted.length > 0)) {
      handleValidation(formatted);
    }
  };

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setHasBlurred(true);
    onBlur?.(e);
    
    if (validationFn) {
      handleValidation(value);
    }
  }, [onBlur, validationFn, value, handleValidation]);

  const inputId = props.id || `phone-input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            'w-full py-3 px-4 border rounded-lg transition-all duration-200',
            'placeholder-gray-400 focus:outline-none focus:ring-2',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
            // Dark text for better visibility
            'text-gray-900',
            // Prevent iOS zoom and ensure touch-friendly size
            'text-[16px] md:text-base min-h-[44px]',
            // Validation-based styling
            validationClass || 'border-gray-300 focus:ring-pink-200 focus:border-pink-400',
            // Icon spacing
            validationResult && 'pr-12',
            className,
          )}
          disabled={disabled}
          aria-invalid={!validationResult?.isValid || !!error}
          aria-describedby={`${inputId}-feedback ${inputId}-help`}
          {...props}
        />

        {/* Validation icon */}
        {validationResult && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ValidationIcon result={validationResult} />
          </div>
        )}
      </div>

      {/* Help text */}
      {helpText && !error && !validationResult && (
        <p id={`${inputId}-help`} className="text-sm text-gray-600">
          {helpText}
        </p>
      )}

      {/* Validation feedback */}
      <div id={`${inputId}-feedback`}>
        <ValidationMessage result={validationResult} error={error} />
      </div>
    </div>
  );
};

// Enhanced OTP Input Component with auto-focus and auto-submit
interface OTPInputProps extends Omit<BaseInputProps, 'onChange' | 'value' | 'maxLength'> {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void; // Called when 6 digits entered
  autoFocus?: boolean;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  value,
  onChange,
  onComplete,
  error,
  className,
  disabled,
  placeholder = "123456",
  autoFocus = true,
  validation,
  realTimeValidation = false,
  onValidationChange,
  validationFn,
  label,
  helpText,
  onBlur,
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalValidation, setInternalValidation] = useState<ValidationResult | undefined>();
  const [hasBlurred, setHasBlurred] = useState(false);
  
  const validationResult = validation || internalValidation;
  const validationClass = getFieldValidationClass(validationResult);

  // Auto-focus when component mounts or when switching to OTP step
  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, disabled]);

  const handleValidation = useCallback((value: string) => {
    if (!validationFn) return;

    const result = validationFn(value);
    setInternalValidation(result);
    onValidationChange?.(result);
  }, [validationFn, onValidationChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.replace(/\D/g, '').slice(0, 6); // Only digits, max 6
    onChange(inputValue);
    
    if (realTimeValidation && (hasBlurred || inputValue.length > 0)) {
      handleValidation(inputValue);
    }
    
    // Auto-submit when 6 digits are entered
    if (inputValue.length === 6 && onComplete) {
      // Small delay to ensure the input value is fully processed
      setTimeout(() => {
        onComplete(inputValue);
      }, 100);
    }
  };

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setHasBlurred(true);
    onBlur?.(e);
    
    if (validationFn) {
      handleValidation(value);
    }
  }, [onBlur, validationFn, value, handleValidation]);

  // Handle paste events for better UX
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 6);
    
    if (digits.length > 0) {
      onChange(digits);
      if (realTimeValidation) {
        handleValidation(digits);
      }
      if (digits.length === 6 && onComplete) {
        setTimeout(() => {
          onComplete(digits);
        }, 100);
      }
    }
  };

  const inputId = props.id || `otp-input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onPaste={handlePaste}
          placeholder={placeholder}
          maxLength={6}
          autoComplete="one-time-code"
          className={cn(
            'w-full py-4 px-4 border rounded-lg text-center font-mono tracking-widest transition-all duration-200',
            'placeholder-gray-400 focus:outline-none focus:ring-2',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
            // Dark text for better visibility
            'text-gray-900',
            // Prevent iOS zoom and ensure touch-friendly size
            'text-[18px] md:text-lg min-h-[52px]',
            // Validation-based styling
            validationClass || 'border-gray-300 focus:ring-pink-200 focus:border-pink-400',
            // Icon spacing
            validationResult && 'pr-12',
            className,
          )}
          disabled={disabled}
          aria-invalid={!validationResult?.isValid || !!error}
          aria-describedby={`${inputId}-feedback ${inputId}-help`}
          {...props}
        />

        {/* Validation icon */}
        {validationResult && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ValidationIcon result={validationResult} />
          </div>
        )}
      </div>

      {/* Help text */}
      {helpText && !error && !validationResult && (
        <p id={`${inputId}-help`} className="text-sm text-gray-600">
          {helpText}
        </p>
      )}

      {/* Validation feedback */}
      <div id={`${inputId}-feedback`}>
        <ValidationMessage result={validationResult} error={error} />
      </div>
    </div>
  );
};

// Display Names
TextInput.displayName = 'TextInput';
PhoneNumberInput.displayName = 'PhoneNumberInput';
OTPInput.displayName = 'OTPInput'; 