/**
 * Creates a throttled function that only invokes `func` at most once per
 * every `wait` milliseconds.
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let trailingCallScheduled = false;

  function throttled(this: unknown, ...args: Parameters<T>) {
    lastArgs = args;

    if (!timeoutId) {
      func.call(this, ...lastArgs);
      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (trailingCallScheduled) {
          throttled(...lastArgs as Parameters<T>);
          trailingCallScheduled = false;
        }
      }, wait);
    } else {
      trailingCallScheduled = true;
    }
  }

  return throttled;
}