// Core UI Components
export { Button } from './Button';
export { Input } from './Input';
export { LoadingSpinner } from './LoadingSpinner';
export { ErrorBoundary, MessagingErrorFallback } from './ErrorBoundary';
export { BackButton } from './BackButton';
export { CardContainer } from './CardContainer';
export { EmptyState } from './EmptyState';
export { LazyWrapper } from './LazyWrapper';
export { LogoContainer } from './LogoContainer';
export { OptimizedImage } from './OptimizedImage';
export { PageWrapper } from './PageWrapper';
export { Pagination } from './Pagination';

export { StorageErrorFallback } from './StorageErrorFallback';
// Typography components (individual exports)
export {
  PageTitle,
  SubTitle,
  SectionTitle,
  FieldLabel,
  MicroCopy,
} from './Typography';

// Button components
export { PrimaryButton, SecondaryButton, IconButton } from './UnveilButton';

// Loading components
export { SkeletonLoader } from './EmptyState';

// Backward compatibility exports (if needed)
export {
  PrimaryButton as UnveilButton, // If code expects UnveilButton
} from './UnveilButton';

// Create a Typography namespace object (if needed)
import * as TypographyComponents from './Typography';
export const Typography = TypographyComponents;

// Legacy Input (deprecated - use focused inputs instead)
export {
  TextInput as UnveilTextInput,
  PhoneNumberInput as UnveilPhoneInput,
  OTPInput as UnveilOTPInput,
} from './UnveilInput';

// Also export with standard names for compatibility
export { PhoneNumberInput, TextInput, OTPInput } from './UnveilInput';

// Modern focused input components (recommended)
export * from './inputs';

// Toast functionality
export { useToast } from './useToast';
export { ToastProvider, useToast as useEnhancedToast } from './Toast';

// Note: Typography, Button, and Loading components are exported above
