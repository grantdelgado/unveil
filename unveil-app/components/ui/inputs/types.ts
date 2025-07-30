import React from 'react';
import { ValidationResult } from '@/lib/utils/validation';

export interface BaseInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  className?: string;
  validation?: ValidationResult;
  realTimeValidation?: boolean;
  onValidationChange?: (result: ValidationResult) => void;
  validationFn?: (value: string) => ValidationResult;
  label?: string;
  helpText?: string;
}

export interface PhoneInputProps extends Omit<BaseInputProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

export interface OTPInputProps extends Omit<BaseInputProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
} 