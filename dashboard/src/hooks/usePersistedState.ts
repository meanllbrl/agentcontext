import { useState, useCallback, useEffect } from 'react';

const STORAGE_PREFIX = 'agentcontext:';

export function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const storageKey = STORAGE_PREFIX + key;

  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // Corrupted or missing — use default
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Storage full or unavailable
    }
  }, [storageKey, value]);

  const setPersistedValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue(newValue);
  }, []);

  return [value, setPersistedValue];
}
