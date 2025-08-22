/**
 * Simple throttle utility for performance optimization
 * Limits function execution to at most once per specified delay
 */
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecutedTime = 0;

  return (...args: Parameters<T>) => {
    const currentTime = Date.now();

    if (currentTime - lastExecutedTime > delay) {
      func(...args);
      lastExecutedTime = currentTime;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(
        () => {
          func(...args);
          lastExecutedTime = Date.now();
        },
        delay - (currentTime - lastExecutedTime),
      );
    }
  };
}
