import React from 'react';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { ValidationResult } from '@/lib/utils/validation';

// Validation feedback icon component
export const ValidationIcon: React.FC<{ result?: ValidationResult }> = ({
  result,
}) => {
  if (!result) return null;

  if (!result.isValid) {
    return <XCircle className="w-5 h-5 text-red-500" aria-hidden="true" />;
  }

  if (result.success) {
    return (
      <CheckCircle className="w-5 h-5 text-emerald-500" aria-hidden="true" />
    );
  }

  if (result.warning) {
    return (
      <AlertCircle className="w-5 h-5 text-amber-500" aria-hidden="true" />
    );
  }

  return null;
};

// Validation message component
export const ValidationMessage: React.FC<{
  result?: ValidationResult;
  error?: string;
}> = ({ result, error }) => {
  // Prioritize explicit error prop over validation result
  const displayError = error || (!result?.isValid ? result?.error : undefined);
  const displayWarning = !displayError && result?.warning;
  const displaySuccess = !displayError && !displayWarning && result?.success;

  if (displayError) {
    return (
      <p
        className="text-sm text-red-600 mt-1 flex items-center gap-2"
        role="alert"
      >
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
