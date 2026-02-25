import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Read a JSON file as an array.
 */
export function readJsonArray<T = Record<string, unknown>>(filePath: string): T[] {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array in ${filePath}, got ${typeof parsed}`);
  }
  return parsed as T[];
}

/**
 * Write an array to a JSON file with pretty formatting.
 */
export function writeJsonArray<T>(filePath: string, data: T[]): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * Insert an entry into a JSON array file.
 * 'top' = unshift (LIFO), 'bottom' = push.
 */
export function insertToJsonArray<T>(
  filePath: string,
  entry: T,
  position: 'top' | 'bottom' = 'top',
): void {
  const arr = readJsonArray<T>(filePath);
  if (position === 'top') {
    arr.unshift(entry);
  } else {
    arr.push(entry);
  }
  writeJsonArray(filePath, arr);
}

/**
 * Read a JSON file as an object.
 */
export function readJsonObject<T = Record<string, unknown>>(filePath: string): T {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Expected JSON object in ${filePath}, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`);
  }
  return parsed as T;
}

/**
 * Write an object to a JSON file with pretty formatting.
 */
export function writeJsonObject<T>(filePath: string, data: T): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
