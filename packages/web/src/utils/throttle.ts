/**
 * Throttles a function to ensure it's called at most once per `ms` milliseconds.
 * Ensures the last call attempt within a throttle window is eventually executed.
 *
 * @param fn The function to throttle.
 * @param ms The throttle duration in milliseconds (default: 500).
 * @returns The throttled function.
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  ms = 500
): T {
  let lastExecutionTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: any[] | null = null;

  const throttledFn = (...args: any[]) => {
    lastArgs = args;
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecutionTime;

    // Clear any pending timeout, as we might execute now or schedule a new one
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (timeSinceLastExecution >= ms) {
      // Execute immediately
      lastExecutionTime = now;
      fn(...lastArgs);
      lastArgs = null; // Clear args after execution
    } else {
      // Schedule execution after the remaining time
      timeoutId = setTimeout(() => {
        lastExecutionTime = Date.now();
        timeoutId = null;
        if (lastArgs) {
            fn(...lastArgs);
            lastArgs = null;
        }
      }, ms - timeSinceLastExecution);
    }
  };

  // Add a cancel method if needed
  // (throttledFn as any).cancel = () => {
  //   if (timeoutId) {
  //     clearTimeout(timeoutId);
  //     timeoutId = null;
  //     lastArgs = null;
  //   }
  // };

  return throttledFn as T;
} 