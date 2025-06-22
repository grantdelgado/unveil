import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Tailwind utility function - used throughout the app
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
