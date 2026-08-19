import { useEffect, useState } from 'react';

/**
 * Returns `value` once it has been stable for `delayMs` (trailing edge).
 * Lets list pages fire one request per pause in typing instead of one per
 * keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
