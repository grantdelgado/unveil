import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { getFieldValidationClass, ValidationResult } from '@/lib/utils/validation';
import { ValidationIcon, ValidationMessage } from './InputValidation';
import { PhoneInputProps } from './types';

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  error,
  className,
  disabled,
  validation,
  realTimeValidation = false,
  onValidationChange,
  validationFn,
  label,
  helpText,
  placeholder = '(123) 456-7890',
  autoFocus,
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

PhoneInput.displayName = 'PhoneInput'; 