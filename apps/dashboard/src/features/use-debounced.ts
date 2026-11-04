import { useEffect, useState } from "react";
/** Delay search updates and cancel superseded timers on input changes or unmount. */
export function useDebounced<T>(value: T, delayMs = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debouncedValue;
}
