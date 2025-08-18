// Validation utilities
export { ValidationIcon, ValidationMessage } from './InputValidation';

// Input components
export { TextInput } from './TextInput';
export { PhoneInput } from './PhoneInput';
export { OTPInput } from './OTPInput';
export { SearchInput } from './SearchInput';

// Types
export type { 
  BaseInputProps, 
  PhoneInputProps, 
  OTPInputProps 
} from './types';

// Legacy compatibility exports
// These maintain backward compatibility while encouraging migration to specific components
export { TextInput as UnveilTextInput } from './TextInput';
export { PhoneInput as UnveilPhoneInput } from './PhoneInput';
export { OTPInput as UnveilOTPInput } from './OTPInput'; 