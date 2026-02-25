import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CONTEXT_DIR = '_agent_context';
const MAX_WALK_UP = 5;

/**
 * Walk up from cwd to find _agent_context/ directory.
 * Returns the absolute path to _agent_context/ or null if not found.
 */
export function resolveContextRoot(from?: string): string | null {
  let dir = from ?? process.cwd();
  for (let i = 0; i <= MAX_WALK_UP; i++) {
    const candidate = join(dir, CONTEXT_DIR);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  return null;
}

/**
 * Resolve _agent_context/ or throw with a helpful message.
 */
export function ensureContextRoot(from?: string): string {
  const root = resolveContextRoot(from);
  if (!root) {
    throw new Error(
      '_agent_context/ not found. Run `agentcontext init` to create it.',
    );
  }
  return root;
}

/**
 * Join path segments within the _agent_context/ directory.
 */
export function contextPath(...segments: string[]): string {
  const root = ensureContextRoot();
  return join(root, ...segments);
}

/**
 * Check if _agent_context/ exists in the given directory (default: cwd).
 */
export function contextExists(from?: string): boolean {
  return resolveContextRoot(from) !== null;
}

/**
 * Get the expected _agent_context/ path in cwd (for init).
 */
export function getInitPath(): string {
  return join(process.cwd(), CONTEXT_DIR);
}
