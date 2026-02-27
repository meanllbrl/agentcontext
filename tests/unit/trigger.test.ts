import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readSleepState, writeSleepState, Trigger } from '../../src/cli/commands/sleep.js';

function makeTmpDir(): string {
  const dir = join(tmpdir(), `ac-trg-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeTrigger(overrides: Partial<Trigger> = {}): Trigger {
  return {
    id: `trg_test_${Date.now()}`,
    when: 'auth',
    remind: 'Apply rate limiting',
    source: null,
    created_at: new Date().toISOString(),
    fired_count: 0,
    max_fires: 3,
    ...overrides,
  };
}

describe('Trigger operations via SleepState', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    mkdirSync(join(tmpDir, 'state'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads empty triggers from default state', () => {
    const state = readSleepState(tmpDir);
    expect(state.triggers).toEqual([]);
  });

  it('persists triggers through write/read cycle', () => {
    const state = readSleepState(tmpDir);
    state.triggers.push(makeTrigger({ when: 'database', remind: 'Check migrations' }));
    writeSleepState(tmpDir, state);

    const reread = readSleepState(tmpDir);
    expect(reread.triggers).toHaveLength(1);
    expect(reread.triggers[0].when).toBe('database');
    expect(reread.triggers[0].remind).toBe('Check migrations');
  });

  it('increments fired_count', () => {
    const state = readSleepState(tmpDir);
    state.triggers.push(makeTrigger({ fired_count: 0, max_fires: 3 }));
    state.triggers[0].fired_count++;
    writeSleepState(tmpDir, state);

    const reread = readSleepState(tmpDir);
    expect(reread.triggers[0].fired_count).toBe(1);
  });

  it('removes trigger by id', () => {
    const state = readSleepState(tmpDir);
    state.triggers.push(makeTrigger({ id: 'trg_keep' }));
    state.triggers.push(makeTrigger({ id: 'trg_remove' }));
    state.triggers = state.triggers.filter(t => t.id !== 'trg_remove');
    writeSleepState(tmpDir, state);

    const reread = readSleepState(tmpDir);
    expect(reread.triggers).toHaveLength(1);
    expect(reread.triggers[0].id).toBe('trg_keep');
  });

  it('expires triggers past max_fires in sleep done', () => {
    const state = readSleepState(tmpDir);
    state.triggers.push(makeTrigger({ id: 'trg_expired', fired_count: 3, max_fires: 3 }));
    state.triggers.push(makeTrigger({ id: 'trg_active', fired_count: 1, max_fires: 3 }));

    // Simulate sleep done expiry
    state.triggers = state.triggers.filter(t => t.fired_count < t.max_fires);

    expect(state.triggers).toHaveLength(1);
    expect(state.triggers[0].id).toBe('trg_active');
  });

  it('preserves source reference', () => {
    const state = readSleepState(tmpDir);
    state.triggers.push(makeTrigger({ source: 'memory.md#rate-limiting' }));
    writeSleepState(tmpDir, state);

    const reread = readSleepState(tmpDir);
    expect(reread.triggers[0].source).toBe('memory.md#rate-limiting');
  });
});
