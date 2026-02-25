import { nanoid } from 'nanoid';

/**
 * Generate a prefixed unique ID.
 * Example: generateId('feat') -> 'feat_xK9pQ2mL'
 */
export function generateId(prefix: string): string {
  return `${prefix}_${nanoid(8)}`;
}

/**
 * Slugify a name for use as a filename.
 * "My Feature Name" -> "my-feature-name"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Get today's date as YYYY-MM-DD.
 */
export function today(): string {
  return new Date().toISOString().split('T')[0];
}
