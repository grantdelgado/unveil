// Error handling utilities
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
};

export const isSupabaseError = (error: unknown): boolean => {
  return (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    'code' in error
  );
};
