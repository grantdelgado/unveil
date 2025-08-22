// Core utilities - most commonly used
export { cn } from './utils/cn';

// Domain-specific utilities (only used ones)
export * from './utils/date';
export * from './utils/validation';
export * from './utils/error';

// Additional utility functions for components
export function generateUniqueId(): string {
  return crypto.randomUUID();
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
