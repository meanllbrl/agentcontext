import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readSleepState, writeSleepState } from '../../src/cli/commands/sleep.js';

function makeTmpDir(): string {
  const dir = join(tmpdir(), `ac-ka-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('Knowledge Access Tracking', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    mkdirSync(join(tmpDir, 'state'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('starts with empty knowledge_access', () => {
    const state = readSleepState(tmpDir);
    expect(state.knowledge_access).toEqual({});
  });

  it('records first access', () => {
    const state = readSleepState(tmpDir);
    state.knowledge_access['jwt-auth'] = { last_accessed: '2026-02-27', count: 1 };
    writeSleepState(tmpDir, state);

    const reread = readSleepState(tmpDir);
    expect(reread.knowledge_access['jwt-auth'].count).toBe(1);
    expect(reread.knowledge_access['jwt-auth'].last_accessed).toBe('2026-02-27');
  });

  it('increments access count', () => {
    const state = readSleepState(tmpDir);
    state.knowledge_access['jwt-auth'] = { last_accessed: '2026-02-25', count: 3 };
    writeSleepState(tmpDir, state);

    const reread = readSleepState(tmpDir);
    reread.knowledge_access['jwt-auth'].count++;
    reread.knowledge_access['jwt-auth'].last_accessed = '2026-02-27';
    writeSleepState(tmpDir, reread);

    const final = readSleepState(tmpDir);
    expect(final.knowledge_access['jwt-auth'].count).toBe(4);
    expect(final.knowledge_access['jwt-auth'].last_accessed).toBe('2026-02-27');
  });

  it('tracks multiple knowledge files independently', () => {
    const state = readSleepState(tmpDir);
    state.knowledge_access['jwt-auth'] = { last_accessed: '2026-02-27', count: 5 };
    state.knowledge_access['rate-limiting'] = { last_accessed: '2026-02-26', count: 2 };
    writeSleepState(tmpDir, state);

    const reread = readSleepState(tmpDir);
    expect(Object.keys(reread.knowledge_access)).toHaveLength(2);
    expect(reread.knowledge_access['jwt-auth'].count).toBe(5);
    expect(reread.knowledge_access['rate-limiting'].count).toBe(2);
  });
});
