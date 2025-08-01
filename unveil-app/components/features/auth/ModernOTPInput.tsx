import React, { useRef, useEffect, useState, useCallback, KeyboardEvent, ClipboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { getFieldValidationClass, ValidationResult } from '@/lib/utils/validation';
import { ValidationIcon, ValidationMessage } from '@/components/ui/inputs/InputValidation';

interface ModernOTPInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  error?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  validation?: ValidationResult;
  realTimeValidation?: boolean;
  onValidationChange?: (result: ValidationResult) => void;
  validationFn?: (value: string) => ValidationResult;
  label?: string;
  helpText?: string;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  length?: number;
  id?: string;
}

export const ModernOTPInput: React.FC<ModernOTPInputProps> = ({
  value,
  onChange,
  onComplete,
  error,
  className,
  disabled = false,
  autoFocus = false,
  validation,
  realTimeValidation = false,
  onValidationChange,
  validationFn,
  label,
  helpText,
  onBlur,
  length = 6,
  id,
}) => {
  const [internalValidation, setInternalValidation] = useState<ValidationResult | undefined>();
  const [hasBlurred, setHasBlurred] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const validationResult = validation || internalValidation;
  const validationClass = getFieldValidationClass(validationResult);
  
  // Initialize refs array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length);
  }, [length]);

  // Auto-focus on first input when component mounts
  useEffect(() => {
    if (autoFocus && inputRefs.current[0] && !disabled) {
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, disabled]);

  // Pad or trim value to match length
  const digits = value.padEnd(length, '').slice(0, length).split('');

  const handleValidation = useCallback((value: string) => {
    if (!validationFn) return;

    const result = validationFn(value);
    setInternalValidation(result);
    onValidationChange?.(result);
  }, [validationFn, onValidationChange]);

  const updateValue = useCallback((newDigits: string[]) => {
    const newValue = newDigits.join('').replace(/\s/g, '');
    onChange(newValue);
    
    if (realTimeValidation && (hasBlurred || newValue.length > 0)) {
      handleValidation(newValue);
    }
    
    // Auto-complete when all digits are filled
    if (newValue.length === length && onComplete) {
      setTimeout(() => {
        onComplete(newValue);
      }, 100);
    }
  }, [onChange, onComplete, handleValidation, realTimeValidation, hasBlurred, length]);

  const handleInputChange = (index: number, inputValue: string) => {
    // Only allow single digit
    const digit = inputValue.replace(/\D/g, '').slice(-1);
    
    const newDigits = [...digits];
    newDigits[index] = digit;
    
    updateValue(newDigits);
    
    // Auto-advance to next input if digit was entered
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newDigits = [...digits];
      
      if (newDigits[index]) {
        // Clear current digit
        newDigits[index] = '';
      } else if (index > 0) {
        // Move to previous input and clear it
        newDigits[index - 1] = '';
        inputRefs.current[index - 1]?.focus();
      }
      
      updateValue(newDigits);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    } else if (e.key >= '0' && e.key <= '9') {
      // Handle direct number input
      e.preventDefault();
      const newDigits = [...digits];
      newDigits[index] = e.key;
      updateValue(newDigits);
      
      // Auto-advance to next input
      if (index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const pastedDigits = pastedData.replace(/\D/g, '').slice(0, length);
    
    if (pastedDigits.length > 0) {
      const newDigits = pastedDigits.split('').concat(Array(length).fill('')).slice(0, length);
      updateValue(newDigits);
      
      // Focus the next empty input or last input
      const nextEmptyIndex = newDigits.findIndex(digit => !digit);
      const focusIndex = nextEmptyIndex !== -1 ? nextEmptyIndex : length - 1;
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setHasBlurred(true);
    
    if (realTimeValidation) {
      handleValidation(value);
    }
    
    onBlur?.(e);
  }, [value, handleValidation, realTimeValidation, onBlur]);

  const inputId = id || `modern-otp-input-${Math.random().toString(36).substr(2, 9)}`;
  const hasError = !!error || (validationResult && !validationResult.isValid);

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label htmlFor={`${inputId}-0`} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <div className="relative">
        {/* 6 Individual Input Boxes */}
        <div className="flex gap-3 justify-center">
          {Array.from({ length }, (_, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              id={`${inputId}-${index}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digits[index] || ''}
              onChange={(e) => handleInputChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              onBlur={handleBlur}
              disabled={disabled}
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              className={cn(
                // Base styling
                'w-12 h-12 text-center text-xl border rounded-md shadow-sm',
                'font-mono font-semibold transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:scale-105',
                // Mobile optimizations
                'text-[18px] touch-manipulation select-all',
                // Hover effects
                'hover:border-gray-400 hover:shadow-md',
                // Disabled state
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:hover:border-gray-300',
                // Error/validation styling
                hasError
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50'
                  : validationResult?.isValid
                  ? 'border-green-300 focus:border-green-500 focus:ring-green-200 bg-green-50'
                  : 'border-gray-300 focus:border-pink-500 focus:ring-pink-200 bg-white',
                // Filled state
                digits[index] && 'border-pink-400 bg-pink-50',
                // Text color
                'text-gray-900 placeholder-gray-400'
              )}
              aria-invalid={hasError}
              aria-describedby={`${inputId}-feedback ${inputId}-help`}
            />
          ))}
        </div>

        {/* Validation icon positioned to the right of all boxes */}
        {validationResult && (
          <div className="absolute top-1/2 -translate-y-1/2 right-0 flex items-center pointer-events-none">
            <ValidationIcon result={validationResult} />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <ValidationMessage 
          message={error} 
          type="error"
          id={`${inputId}-feedback`}
        />
      )}

      {/* Validation message */}
      {validationResult && !error && (
        <ValidationMessage 
          message={validationResult.message || ''} 
          type={validationResult.isValid ? 'success' : 'error'}
          id={`${inputId}-feedback`}
        />
      )}

      {/* Help text */}
      {helpText && !error && !validationResult && (
        <p 
          id={`${inputId}-help`}
          className="text-sm text-gray-600"
        >
          {helpText}
        </p>
      )}
    </div>
  );
};

ModernOTPInput.displayName = 'ModernOTPInput';