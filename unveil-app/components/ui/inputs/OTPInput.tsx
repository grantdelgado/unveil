import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  getFieldValidationClass,
  ValidationResult,
} from '@/lib/utils/validation';
import { ValidationIcon, ValidationMessage } from './InputValidation';
import { OTPInputProps } from './types';

export const OTPInput: React.FC<OTPInputProps> = ({
  value,
  onChange,
  onComplete,
  error,
  className,
  disabled,
  validation,
  realTimeValidation = false,
  onValidationChange,
  validationFn,
  label,
  helpText,
  placeholder = '123456',
  autoFocus = false,
  onBlur,
  ...props
}) => {
  const [internalValidation, setInternalValidation] = useState<
    ValidationResult | undefined
  >();
  const [hasBlurred, setHasBlurred] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validationResult = validation || internalValidation;
  const validationClass = getFieldValidationClass(validationResult);

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleValidation = useCallback(
    (value: string) => {
      if (!validationFn) return;

      const result = validationFn(value);
      setInternalValidation(result);
      onValidationChange?.(result);
    },
    [validationFn, onValidationChange],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const digits = inputValue.replace(/\D/g, '').slice(0, 6);

    onChange(digits);

    if (realTimeValidation && (hasBlurred || digits.length > 0)) {
      handleValidation(digits);
    }

    // Auto-complete when reaching 6 digits
    if (digits.length === 6 && onComplete) {
      setTimeout(() => {
        onComplete(digits);
      }, 100);
    }
  };

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setHasBlurred(true);
      onBlur?.(e);

      if (validationFn) {
        handleValidation(value);
      }
    },
    [onBlur, validationFn, value, handleValidation],
  );

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

  const inputId =
    props.id || `otp-input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="space-y-2">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
          {props.required && (
            <span className="text-red-500 ml-1" aria-label="required">
              *
            </span>
          )}
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
            validationClass ||
              'border-gray-300 focus:ring-pink-200 focus:border-pink-400',
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

OTPInput.displayName = 'OTPInput';
